import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import AdmZip from 'adm-zip';
import { Firecrawl } from 'firecrawl';
import { pool } from './db';
import { requireAuth, AuthedRequest, teamRoleOf } from './auth';
import { fetchAcProject, createAcProject, syncAcTask, syncAcSubtask } from './activecollab';
import { userAcToken, canSyncAcRole } from './projects';

// Firecrawl — used to screenshot URL versions for the project card thumbnail.
const firecrawl = process.env.FIRECRAWL_API_KEY ? new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY }) : null;

// Capture a screenshot of a public URL and store it on the version (best-effort, background).
async function captureScreenshot(versionId: string, url: string) {
  if (!firecrawl || !url) return;
  try {
    const r: any = await firecrawl.scrape(url, { formats: ['screenshot'] });
    const shot = r?.screenshot || r?.data?.screenshot || (Array.isArray(r?.screenshot) ? r.screenshot[0] : '');
    if (shot) await pool.query('UPDATE markup_versions SET screenshot = $1 WHERE id = $2', [String(shot), versionId]);
  } catch (e) { console.error('Markup screenshot failed:', (e as Error).message); }
}

/* ------------------------------------------------------------------ *
 *  Markup module — annotate websites with comment pins.
 *  Projects come from a live URL (shown in an iframe) or an uploaded
 *  static ZIP (unzipped to disk and served from /markup-files).
 *  Fully separate from the Sitemap 'projects' tables.
 * ------------------------------------------------------------------ */

// Where unzipped sites live (local disk). Each project gets its own folder.
export const MARKUP_DIR = process.env.MARKUP_DIR || path.join(process.cwd(), 'uploads', 'markup');
fs.mkdirSync(MARKUP_DIR, { recursive: true });
// Comment file attachments live here, served via /markup-files/_att/<file>.
const ATT_DIR = path.join(MARKUP_DIR, '_att');
fs.mkdirSync(ATT_DIR, { recursive: true });

const DEVICES = ['desktop', 'tablet', 'mobile'];
const ATT_EXT = new Set(['jpg', 'jpeg', 'png', 'svg', 'bmp', 'gif', 'pdf', 'psd', 'ai', 'eps', 'tiff', 'tif', 'rtf', 'txt', 'docx', 'doc', 'pages', 'odt', 'pptx', 'ppt', 'odp', 'key', 'xlsx', 'xls', 'csv', 'mp4', 'mov', 'webm', 'xml', 'json', 'zip']);

// Decode a base64 data-URL and store it as a comment attachment. Returns the metadata
// the frontend keeps on the comment ({ id, name, url, size, type }).
export function saveAttachment(dataUrl: string, rawName: string) {
  const s = String(dataUrl || '');
  const comma = s.indexOf(',');
  const meta = comma >= 0 ? s.slice(0, comma) : '';
  const b64 = comma >= 0 ? s.slice(comma + 1) : s;
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length) throw new Error('Empty file');
  if (buf.length > 30 * 1024 * 1024) throw new Error('File too large (max 30MB)');
  const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const safe = (String(rawName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)) || 'file';
  const ext = (safe.includes('.') ? safe.split('.').pop() || '' : '').toLowerCase();
  if (ext && !ATT_EXT.has(ext)) throw new Error('File type not allowed');
  const id = randomUUID();
  const fname = `${id}__${safe}`;
  fs.writeFileSync(path.join(ATT_DIR, fname), buf);
  return { id, name: String(rawName || safe).slice(0, 200), url: `/markup-files/_att/${fname}`, size: buf.length, type: mime };
}

// Sanitize an attachments array coming from the client before storing on a comment.
function cleanAttachments(a: any): any[] {
  if (!Array.isArray(a)) return [];
  return a.slice(0, 20).map((f: any) => ({
    id: String(f?.id || '').slice(0, 80),
    name: String(f?.name || 'file').slice(0, 200),
    url: String(f?.url || '').slice(0, 500),
    size: Number(f?.size) || 0,
    type: String(f?.type || '').slice(0, 120),
  })).filter((f) => f.url.startsWith('/markup-files/_att/'));
}

const PROXY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Same-origin proxy for a URL version: fetch the live page and serve its HTML from
// our origin so the frontend can read scroll + capture clicks inside the iframe.
// Unauthenticated (the target is a public URL); keyed by version id. No JSON.
export async function markupProxyHandler(req: any, res: any) {
  const versionId = String(req.query.version || '');
  const { rows } = await pool.query('SELECT type, url FROM markup_versions WHERE id = $1', [versionId]);
  const v = rows[0];
  if (!v || v.type !== 'url' || !v.url) return res.status(404).send('Not found');
  // Sub-page navigation stays within the proxy: ?url=<same-host target>.
  let target = v.url; let host = '';
  try { host = new URL(v.url).host; } catch {}
  const sub = String(req.query.url || '');
  if (sub) { try { if (new URL(sub).host === host) target = sub; } catch {} }
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(target, { headers: PROXY_HEADERS, redirect: 'follow', signal: ctrl.signal });
    clearTimeout(to);
    const finalUrl = (r as any).url || target;
    let html = await r.text();
    html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, ''); // drop page CSP
    html = html.replace(/<base\b[^>]*>/gi, '');                                                // drop existing <base>
    const baseTag = `<base href="${finalUrl.replace(/"/g, '&quot;')}">`;
    const H = host.replace(/^www\./, '');
    // NOTE: a <base href> is injected for assets, so relative URLs resolve to the target site.
    // Therefore all of OUR navigation URLs must be ABSOLUTE on location.origin (otherwise they'd
    // resolve against the target host, e.g. upqode.com/api/markup/proxy — which 404s/refuses).
    const navScript = '<script>(function(){var H=' + JSON.stringify(H) + ';' +
      'function pbase(){var u=new URL(location.href);u.searchParams.delete("url");return location.origin+u.pathname+"?"+u.searchParams.toString();}' +
      'function toProxy(href){var d;try{d=new URL(href,location.href);}catch(_){return null;}if(d.origin===location.origin)return null;if(d.host.replace(/^www\\./,"")===H)return pbase()+"&url="+encodeURIComponent(d.href);return null;}' +
      'document.addEventListener("click",function(e){if(window.__markupCommentMode)return;var a=e.target&&e.target.closest&&e.target.closest("a");if(!a)return;var href=a.href;if(!href||href.indexOf("javascript:")===0||href.indexOf("mailto:")===0||href.indexOf("tel:")===0)return;' +
      'var d;try{d=new URL(href,location.href);}catch(_){return;}if(d.origin===location.origin)return;var p=toProxy(href);if(p){e.preventDefault();location.href=p;}else{e.preventDefault();window.open(d.href,"_blank");}},true);' +
      'try{var _a=window.location.assign.bind(window.location);window.location.assign=function(u){var p=toProxy(u);return _a(p||u);};}catch(_){}' +
      'try{var _r=window.location.replace.bind(window.location);window.location.replace=function(u){var p=toProxy(u);return _r(p||u);};}catch(_){}' +
      'try{var _o=window.open;window.open=function(u,n,f){var p=toProxy(u);return _o.call(window,p||u,n,f);};}catch(_){}' +
      '})();</script>';
    if (/<head[^>]*>/i.test(html)) html = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    else html = baseTag + html;
    if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${navScript}</body>`); else html += navScript;
    res.removeHeader && res.removeHeader('X-Frame-Options');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.send(html);
  } catch (e: any) {
    res.status(502).send('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;color:#888;padding:40px">Could not load this site through the proxy. Some sites block embedding.</body>');
  }
}

/* Public, no-auth access by share link. Anyone with the project id can view the
   versions and pages, and leave comments with just their name. */
export const markupPublicRouter = Router();
markupPublicRouter.get('/projects/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, type FROM markup_projects WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
  res.json({ id: rows[0].id, name: rows[0].name, type: rows[0].type, readOnly: true });
});
markupPublicRouter.get('/projects/:id/versions', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM markup_versions WHERE project_id = $1 ORDER BY created_at ASC', [req.params.id]);
  res.json(rows.map(versionToApi));
});
markupPublicRouter.get('/versions/:vid/comments', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM markup_comments WHERE version_id = $1 ORDER BY created_at ASC', [req.params.vid]);
  res.json(rows.map(commentApi));
});
markupPublicRouter.get('/projects/:id/comments', async (req, res) => {
  const { rows } = await pool.query(projectCommentsQuery, [req.params.id]);
  res.json(rows.map(withVersionLabel));
});
markupPublicRouter.post('/comments/:cid/replies', async (req, res) => {
  const { rows: cm } = await pool.query('SELECT id FROM markup_comments WHERE id = $1', [req.params.cid]);
  if (!cm[0]) return res.status(404).json({ error: 'Comment not found' });
  const b = req.body || {};
  if (!String(b.text || '').trim() && !(b.drawing || []).length) return res.status(400).json({ error: 'Empty reply' });
  const reply = mkReply(b.author, b.text, { priority: b.priority, drawing: b.drawing, mentions: b.mentions }); // public: no attachments
  const { rows } = await pool.query('UPDATE markup_comments SET replies = replies || $1::jsonb WHERE id = $2 RETURNING *', [JSON.stringify([reply]), req.params.cid]);
  res.status(201).json(commentApi(rows[0]));
});
markupPublicRouter.post('/versions/:vid/comments', async (req: any, res) => {
  const { rows: v } = await pool.query('SELECT project_id FROM markup_versions WHERE id = $1', [req.params.vid]);
  if (!v[0]) return res.status(404).json({ error: 'Version not found' });
  const { page = '', x = 0, y = 0, text = '', author = '', priority = 'none', drawing = [], attachments = [], device = 'desktop', mentions = [], anchor = {}, type = 'other', scope = 'element', desiredValue = '', screenshot = '' } = req.body || {};
  const name = String(author || 'Guest').slice(0, 120);
  if (!String(text).trim()) return res.status(400).json({ error: 'Empty comment' });
  const pr = PRIORITIES.includes(priority) ? priority : 'none';
  const dv = DEVICES.includes(device) ? device : 'desktop';
  const { rows } = await pool.query(
    `INSERT INTO markup_comments (project_id, version_id, user_id, page, x, y, text, author, priority, drawing, attachments, device, mentions, anchor, type, scope, desired_value, screenshot) VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
    [v[0].project_id, req.params.vid, String(page).slice(0, 500), Number(x) || 0, Number(y) || 0, String(text).slice(0, 4000), name, pr, JSON.stringify(cleanDrawing(drawing)), JSON.stringify(cleanAttachments(attachments)), dv, JSON.stringify(cleanMentions(mentions)), JSON.stringify(cleanAnchor(anchor)), cleanType(type), cleanScope(scope), String(desiredValue || '').slice(0, 1000), saveScreenshot(screenshot)]
  );
  res.status(201).json(commentApi(rows[0]));
});

// File attachments are not available to anonymous (public share-link) users.
markupPublicRouter.post('/attachments', (_req, res) => {
  res.status(403).json({ error: 'Sign in to attach files.' });
});

export const markupRouter = Router();
markupRouter.use(requireAuth);

const toApi = (r: any) => ({
  id: r.id, name: r.name, type: r.type, url: r.url, pages: r.pages,
  archived: r.archived, completed: r.completed,
  role: r.role || 'owner',
  shared: r.role && r.role !== 'owner',
  acProjectId: r.ac_project_id || '',
  acProjectName: r.ac_project_name || '',
  acTasks: r.ac_tasks || {},
  styles: r.styles || {},
  screenshot: r.screenshot || '',
  commentCount: r.comment_count != null ? Number(r.comment_count) : undefined,
  resolvedCount: r.resolved_count != null ? Number(r.resolved_count) : undefined,
  createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime(),
});

// 'owner' | 'pm' | 'production' | 'client' | 'editor' | 'viewer' | null. Team co-members
// (sharing a team with the project owner) get access with their team role.
async function accessRole(id: string, userId: string): Promise<string | null> {
  const owned = await pool.query('SELECT 1 FROM markup_projects WHERE id = $1 AND user_id = $2', [id, userId]);
  if (owned.rows[0]) return 'owner';
  const m = await pool.query('SELECT role FROM markup_members WHERE project_id = $1 AND user_id = $2', [id, userId]);
  if (m.rows[0]?.role) return m.rows[0].role;
  // Team-wide access is only for PMs; clients/production need explicit project shares.
  const team = await pool.query(
    `SELECT mine.role
       FROM markup_projects p
       JOIN team_members owner_m ON owner_m.user_id = p.user_id
       JOIN team_members mine ON mine.team_id = owner_m.team_id AND mine.user_id = $2
      WHERE p.id = $1 AND mine.role = 'pm' LIMIT 1`,
    [id, userId]
  );
  return team.rows[0]?.role || null;
}

const versionToApi = (v: any) => ({ id: v.id, label: v.label, type: v.type, url: v.url, pages: v.pages, screenshot: v.screenshot || '', createdAt: new Date(v.created_at).getTime() });

// Unzip a ZIP buffer into MARKUP_DIR/<versionId>/ and return the list of HTML pages.
function unzipToVersion(versionId: string, buf: Buffer): { path: string; title: string }[] {
  const dest = path.join(MARKUP_DIR, versionId);
  fs.mkdirSync(dest, { recursive: true });
  const zip = new AdmZip(buf);
  for (const e of zip.getEntries()) {
    if (e.isDirectory) continue;
    const rel = e.entryName.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!rel || rel.includes('..') || rel.includes('__MACOSX/')) continue;
    const target = path.join(dest, rel);
    if (!target.startsWith(dest + path.sep)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, e.getData());
  }
  const pages: { path: string; title: string }[] = [];
  const walk = (dir: string, base = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { if (entry.name !== '__MACOSX') walk(path.join(dir, entry.name), rel); }
      else if (/\.html?$/i.test(entry.name)) {
        let title = '';
        try { const html = fs.readFileSync(path.join(dir, entry.name), 'utf8'); title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim(); } catch {}
        if (!title) title = entry.name.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        pages.push({ path: rel, title });
      }
    }
  };
  walk(dest);
  if (!pages.length) { fs.rmSync(dest, { recursive: true, force: true }); throw new Error('No HTML pages found in the ZIP.'); }
  pages.sort((a, b) => {
    const ai = /(^|\/)index\.html?$/i.test(a.path) ? 0 : 1;
    const bi = /(^|\/)index\.html?$/i.test(b.path) ? 0 : 1;
    return ai - bi || a.path.localeCompare(b.path);
  });
  return pages;
}

// Create a new version for a project (url or zip). For zip, `buf` is required.
async function createVersion(projectId: string, opts: { type: string; url?: string; buf?: Buffer }) {
  const cnt = await pool.query('SELECT count(*)::int AS n FROM markup_versions WHERE project_id = $1', [projectId]);
  const label = `v${cnt.rows[0].n + 1}`;
  const ins = await pool.query(
    `INSERT INTO markup_versions (project_id, label, type, url, pages) VALUES ($1,$2,$3,$4,'[]'::jsonb) RETURNING *`,
    [projectId, label, opts.type, opts.url || '']
  );
  const v = ins.rows[0];
  if (opts.type === 'zip' && opts.buf) {
    const pages = unzipToVersion(v.id, opts.buf); // throws if no pages
    const upd = await pool.query('UPDATE markup_versions SET pages = $1 WHERE id = $2 RETURNING *', [JSON.stringify(pages), v.id]);
    return upd.rows[0];
  }
  if (opts.type === 'url' && opts.url) captureScreenshot(v.id, opts.url); // background, best-effort
  return v;
}

function decodeZip(zipBase64: any): Buffer {
  const buf = Buffer.from(String(zipBase64 || '').split(',').pop() || '', 'base64');
  if (!buf.length) throw new Error('Empty file.');
  return buf;
}

const touchProject = (id: string) => pool.query('UPDATE markup_projects SET updated_at = now() WHERE id = $1', [id]);

/* ----------------------------- reusable service layer ----------------------------- *
 * Shared by the HTTP routes AND the MCP server, so both behave identically.
 * ------------------------------------------------------------------------------- */
const LIST_PROJECTS_SQL = `SELECT p.*,
       CASE WHEN p.user_id = $1 THEN 'owner'
            WHEN m.role IS NOT NULL THEN m.role
            ELSE (SELECT mine.role FROM team_members om JOIN team_members mine ON mine.team_id = om.team_id AND mine.user_id = $1 WHERE om.user_id = p.user_id AND mine.role = 'pm' LIMIT 1)
       END AS role,
       (SELECT v.screenshot FROM markup_versions v WHERE v.project_id = p.id ORDER BY v.created_at DESC LIMIT 1) AS screenshot,
       (SELECT count(*) FROM markup_comments c WHERE c.project_id = p.id) AS comment_count,
       (SELECT count(*) FROM markup_comments c WHERE c.project_id = p.id AND c.resolved) AS resolved_count
       FROM markup_projects p
       LEFT JOIN markup_members m ON m.project_id = p.id AND m.user_id = $1
      WHERE p.user_id = $1 OR m.user_id = $1
         OR EXISTS (SELECT 1 FROM team_members om JOIN team_members mine ON mine.team_id = om.team_id AND mine.user_id = $1 WHERE om.user_id = p.user_id AND mine.role = 'pm')
      ORDER BY p.updated_at DESC`;

export const markupAccessRole = (id: string, userId: string) => accessRole(id, userId);
export const markupProjectApi = (r: any) => toApi(r);
export const markupVersionApi = (v: any) => versionToApi(v);
export const markupCommentToApi = (c: any) => commentApi(c);
export const markupDecodeZip = (b64: any) => decodeZip(b64);

function normalizeUrl(raw: any): string {
  let url = String(raw || '').trim();
  if (!url) throw new Error('A site URL is required.');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); } catch { throw new Error('Invalid URL.'); }
  return url;
}

// Create a markup project from a live URL (also creates version v1). Returns the API shape.
export async function mkCreateUrlProject(userId: string, name: string, rawUrl: string) {
  const url = normalizeUrl(rawUrl);
  let host = url; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
  const { rows } = await pool.query(
    `INSERT INTO markup_projects (user_id, name, type, url, pages) VALUES ($1,$2,'url',$3,'[]'::jsonb) RETURNING *`,
    [userId, String(name || host || 'Markup').slice(0, 120), url]
  );
  await createVersion(rows[0].id, { type: 'url', url });
  return toApi(rows[0]);
}

// Create a markup project from an uploaded static-site ZIP buffer (also creates v1).
export async function mkCreateZipProject(userId: string, name: string, buf: Buffer) {
  const { rows } = await pool.query(
    `INSERT INTO markup_projects (user_id, name, type, url, pages) VALUES ($1,$2,'zip','','[]'::jsonb) RETURNING *`,
    [userId, String(name || 'Markup upload').slice(0, 120)]
  );
  try { await createVersion(rows[0].id, { type: 'zip', buf }); return toApi(rows[0]); }
  catch (e) { await pool.query('DELETE FROM markup_projects WHERE id = $1', [rows[0].id]).catch(() => {}); throw e; }
}

// Create a blank Design project: a ZIP-type version with a single empty index.html.
export async function mkCreateBlankProject(userId: string, name: string) {
  const { rows } = await pool.query(
    `INSERT INTO markup_projects (user_id, name, type, url, pages) VALUES ($1,$2,'zip','','[]'::jsonb) RETURNING *`,
    [userId, String(name || 'Untitled design').slice(0, 120)]
  );
  const proj = rows[0];
  try {
    const cnt = await pool.query('SELECT count(*)::int AS n FROM markup_versions WHERE project_id = $1', [proj.id]);
    const ins = await pool.query(
      `INSERT INTO markup_versions (project_id, label, type, url, pages) VALUES ($1,$2,'zip','','[]'::jsonb) RETURNING *`,
      [proj.id, `v${cnt.rows[0].n + 1}`]
    );
    const v = ins.rows[0];
    const dir = path.join(MARKUP_DIR, v.id);
    fs.mkdirSync(dir, { recursive: true });
    const html = '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Home</title></head><body></body></html>';
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
    await pool.query('UPDATE markup_versions SET pages = $1 WHERE id = $2', [JSON.stringify([{ path: 'index.html', title: 'Home' }]), v.id]);
    return toApi(proj);
  } catch (e) {
    await pool.query('DELETE FROM markup_projects WHERE id = $1', [proj.id]).catch(() => {});
    throw e;
  }
}

export async function mkAddUrlVersion(projectId: string, rawUrl: string) {
  const url = normalizeUrl(rawUrl);
  const v = await createVersion(projectId, { type: 'url', url });
  await touchProject(projectId);
  return versionToApi(v);
}
export async function mkAddZipVersion(projectId: string, buf: Buffer) {
  const v = await createVersion(projectId, { type: 'zip', buf });
  await touchProject(projectId);
  return versionToApi(v);
}

// Replace the CURRENT (latest) version's content in place — swaps the HTML (URL or ZIP)
// while keeping the same version row and its existing comments. If the project has no
// version yet, a first one is created instead.
export async function mkReplaceCurrentVersion(projectId: string, opts: { type: string; url?: string; buf?: Buffer }) {
  const { rows } = await pool.query('SELECT * FROM markup_versions WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1', [projectId]);
  const cur = rows[0];
  if (!cur) { const v = await createVersion(projectId, opts); await touchProject(projectId); return versionToApi(v); }
  if (opts.type === 'zip' && opts.buf) {
    fs.rmSync(path.join(MARKUP_DIR, cur.id), { recursive: true, force: true }); // drop old extracted files
    const pages = unzipToVersion(cur.id, opts.buf); // throws if no HTML pages
    const upd = await pool.query("UPDATE markup_versions SET type = 'zip', url = '', pages = $1, screenshot = NULL WHERE id = $2 RETURNING *", [JSON.stringify(pages), cur.id]);
    await touchProject(projectId);
    return versionToApi(upd.rows[0]);
  }
  const url = normalizeUrl(opts.url);
  const upd = await pool.query("UPDATE markup_versions SET type = 'url', url = $1, pages = '[]'::jsonb, screenshot = NULL WHERE id = $2 RETURNING *", [url, cur.id]);
  captureScreenshot(cur.id, url); // background, best-effort
  await touchProject(projectId);
  return versionToApi(upd.rows[0]);
}

// list projects a user can see (owned + shared + PM-team), with role + counts
export async function mkListProjects(userId: string) {
  const { rows } = await pool.query(LIST_PROJECTS_SQL, [userId]);
  return rows.map(toApi);
}
// one project (row + role) or null
export async function mkGetProjectRow(userId: string, id: string) {
  const role = await accessRole(id, userId);
  if (!role) return null;
  const { rows } = await pool.query('SELECT * FROM markup_projects WHERE id = $1', [id]);
  return rows[0] ? { ...rows[0], role } : null;
}
export async function mkRenameProject(id: string, name: string) {
  const { rows } = await pool.query('UPDATE markup_projects SET name = $1, updated_at = now() WHERE id = $2 RETURNING *', [String(name).slice(0, 120), id]);
  return rows[0] ? toApi(rows[0]) : null;
}
export async function mkSetStatus(id: string, patch: { archived?: boolean; completed?: boolean }) {
  const sets: string[] = []; const vals: any[] = []; let i = 1;
  if (typeof patch.archived === 'boolean') { sets.push(`archived = $${i++}`); vals.push(patch.archived); }
  if (typeof patch.completed === 'boolean') { sets.push(`completed = $${i++}`); vals.push(patch.completed); }
  if (!sets.length) throw new Error('Nothing to update.');
  vals.push(id);
  const { rows } = await pool.query(`UPDATE markup_projects SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`, vals);
  return rows[0] ? toApi(rows[0]) : null;
}
export async function mkDuplicateProject(userId: string, id: string) {
  const { rows: src } = await pool.query('SELECT * FROM markup_projects WHERE id = $1', [id]);
  const s = src[0]; if (!s) throw new Error('Project not found.');
  const { rows } = await pool.query(
    `INSERT INTO markup_projects (user_id, name, type, url, pages) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, `${s.name} copy`, s.type, s.url, JSON.stringify(s.pages)]
  );
  const newId = rows[0].id;
  const { rows: versions } = await pool.query('SELECT * FROM markup_versions WHERE project_id = $1 ORDER BY created_at ASC', [id]);
  for (const v of versions) {
    const nv = await pool.query(`INSERT INTO markup_versions (project_id, label, type, url, pages) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [newId, v.label, v.type, v.url, JSON.stringify(v.pages)]);
    if (v.type === 'zip') { try { fs.cpSync(path.join(MARKUP_DIR, v.id), path.join(MARKUP_DIR, nv.rows[0].id), { recursive: true }); } catch (e) {} }
  }
  return toApi(rows[0]);
}
// owner deletes (with files); a member just leaves
export async function mkDeleteProject(userId: string, id: string, role: string) {
  if (role === 'owner') {
    const { rows: versions } = await pool.query('SELECT id FROM markup_versions WHERE project_id = $1', [id]);
    await pool.query('DELETE FROM markup_projects WHERE id = $1', [id]);
    for (const v of versions) fs.rmSync(path.join(MARKUP_DIR, v.id), { recursive: true, force: true });
    fs.rmSync(path.join(MARKUP_DIR, id), { recursive: true, force: true });
  } else {
    await pool.query('DELETE FROM markup_members WHERE project_id = $1 AND user_id = $2', [id, userId]);
  }
}
export async function mkListVersions(id: string) {
  const { rows } = await pool.query('SELECT * FROM markup_versions WHERE project_id = $1 ORDER BY created_at ASC', [id]);
  return rows.map(versionToApi);
}
// Save edited HTML for a page of a ZIP-type version (Design module). Writes the file
// back to disk under MARKUP_DIR/<versionId>/<relPath>, with strict path-safety.
export async function mkSaveVersionPage(versionId: string, relPath: string, html: string) {
  const { rows } = await pool.query('SELECT * FROM markup_versions WHERE id = $1', [versionId]);
  const v = rows[0];
  if (!v) throw new Error('Version not found.');
  if (v.type !== 'zip') throw new Error('Design editing is available for uploaded HTML/ZIP versions only (not live URL versions).');
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel || rel.includes('..') || !/\.html?$/i.test(rel)) throw new Error('Invalid page path.');
  const dir = path.join(MARKUP_DIR, versionId);
  const target = path.join(dir, rel);
  if (!target.startsWith(dir + path.sep)) throw new Error('Invalid page path.');
  if (!fs.existsSync(target)) throw new Error('Page not found in this version.');
  if (typeof html !== 'string' || !html.trim()) throw new Error('Empty HTML.');
  if (html.length > 8 * 1024 * 1024) throw new Error('HTML too large (max 8MB).');
  fs.writeFileSync(target, html, 'utf8');
  await touchProject(v.project_id);
  return { ok: true, path: rel };
}

// Create a NEW page file in a ZIP version and register it in the version's pages list.
export async function mkCreateVersionPage(versionId: string, relPathIn: string, title: string, html: string) {
  const { rows } = await pool.query('SELECT * FROM markup_versions WHERE id = $1', [versionId]);
  const v = rows[0];
  if (!v) throw new Error('Version not found.');
  if (v.type !== 'zip') throw new Error('New pages can be added to uploaded HTML/ZIP versions only.');
  let rel = String(relPathIn || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!rel) throw new Error('Page name is required.');
  if (!/\.html?$/i.test(rel)) rel += '.html';
  if (rel.includes('..') || !/^[a-zA-Z0-9._/-]+$/.test(rel)) throw new Error('Invalid page name. Use letters, numbers, “-” and “_”.');
  const dir = path.join(MARKUP_DIR, versionId);
  const target = path.join(dir, rel);
  if (!target.startsWith(dir + path.sep)) throw new Error('Invalid page path.');
  if (fs.existsSync(target)) throw new Error('A page with this name already exists.');
  if (typeof html !== 'string' || !html.trim()) throw new Error('Empty HTML.');
  if (html.length > 8 * 1024 * 1024) throw new Error('HTML too large (max 8MB).');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html, 'utf8');
  const pages: { path: string; title: string }[] = Array.isArray(v.pages) ? v.pages.slice() : [];
  const ttl = String(title || rel).slice(0, 200);
  if (!pages.some((p) => p.path === rel)) pages.push({ path: rel, title: ttl });
  await pool.query('UPDATE markup_versions SET pages = $1 WHERE id = $2', [JSON.stringify(pages), versionId]);
  await touchProject(v.project_id);
  return { ok: true, path: rel, title: ttl, pages };
}

// Update a page's metadata (title), rename its file (slug), and/or mark it as Home.
export async function mkUpdatePage(versionId: string, pathIn: string, opts: { title?: string; newPath?: string; home?: boolean }) {
  const { rows } = await pool.query('SELECT * FROM markup_versions WHERE id = $1', [versionId]);
  const v = rows[0];
  if (!v) throw new Error('Version not found.');
  if (v.type !== 'zip') throw new Error('Page operations need an uploaded HTML/ZIP version.');
  const rel = String(pathIn || '').replace(/\\/g, '/').replace(/^\/+/, '');
  let pages: any[] = Array.isArray(v.pages) ? v.pages.slice() : [];
  const i = pages.findIndex((p) => p.path === rel);
  if (i < 0) throw new Error('Page not found.');
  const dir = path.join(MARKUP_DIR, versionId);
  if (opts.newPath && opts.newPath !== rel) {
    let np = String(opts.newPath).replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!/\.html?$/i.test(np)) np += '.html';
    if (np.includes('..') || !/^[a-zA-Z0-9._/-]+$/.test(np)) throw new Error('Invalid page path.');
    const to = path.join(dir, np); const from = path.join(dir, rel);
    if (!to.startsWith(dir + path.sep)) throw new Error('Invalid page path.');
    if (pages.some((p) => p.path === np) || fs.existsSync(to)) throw new Error('A page with this path already exists.');
    if (fs.existsSync(from)) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.renameSync(from, to); }
    pages[i] = { ...pages[i], path: np };
  }
  if (typeof opts.title === 'string') pages[i] = { ...pages[i], title: opts.title.slice(0, 200) };
  if (opts.home === true) pages = pages.map((p, k) => ({ ...p, home: k === i }));
  await pool.query('UPDATE markup_versions SET pages = $1 WHERE id = $2', [JSON.stringify(pages), versionId]);
  await touchProject(v.project_id);
  return { ok: true, pages, path: pages[i].path };
}

// Duplicate a page (file + pages entry).
export async function mkDuplicatePage(versionId: string, pathIn: string) {
  const { rows } = await pool.query('SELECT * FROM markup_versions WHERE id = $1', [versionId]);
  const v = rows[0];
  if (!v) throw new Error('Version not found.');
  if (v.type !== 'zip') throw new Error('Page operations need an uploaded HTML/ZIP version.');
  const rel = String(pathIn || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const pages: any[] = Array.isArray(v.pages) ? v.pages.slice() : [];
  const i = pages.findIndex((p) => p.path === rel);
  if (i < 0) throw new Error('Page not found.');
  const dir = path.join(MARKUP_DIR, versionId);
  const from = path.join(dir, rel);
  if (!fs.existsSync(from)) throw new Error('Page file missing.');
  const ext = (rel.match(/\.html?$/i) || ['.html'])[0];
  const base = rel.replace(/\.html?$/i, '');
  let np = base + '-copy' + ext; let n = 2;
  while (pages.some((p) => p.path === np) || fs.existsSync(path.join(dir, np))) { np = base + '-copy-' + n + ext; n++; }
  fs.copyFileSync(from, path.join(dir, np));
  pages.splice(i + 1, 0, { path: np, title: String((pages[i].title || rel) + ' copy').slice(0, 200) });
  await pool.query('UPDATE markup_versions SET pages = $1 WHERE id = $2', [JSON.stringify(pages), versionId]);
  await touchProject(v.project_id);
  return { ok: true, pages, path: np };
}

// Delete a page (file + pages entry). Refuses to delete the last remaining page.
export async function mkDeletePage(versionId: string, pathIn: string) {
  const { rows } = await pool.query('SELECT * FROM markup_versions WHERE id = $1', [versionId]);
  const v = rows[0];
  if (!v) throw new Error('Version not found.');
  if (v.type !== 'zip') throw new Error('Page operations need an uploaded HTML/ZIP version.');
  const rel = String(pathIn || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const pages: any[] = Array.isArray(v.pages) ? v.pages.slice() : [];
  if (pages.length <= 1) throw new Error('Cannot delete the only page.');
  const i = pages.findIndex((p) => p.path === rel);
  if (i < 0) throw new Error('Page not found.');
  const dir = path.join(MARKUP_DIR, versionId);
  const target = path.join(dir, rel);
  if (target.startsWith(dir + path.sep) && fs.existsSync(target)) { try { fs.rmSync(target); } catch (e) { /* ignore */ } }
  pages.splice(i, 1);
  await pool.query('UPDATE markup_versions SET pages = $1 WHERE id = $2', [JSON.stringify(pages), versionId]);
  await touchProject(v.project_id);
  return { ok: true, pages };
}

// Package a version's static files into a ZIP (base64) so it can be downloaded / worked with.
// ZIP-type versions return their stored files; URL versions have no local files (return the URL).
export async function mkExportVersionZip(versionId: string) {
  const { rows } = await pool.query('SELECT * FROM markup_versions WHERE id = $1', [versionId]);
  const v = rows[0];
  if (!v) throw new Error('Version not found.');
  if (v.type === 'url') {
    return { type: 'url', label: v.label, url: v.url, message: 'This is a URL version (live website) — there are no stored files to zip. Fetch the URL to work with it.' };
  }
  const dir = path.join(MARKUP_DIR, versionId);
  if (!fs.existsSync(dir)) throw new Error('No files found for this version.');
  const zip = new AdmZip();
  zip.addLocalFolder(dir);
  const buf = zip.toBuffer();
  return { type: 'zip', label: v.label, filename: `${String(v.label || 'version').replace(/[^a-zA-Z0-9._-]/g, '_')}.zip`, mime: 'application/zip', size: buf.length, base64: buf.toString('base64'), pages: (v.pages || []).length };
}
/* ----------------------------- chunked uploads ----------------------------- *
 * Reliable big-file uploads for the MCP: a base64 ZIP is sent in many small
 * chunks instead of one huge payload (which fails / is unreliable for an AI).
 * begin -> chunk x N -> take(assemble). Sessions live on disk + an in-memory map.
 * --------------------------------------------------------------------------- */
const UPLOAD_DIR = path.join(MARKUP_DIR, '_uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const uploadSessions = new Map<string, { userId: string; file: string; bytes: number; createdAt: number }>();
const UPLOAD_MAX = 100 * 1024 * 1024; // 100MB assembled cap

function sweepUploads() {
  const cutoff = Date.now() - 60 * 60 * 1000; // drop sessions older than 1h
  for (const [id, s] of uploadSessions) {
    if (s.createdAt < cutoff) { try { fs.rmSync(s.file, { force: true }); } catch {} uploadSessions.delete(id); }
  }
}

export function mkUploadBegin(userId: string) {
  sweepUploads();
  const uploadId = randomUUID();
  const file = path.join(UPLOAD_DIR, uploadId + '.part');
  fs.writeFileSync(file, Buffer.alloc(0));
  uploadSessions.set(uploadId, { userId, file, bytes: 0, createdAt: Date.now() });
  return { uploadId };
}
export function mkUploadChunk(userId: string, uploadId: string, dataBase64: string) {
  const s = uploadSessions.get(uploadId);
  if (!s || s.userId !== userId) throw new Error('Upload session not found (call markup_upload_begin first).');
  const b64 = String(dataBase64 || '').split(',').pop() || '';
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length) throw new Error('Empty chunk.');
  if (s.bytes + buf.length > UPLOAD_MAX) { try { fs.rmSync(s.file, { force: true }); } catch {} uploadSessions.delete(uploadId); throw new Error('Upload too large (max 100MB).'); }
  fs.appendFileSync(s.file, buf);
  s.bytes += buf.length;
  return { ok: true, bytes: s.bytes };
}
export function mkUploadTake(userId: string, uploadId: string): Buffer {
  const s = uploadSessions.get(uploadId);
  if (!s || s.userId !== userId) throw new Error('Upload session not found (call markup_upload_begin first).');
  const buf = fs.readFileSync(s.file);
  try { fs.rmSync(s.file, { force: true }); } catch {}
  uploadSessions.delete(uploadId);
  if (!buf.length) throw new Error('No data uploaded — send chunks with markup_upload_chunk before finishing.');
  return buf;
}

// Fastest path when the MCP client runs on the SAME machine: the server reads the .zip
// straight off disk by absolute path — no base64 through the model at all (instant).
export function mkReadZipFromPath(p: string): Buffer {
  const fp = String(p || '').trim();
  if (!fp) throw new Error('Provide an absolute file path to a .zip.');
  if (!path.isAbsolute(fp)) throw new Error('Use an absolute file path (e.g. /Users/you/site.zip).');
  if (!/\.zip$/i.test(fp)) throw new Error('Path must point to a .zip file.');
  let st: fs.Stats;
  try { st = fs.statSync(fp); } catch { throw new Error('No file found at that path.'); }
  if (!st.isFile()) throw new Error('Path is not a file.');
  if (st.size > 100 * 1024 * 1024) throw new Error('ZIP too large (max 100MB).');
  return fs.readFileSync(fp);
}

// Fastest + safe path: backend downloads a ZIP directly from a URL (one call, no base64).
export async function mkFetchZipBuffer(rawUrl: string): Promise<Buffer> {
  const url = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('Provide an http(s) URL to a .zip file.');
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 60000);
  let r: any;
  try { r = await fetch(url, { signal: ctrl.signal, redirect: 'follow' }); }
  catch { clearTimeout(to); throw new Error('Could not download the ZIP (timeout or network).'); }
  clearTimeout(to);
  if (!r.ok) throw new Error(`Download failed (HTTP ${r.status}).`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length) throw new Error('Downloaded file is empty.');
  if (buf.length > 100 * 1024 * 1024) throw new Error('ZIP too large (max 100MB).');
  return buf;
}

export async function mkListProjectComments(id: string) {
  const { rows } = await pool.query(projectCommentsQuery, [id]);
  return rows.map(withVersionLabel);
}
export async function mkAddComment(versionId: string, projectId: string, userId: string | null, opts: any) {
  const pr = PRIORITIES.includes(opts.priority) ? opts.priority : 'none';
  const dv = DEVICES.includes(opts.device) ? opts.device : 'desktop';
  const { rows } = await pool.query(
    `INSERT INTO markup_comments (project_id, version_id, user_id, page, x, y, text, author, priority, drawing, attachments, device, mentions, anchor, type, scope, desired_value, screenshot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [projectId, versionId, userId, String(opts.page || '').slice(0, 500), Number(opts.x) || 0, Number(opts.y) || 0, String(opts.text || '').slice(0, 4000), String(opts.author || 'AI').slice(0, 120), pr, JSON.stringify(cleanDrawing(opts.drawing)), JSON.stringify(cleanAttachments(opts.attachments)), dv, JSON.stringify(cleanMentions(opts.mentions)), JSON.stringify(cleanAnchor(opts.anchor)), cleanType(opts.type), cleanScope(opts.scope), String(opts.desiredValue || '').slice(0, 1000), saveScreenshot(opts.screenshot)]
  );
  return commentApi(rows[0]);
}
export async function mkUpdateComment(cid: string, patch: any) {
  const sets: string[] = []; const vals: any[] = []; let i = 1;
  if (typeof patch.resolved === 'boolean') { sets.push(`resolved = $${i++}`); vals.push(patch.resolved); }
  if (typeof patch.priority === 'string' && PRIORITIES.includes(patch.priority)) { sets.push(`priority = $${i++}`); vals.push(patch.priority); }
  if (typeof patch.text === 'string') { sets.push(`text = $${i++}`); vals.push(patch.text.slice(0, 4000)); }
  if (!sets.length) throw new Error('Nothing to update.');
  vals.push(cid);
  const { rows } = await pool.query(`UPDATE markup_comments SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  return rows[0] ? commentApi(rows[0]) : null;
}
export async function mkDeleteComment(cid: string) {
  await pool.query('DELETE FROM markup_comments WHERE id = $1', [cid]);
}
// Append already-saved attachment metadata to an existing comment.
export async function mkAppendCommentAttachments(cid: string, newAtts: any[]) {
  const { rows } = await pool.query('SELECT attachments FROM markup_comments WHERE id = $1', [cid]);
  if (!rows[0]) throw new Error('Comment not found.');
  const merged = cleanAttachments([...(rows[0].attachments || []), ...(Array.isArray(newAtts) ? newAtts : [])]);
  const { rows: up } = await pool.query('UPDATE markup_comments SET attachments = $1 WHERE id = $2 RETURNING *', [JSON.stringify(merged), cid]);
  return commentApi(up[0]);
}
export async function mkProjectOfComment(cid: string) {
  const { rows } = await pool.query('SELECT project_id FROM markup_comments WHERE id = $1', [cid]);
  return rows[0]?.project_id || null;
}
export async function mkProjectOfVersion(vid: string) {
  const { rows } = await pool.query('SELECT project_id FROM markup_versions WHERE id = $1', [vid]);
  return rows[0]?.project_id || null;
}

/* ----------------------------- projects ----------------------------- */

// list — owned + shared
markupRouter.get('/projects', async (req: AuthedRequest, res: Response) => {
  res.json(await mkListProjects(req.userId!));
});

// create a project from a live URL (also creates version v1)
markupRouter.post('/projects', async (req: AuthedRequest, res: Response) => {
  try { res.status(201).json(await mkCreateUrlProject(req.userId!, req.body?.name, req.body?.url)); }
  catch (e: any) { res.status(400).json({ error: e?.message || 'Could not create project.' }); }
});

// create a project from an uploaded static ZIP (also creates version v1)
markupRouter.post('/projects/upload', async (req: AuthedRequest, res: Response) => {
  if (!req.body?.zipBase64) return res.status(400).json({ error: 'No file received.' });
  let buf: Buffer;
  try { buf = decodeZip(req.body.zipBase64); } catch { return res.status(400).json({ error: 'Could not read the file.' }); }
  try { res.status(201).json(await mkCreateZipProject(req.userId!, req.body?.name, buf)); }
  catch (e: any) { res.status(400).json({ error: e?.message || 'Could not unpack the ZIP. Make sure it is a static site export.' }); }
});

// create a blank Design project (empty index.html)
markupRouter.post('/projects/blank', async (req: AuthedRequest, res: Response) => {
  try { res.status(201).json(await mkCreateBlankProject(req.userId!, req.body?.name)); }
  catch (e: any) { res.status(400).json({ error: e?.message || 'Could not create the design.' }); }
});

/* ----------------------------- versions ----------------------------- */

markupRouter.get('/projects/:id/versions', async (req: AuthedRequest, res: Response) => {
  if (!(await accessRole(req.params.id, req.userId!))) return res.status(404).json({ error: 'Project not found' });
  const { rows } = await pool.query('SELECT * FROM markup_versions WHERE project_id = $1 ORDER BY created_at ASC', [req.params.id]);
  res.json(rows.map(versionToApi));
});

// add a URL version
markupRouter.post('/projects/:id/versions', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  if (role === 'viewer') return res.status(403).json({ error: 'You have view-only access' });
  const replace = req.body?.mode === 'current' || req.body?.replace === true;
  try { res.status(201).json(replace ? await mkReplaceCurrentVersion(req.params.id, { type: 'url', url: req.body?.url }) : await mkAddUrlVersion(req.params.id, req.body?.url)); }
  catch (e: any) { res.status(400).json({ error: e?.message || 'Could not add version.' }); }
});

// add a ZIP version
markupRouter.post('/projects/:id/versions/upload', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  if (role === 'viewer') return res.status(403).json({ error: 'You have view-only access' });
  let buf: Buffer;
  try { buf = decodeZip(req.body?.zipBase64); } catch { return res.status(400).json({ error: 'Could not read the file.' }); }
  const replace = req.body?.mode === 'current' || req.body?.replace === true;
  try { res.status(201).json(replace ? await mkReplaceCurrentVersion(req.params.id, { type: 'zip', buf }) : await mkAddZipVersion(req.params.id, buf)); }
  catch (e: any) { res.status(400).json({ error: e?.message || 'Could not unpack the ZIP.' }); }
});

// Design module: save edited HTML for a page of a version. Body: { path, html }.
markupRouter.post('/versions/:vid/page', async (req: AuthedRequest, res: Response) => {
  const acc = await versionAccess(req.params.vid, req.userId!);
  if (!acc) return res.status(404).json({ error: 'Version not found' });
  if (acc.role === 'viewer') return res.status(403).json({ error: 'You have view-only access' });
  const t = await teamRoleOf(req.userId!);
  if (!['pm', 'production'].includes(t.role)) return res.status(403).json({ error: 'The Design editor is available to PM and Production roles only.' });
  try { res.json(await mkSaveVersionPage(req.params.vid, req.body?.path, req.body?.html)); }
  catch (e: any) { res.status(400).json({ error: e?.message || 'Could not save the page.' }); }
});

// Create a new page in a ZIP version (Design module). Body: { path, title, html }.
markupRouter.post('/versions/:vid/pages', async (req: AuthedRequest, res: Response) => {
  const acc = await versionAccess(req.params.vid, req.userId!);
  if (!acc) return res.status(404).json({ error: 'Version not found' });
  if (acc.role === 'viewer') return res.status(403).json({ error: 'You have view-only access' });
  const t = await teamRoleOf(req.userId!);
  if (!['pm', 'production'].includes(t.role)) return res.status(403).json({ error: 'The Design editor is available to PM and Production roles only.' });
  try { res.json(await mkCreateVersionPage(req.params.vid, req.body?.path, req.body?.title, req.body?.html)); }
  catch (e: any) { res.status(400).json({ error: e?.message || 'Could not create the page.' }); }
});

// Page operations (Design module): rename/settings, duplicate, delete. All PM/Production.
async function designGuard(req: AuthedRequest, res: Response): Promise<boolean> {
  const acc = await versionAccess(req.params.vid, req.userId!);
  if (!acc) { res.status(404).json({ error: 'Version not found' }); return false; }
  if (acc.role === 'viewer') { res.status(403).json({ error: 'You have view-only access' }); return false; }
  const t = await teamRoleOf(req.userId!);
  if (!['pm', 'production'].includes(t.role)) { res.status(403).json({ error: 'The Design editor is available to PM and Production roles only.' }); return false; }
  return true;
}
markupRouter.patch('/versions/:vid/page-meta', async (req: AuthedRequest, res: Response) => {
  if (!(await designGuard(req, res))) return;
  try { res.json(await mkUpdatePage(req.params.vid, req.body?.path, { title: req.body?.title, newPath: req.body?.newPath, home: req.body?.home })); }
  catch (e: any) { res.status(400).json({ error: e?.message || 'Could not update the page.' }); }
});
markupRouter.post('/versions/:vid/page-duplicate', async (req: AuthedRequest, res: Response) => {
  if (!(await designGuard(req, res))) return;
  try { res.json(await mkDuplicatePage(req.params.vid, req.body?.path)); }
  catch (e: any) { res.status(400).json({ error: e?.message || 'Could not duplicate the page.' }); }
});
markupRouter.post('/versions/:vid/page-delete', async (req: AuthedRequest, res: Response) => {
  if (!(await designGuard(req, res))) return;
  try { res.json(await mkDeletePage(req.params.vid, req.body?.path)); }
  catch (e: any) { res.status(400).json({ error: e?.message || 'Could not delete the page.' }); }
});

// (re)generate the screenshot for a URL version
markupRouter.post('/versions/:vid/screenshot', async (req: AuthedRequest, res: Response) => {
  const acc = await versionAccess(req.params.vid, req.userId!);
  if (!acc) return res.status(404).json({ error: 'Version not found' });
  const { rows } = await pool.query('SELECT * FROM markup_versions WHERE id = $1', [req.params.vid]);
  const v = rows[0];
  if (v.type !== 'url' || !v.url) return res.status(400).json({ error: 'Screenshots are only available for URL versions.' });
  await captureScreenshot(v.id, v.url);
  const { rows: u } = await pool.query('SELECT screenshot FROM markup_versions WHERE id = $1', [v.id]);
  res.json({ screenshot: u[0]?.screenshot || '' });
});

// get one (owner or shared)
markupRouter.get('/projects/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  const { rows } = await pool.query('SELECT * FROM markup_projects WHERE id = $1', [req.params.id]);
  res.json(toApi({ ...rows[0], role }));
});

// patch — name / archived / completed (owner or editor)
markupRouter.patch('/projects/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  if (role === 'viewer') return res.status(403).json({ error: 'You have view-only access' });
  const sets: string[] = []; const vals: any[] = []; let i = 1;
  if (typeof req.body?.name === 'string') { sets.push(`name = $${i++}`); vals.push(req.body.name.slice(0, 120)); }
  if (typeof req.body?.archived === 'boolean') { sets.push(`archived = $${i++}`); vals.push(req.body.archived); }
  if (typeof req.body?.completed === 'boolean') { sets.push(`completed = $${i++}`); vals.push(req.body.completed); }
  if (req.body?.styles && typeof req.body.styles === 'object') { sets.push(`styles = $${i++}::jsonb`); vals.push(JSON.stringify(req.body.styles)); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.params.id);
  const { rows } = await pool.query(`UPDATE markup_projects SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`, vals);
  res.json(toApi({ ...rows[0], role }));
});

// link an Active Collab project: verify the ID + cache its name. Empty clears it.
markupRouter.post('/projects/:id/activecollab', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  if (!canSyncAcRole(role)) return res.status(403).json({ error: 'Your role can’t configure Active Collab.' });
  if ((await teamRoleOf(req.userId!)).role !== 'pm') return res.status(403).json({ error: 'Only PM can assign an Active Collab project.' });
  const raw = String(req.body?.acProjectId || '').trim();
  const createName = String(req.body?.createName || '').trim();
  if (!raw && !createName) {
    const { rows } = await pool.query(`UPDATE markup_projects SET ac_project_id = '', ac_project_name = '', updated_at = now() WHERE id = $1 RETURNING *`, [req.params.id]);
    return res.json(toApi({ ...rows[0], role }));
  }
  const acToken = await userAcToken(req.userId!);
  let info;
  try { info = createName ? await createAcProject(acToken, createName) : await fetchAcProject(acToken, raw); }
  catch (e) { return res.status(400).json({ error: (e as Error).message }); }
  const { rows } = await pool.query(`UPDATE markup_projects SET ac_project_id = $1, ac_project_name = $2, updated_at = now() WHERE id = $3 RETURNING *`, [info.id, info.name, req.params.id]);
  res.json(toApi({ ...rows[0], role }));
});

// Sync ONE page → an AC task. Body: { pageKey, name, body, taskId? }. Saves the task
// id in ac_tasks[pageKey]. Returns { taskId, taskNumber }.
markupRouter.post('/projects/:id/ac/page', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  if (!canSyncAcRole(role)) return res.status(403).json({ error: 'Your role can’t sync with Active Collab.' });
  const { rows: pr } = await pool.query('SELECT ac_project_id FROM markup_projects WHERE id = $1', [req.params.id]);
  const acProjectId = pr[0]?.ac_project_id || '';
  if (!acProjectId) return res.status(400).json({ error: 'No Active Collab project assigned.' });
  const pageKey = String(req.body?.pageKey ?? '');
  const acToken = await userAcToken(req.userId!);
  try {
    const out = await syncAcTask(acToken, acProjectId, { name: req.body?.name, body: req.body?.body, taskId: req.body?.taskId });
    await pool.query(
      `UPDATE markup_projects SET ac_tasks = jsonb_set(coalesce(ac_tasks, '{}'::jsonb), ARRAY[$1], $2::jsonb), updated_at = now() WHERE id = $3`,
      [pageKey, JSON.stringify({ taskId: out.taskId, taskNumber: out.taskNumber }), req.params.id]
    );
    res.json(out);
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

// Sync ONE comment → an AC subtask under its page's task. Body: { taskId, body, subtaskId? }.
markupRouter.post('/comments/:cid/ac', async (req: AuthedRequest, res: Response) => {
  const { rows: cm } = await pool.query('SELECT project_id, ac_subtask_id FROM markup_comments WHERE id = $1', [req.params.cid]);
  if (!cm[0]) return res.status(404).json({ error: 'Comment not found' });
  const role = await accessRole(cm[0].project_id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  if (!canSyncAcRole(role)) return res.status(403).json({ error: 'Your role can’t sync with Active Collab.' });
  const { rows: pr } = await pool.query('SELECT ac_project_id FROM markup_projects WHERE id = $1', [cm[0].project_id]);
  const acProjectId = pr[0]?.ac_project_id || '';
  if (!acProjectId) return res.status(400).json({ error: 'No Active Collab project assigned.' });
  const taskId = String(req.body?.taskId || '').trim();
  if (!taskId) return res.status(400).json({ error: 'Sync the page first.' });
  const acToken = await userAcToken(req.userId!);
  try {
    const out = await syncAcSubtask(acToken, acProjectId, taskId, { body: req.body?.body, subtaskId: req.body?.subtaskId || cm[0].ac_subtask_id || '', completed: !!req.body?.completed });
    const { rows } = await pool.query('UPDATE markup_comments SET ac_subtask_id = $1, ac_subtask_number = $2 WHERE id = $3 RETURNING *', [out.subtaskId, out.subtaskNumber, req.params.cid]);
    res.json({ ...out, comment: commentApi(rows[0]) });
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

// duplicate — copy project + all its versions (and their unzipped files); owned by the requester
markupRouter.post('/projects/:id/duplicate', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  res.status(201).json(await mkDuplicateProject(req.userId!, req.params.id));
});

// delete (owner) — also removes files; members just leave
markupRouter.delete('/projects/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  await mkDeleteProject(req.userId!, req.params.id, role);
  res.status(204).end();
});

/* ----------------------------- sharing ----------------------------- */
markupRouter.get('/projects/:id/members', async (req: AuthedRequest, res: Response) => {
  if (!(await accessRole(req.params.id, req.userId!))) return res.status(404).json({ error: 'Project not found' });
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email, 'owner' AS role, false AS pending
       FROM markup_projects p JOIN users u ON u.id = p.user_id WHERE p.id = $1
     UNION ALL
     SELECT u.id AS user_id, u.name, u.email, m.role, false AS pending
       FROM markup_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = $1
     UNION ALL
     SELECT NULL AS user_id, i.email AS name, i.email, i.role, true AS pending
       FROM markup_invites i WHERE i.project_id = $1`,
    [req.params.id]
  );
  res.json(rows.map((r) => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role, pending: r.pending })));
});

markupRouter.post('/projects/:id/members', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can share this project' });
  const { email, role: memberRole = 'editor' } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const r = ['editor', 'viewer'].includes(memberRole) ? memberRole : 'editor';
  const cleanEmail = String(email).toLowerCase().trim();
  const { rows: users } = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
  const target = users[0];
  if (!target) {
    await pool.query(
      `INSERT INTO markup_invites (project_id, email, role) VALUES ($1,$2,$3)
       ON CONFLICT (project_id, email) DO UPDATE SET role = EXCLUDED.role`,
      [req.params.id, cleanEmail, r]
    );
    return res.status(201).json({ userId: null, name: cleanEmail, email: cleanEmail, role: r, pending: true });
  }
  const { rows: owner } = await pool.query('SELECT user_id FROM markup_projects WHERE id = $1', [req.params.id]);
  if (owner[0].user_id === target.id) return res.status(400).json({ error: 'That user already owns this project' });
  await pool.query(
    `INSERT INTO markup_members (project_id, user_id, role) VALUES ($1,$2,$3)
     ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [req.params.id, target.id, r]
  );
  res.status(201).json({ userId: target.id, name: target.name, email: target.email, role: r, pending: false });
});

markupRouter.delete('/projects/:id/members/:userId', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can manage sharing' });
  await pool.query('DELETE FROM markup_members WHERE project_id = $1 AND user_id = $2', [req.params.id, req.params.userId]);
  res.status(204).end();
});

markupRouter.delete('/projects/:id/invites/:email', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can manage sharing' });
  await pool.query('DELETE FROM markup_invites WHERE project_id = $1 AND email = $2', [req.params.id, decodeURIComponent(req.params.email).toLowerCase()]);
  res.status(204).end();
});

/* ----------------------------- comments (per version) ----------------------------- */

// look up the project a version belongs to + the user's role
async function versionAccess(versionId: string, userId: string): Promise<{ projectId: string; role: string } | null> {
  const { rows } = await pool.query('SELECT project_id FROM markup_versions WHERE id = $1', [versionId]);
  if (!rows[0]) return null;
  const role = await accessRole(rows[0].project_id, userId);
  return role ? { projectId: rows[0].project_id, role } : null;
}
const commentApi = (c: any) => ({ id: c.id, versionId: c.version_id, page: c.page, x: c.x, y: c.y, text: c.text, author: c.author, resolved: c.resolved, priority: c.priority || 'none', drawing: c.drawing || [], replies: c.replies || [], attachments: c.attachments || [], device: c.device || 'desktop', mentions: c.mentions || [], acSubtaskId: c.ac_subtask_id || '', acSubtaskNumber: c.ac_subtask_number || '', anchor: c.anchor || {}, type: c.type || 'other', scope: c.scope || 'element', desiredValue: c.desired_value || '', screenshot: c.screenshot || '', createdAt: new Date(c.created_at).getTime() });
const mkReply = (author: any, text: string, extra: any = {}) => ({
  id: Math.random().toString(36).slice(2, 10),
  author: String(author || 'Guest').slice(0, 120),
  text: String(text || '').slice(0, 4000),
  priority: PRIORITIES.includes(extra?.priority) ? extra.priority : 'none',
  drawing: cleanDrawing(extra?.drawing || []),
  attachments: cleanAttachments(extra?.attachments || []),
  mentions: cleanMentions(extra?.mentions || []),
  createdAt: Date.now(),
});
const PRIORITIES = ['none', 'low', 'medium', 'high'];
// returns a real ARRAY (caller stringifies for jsonb columns / nested objects)
const cleanDrawing = (d: any) => (Array.isArray(d) ? d.slice(0, 200) : []);
// @mention user ids — array of strings
const cleanMentions = (m: any) => (Array.isArray(m) ? m.slice(0, 50).map((x) => String(x).slice(0, 64)).filter(Boolean) : []);
// Element the pin sits on (captured at comment time) so an AI knows exactly what to fix.
const cleanAnchor = (a: any) => {
  if (!a || typeof a !== 'object') return {};
  const s = (v: any, n: number) => (v == null ? '' : String(v).slice(0, n));
  const arr = (v: any, n: number, each: number) => (Array.isArray(v) ? v.slice(0, n).map((x) => String(x).slice(0, each)) : []);
  let computedStyles: any = {};
  if (a.computedStyles && typeof a.computedStyles === 'object') {
    for (const [k, v] of Object.entries(a.computedStyles).slice(0, 30)) computedStyles[String(k).slice(0, 40)] = String(v).slice(0, 80);
  }
  const out: any = {
    mkId: s(a.mkId, 64), selector: s(a.selector, 600), tag: s(a.tag, 40), id: s(a.id, 200),
    classes: s(a.classes, 400), text: s(a.text, 400), html: s(a.html, 4000),
    parents: arr(a.parents, 6, 160), sectionId: s(a.sectionId, 200), sectionHeading: s(a.sectionHeading, 200),
    computedStyles,
  };
  return (out.selector || out.tag || out.text || out.mkId) ? out : {};
};
const COMMENT_TYPES = ['spacing', 'color', 'copy', 'typography', 'remove', 'add', 'animation', 'layout', 'bug', 'other'];
const COMMENT_SCOPES = ['element', 'all-similar', 'section', 'global'];
const cleanType = (t: any) => (COMMENT_TYPES.includes(t) ? t : 'other');
const cleanScope = (s: any) => (COMMENT_SCOPES.includes(s) ? s : 'element');
// A per-comment screenshot may come as a data: URL (save to disk, return its /markup-files URL),
// or already be a stored /markup-files/_att/ URL (keep as-is). Anything else → ''.
const saveScreenshot = (val: any): string => {
  const v = String(val || '');
  if (!v) return '';
  if (v.startsWith('/markup-files/_att/')) return v;
  if (v.startsWith('data:')) { try { return saveAttachment(v, 'screenshot.png').url; } catch { return ''; } }
  return '';
};

const projectCommentsQuery = `SELECT c.*, v.label AS version_label FROM markup_comments c JOIN markup_versions v ON v.id = c.version_id WHERE c.project_id = $1 ORDER BY c.created_at DESC`;
const withVersionLabel = (c: any) => ({ ...commentApi(c), versionLabel: c.version_label });

// all comments across every version of a project
markupRouter.get('/projects/:id/comments', async (req: AuthedRequest, res: Response) => {
  if (!(await accessRole(req.params.id, req.userId!))) return res.status(404).json({ error: 'Project not found' });
  const { rows } = await pool.query(projectCommentsQuery, [req.params.id]);
  res.json(rows.map(withVersionLabel));
});

markupRouter.get('/versions/:vid/comments', async (req: AuthedRequest, res: Response) => {
  const acc = await versionAccess(req.params.vid, req.userId!);
  if (!acc) return res.status(404).json({ error: 'Version not found' });
  const { rows } = await pool.query('SELECT * FROM markup_comments WHERE version_id = $1 ORDER BY created_at ASC', [req.params.vid]);
  res.json(rows.map(commentApi));
});

markupRouter.post('/versions/:vid/comments', async (req: AuthedRequest, res: Response) => {
  const acc = await versionAccess(req.params.vid, req.userId!);
  if (!acc) return res.status(404).json({ error: 'Version not found' });
  if (acc.role === 'viewer') return res.status(403).json({ error: 'You have view-only access' });
  const { page = '', x = 0, y = 0, text = '', author = '', priority = 'none', drawing = [], attachments = [], device = 'desktop', mentions = [], anchor = {}, type = 'other', scope = 'element', desiredValue = '', screenshot = '' } = req.body || {};
  const pr = PRIORITIES.includes(priority) ? priority : 'none';
  const dv = DEVICES.includes(device) ? device : 'desktop';
  const { rows } = await pool.query(
    `INSERT INTO markup_comments (project_id, version_id, user_id, page, x, y, text, author, priority, drawing, attachments, device, mentions, anchor, type, scope, desired_value, screenshot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [acc.projectId, req.params.vid, req.userId, String(page).slice(0, 500), Number(x) || 0, Number(y) || 0, String(text).slice(0, 4000), String(author).slice(0, 120), pr, JSON.stringify(cleanDrawing(drawing)), JSON.stringify(cleanAttachments(attachments)), dv, JSON.stringify(cleanMentions(mentions)), JSON.stringify(cleanAnchor(anchor)), cleanType(type), cleanScope(scope), String(desiredValue || '').slice(0, 1000), saveScreenshot(screenshot)]
  );
  res.status(201).json(commentApi(rows[0]));
});

// Upload a comment attachment (logged-in users). Body: { name, dataUrl }.
markupRouter.post('/attachments', async (req: AuthedRequest, res: Response) => {
  try {
    const f = saveAttachment(req.body?.dataUrl, req.body?.name);
    res.status(201).json(f);
  } catch (e) { res.status(400).json({ error: (e as Error).message || 'Upload failed' }); }
});

markupRouter.patch('/comments/:cid', async (req: AuthedRequest, res: Response) => {
  const { rows: cm } = await pool.query('SELECT project_id FROM markup_comments WHERE id = $1', [req.params.cid]);
  if (!cm[0]) return res.status(404).json({ error: 'Comment not found' });
  const role = await accessRole(cm[0].project_id, req.userId!);
  if (!role || role === 'viewer') return res.status(404).json({ error: 'Comment not found' });
  const sets: string[] = []; const vals: any[] = []; let i = 1;
  if (typeof req.body?.text === 'string') { sets.push(`text = $${i++}`); vals.push(req.body.text.slice(0, 4000)); }
  if (typeof req.body?.resolved === 'boolean') { sets.push(`resolved = $${i++}`); vals.push(req.body.resolved); }
  if (typeof req.body?.x === 'number') { sets.push(`x = $${i++}`); vals.push(req.body.x); }
  if (typeof req.body?.y === 'number') { sets.push(`y = $${i++}`); vals.push(req.body.y); }
  if (typeof req.body?.priority === 'string' && PRIORITIES.includes(req.body.priority)) { sets.push(`priority = $${i++}`); vals.push(req.body.priority); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.params.cid);
  const { rows } = await pool.query(`UPDATE markup_comments SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  res.json(commentApi(rows[0]));
});

markupRouter.delete('/comments/:cid', async (req: AuthedRequest, res: Response) => {
  const { rows: cm } = await pool.query('SELECT project_id FROM markup_comments WHERE id = $1', [req.params.cid]);
  if (cm[0]) {
    const role = await accessRole(cm[0].project_id, req.userId!);
    if (role && role !== 'viewer') await pool.query('DELETE FROM markup_comments WHERE id = $1', [req.params.cid]);
  }
  res.status(204).end();
});

// reply to a comment (authed)
markupRouter.post('/comments/:cid/replies', async (req: AuthedRequest, res: Response) => {
  const { rows: cm } = await pool.query('SELECT project_id FROM markup_comments WHERE id = $1', [req.params.cid]);
  if (!cm[0]) return res.status(404).json({ error: 'Comment not found' });
  const role = await accessRole(cm[0].project_id, req.userId!);
  if (!role || role === 'viewer') return res.status(403).json({ error: 'No access' });
  const b = req.body || {};
  if (!String(b.text || '').trim() && !(b.drawing || []).length && !(b.attachments || []).length) return res.status(400).json({ error: 'Empty reply' });
  const reply = mkReply(b.author, b.text, { priority: b.priority, drawing: b.drawing, attachments: b.attachments, mentions: b.mentions });
  const { rows } = await pool.query('UPDATE markup_comments SET replies = replies || $1::jsonb WHERE id = $2 RETURNING *', [JSON.stringify([reply]), req.params.cid]);
  res.status(201).json(commentApi(rows[0]));
});

// delete a reply (authed)
markupRouter.delete('/comments/:cid/replies/:rid', async (req: AuthedRequest, res: Response) => {
  const { rows: cm } = await pool.query('SELECT project_id FROM markup_comments WHERE id = $1', [req.params.cid]);
  if (!cm[0]) return res.status(404).json({ error: 'Comment not found' });
  const role = await accessRole(cm[0].project_id, req.userId!);
  if (!role || role === 'viewer') return res.status(403).json({ error: 'No access' });
  const { rows } = await pool.query(
    `UPDATE markup_comments SET replies = coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(replies) e WHERE e->>'id' <> $1), '[]'::jsonb) WHERE id = $2 RETURNING *`,
    [req.params.rid, req.params.cid]
  );
  res.json(commentApi(rows[0]));
});

// mentionable people for a project: owner + project members + the owner's team
markupRouter.get('/projects/:id/people', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email FROM users u WHERE u.id IN (
        SELECT user_id FROM markup_projects WHERE id = $1
        UNION SELECT user_id FROM markup_members WHERE project_id = $1
        UNION SELECT mine.user_id FROM markup_projects p
               JOIN team_members om ON om.user_id = p.user_id
               JOIN team_members mine ON mine.team_id = om.team_id
              WHERE p.id = $1
      ) ORDER BY u.name`,
    [req.params.id]
  );
  res.json(rows.map((r) => ({ id: r.id, name: r.name, email: r.email })));
});
