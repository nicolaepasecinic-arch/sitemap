import { Request, Response } from 'express';
import { pool } from './db';
import {
  markupAccessRole, mkListProjects, mkGetProjectRow, mkCreateUrlProject, mkCreateZipProject,
  mkRenameProject, mkSetStatus, mkDuplicateProject, mkDeleteProject,
  mkListVersions, mkAddUrlVersion, mkAddZipVersion, mkReplaceCurrentVersion, mkExportVersionZip, markupDecodeZip,
  mkUploadBegin, mkUploadChunk, mkUploadTake, mkFetchZipBuffer, mkReadZipFromPath,
  mkListProjectComments, mkAddComment, mkUpdateComment, mkDeleteComment,
  mkProjectOfComment, mkProjectOfVersion, markupProjectApi,
  saveAttachment, mkAppendCommentAttachments,
} from './markup';
import { generateSitemap } from './ai';
import { sendMail } from './mailer';
import { userAcToken, canSyncAcRole } from './projects';
import { teamRoleOf } from './auth';
import { fetchAcProject, syncAcTask } from './activecollab';
import { defaultStyleGuideHtml, parseAllTokens, themeFromContent, setRootTokens, styleGuideHead, buildPageFromStyleGuide } from './styleguides';

// The building blocks an agent should use when authoring HTML against a style guide.
const SG_USAGE = [
  'Author semantic HTML using these building blocks — every visual value comes from CSS variables (tokens), so do NOT hardcode colours/sizes:',
  '• Headings: <h1>…<h6> (responsive sizes/weights/colour).',
  '• Text: <p> body; class "lead" for intro text; class "eyebrow" for an uppercase category label; class "caption" or <small> for fine print.',
  '• Links <a>; lists <ul>/<ol> + <li>; quote <blockquote>.',
  '• Buttons: <a class="btn"> (primary) or <a class="btn btn-secondary">.',
  '• Forms: <label>, <input>, <textarea>, <select>.',
  '• Layout: wrap content in <div class="container">; page sections in <section class="section"> (add "alt" for a tinted background); grids with <div class="grid cols-2|cols-3|cols-4">.',
  '• Components: card <div class="card">…</div>; nav bar <div class="demo-nav">…</div>; footer <div class="demo-footer">…</div>.',
].join('\n');
import { generateBoardPdf } from './pdf';
import { MARKUP_DIR } from './markup';

/* ------------------------------------------------------------------ *
 *  MCP server (Streamable HTTP, JSON-RPC 2.0) — "Connect to AI".
 *  An external AI client (e.g. Claude) connects with a per-account
 *  token and can fully drive that user's projects: read, create, edit,
 *  delete pages & sections, arrows, and read comments / notes.
 *  Auth: token via ?token=... or "Authorization: Bearer <token>".
 * ------------------------------------------------------------------ */

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'qoders-map', title: 'Qoders Map', version: '1.0.0' };

// Keep in sync with the frontend vocabularies (src/SitemapBuilder.jsx).
const FRAME_KEYS = [
  'bar', 'text', 'carousel', 'cols2', 'text2', 'dots', 'cols3', 'text3', 'banner',
  'cols4', 'text4', 'table', 'carousel2', 'cards2', 'text2b', 'carousel3', 'cards3',
  'dashes', 'media-text', 'list2', 'text-media', 'cards-grid', 'media-split', 'video',
  'iconrow', 'video-center', 'list', 'none',
];
const COLOR_KEYS = ['blue', 'teal', 'green', 'lime', 'orange', 'red', 'pink', 'fuchsia', 'purple', 'indigo', 'slate', 'steel'];
// Sticky-note colors — must match NOTE_COLORS in src/SitemapBuilder.jsx.
const NOTE_KEYS = ['yellow', 'pink', 'blue', 'green'];

const uid = () => Math.random().toString(36).slice(2, 9);
const validFrame = (f: any) => (typeof f === 'string' && FRAME_KEYS.includes(f) ? f : null);
const validColor = (c: any) => (typeof c === 'string' && (COLOR_KEYS.includes(c) || /^#[0-9a-f]{3,8}$/i.test(c)) ? c : null);

// Turn a caller-supplied (or AI-generated) page list into canvas nodes. Each input page is
// { id, title, parentId, sections:[{name,frame,color,description}] }; ids are remapped to
// real uids and parentId references are rewired ('' / unknown → top-level).
function buildNodesFromPages(pages: any[]): any[] {
  const list = (Array.isArray(pages) ? pages : []).slice(0, 80).map((p) => ({ ...p, _key: String(p?.id || uid()) }));
  const idMap: Record<string, string> = {};
  list.forEach((p) => { idMap[p._key] = uid(); });
  return list.map((p) => ({
    id: idMap[p._key],
    label: String(p?.title || 'Page').slice(0, 80),
    parentId: p?.parentId && idMap[String(p.parentId)] ? idMap[String(p.parentId)] : null,
    group: 'main',
    color: validColor(p?.color) || 'blue',
    link: String(p?.link || ''),
    pageFrame: 'window',
    blocks: (Array.isArray(p?.sections) ? p.sections : []).slice(0, 30).map((s: any) => ({
      id: uid(),
      name: String(s?.name || 'Section').slice(0, 60),
      color: validColor(s?.color) || 'blue',
      frame: validFrame(s?.frame) || 'bar',
      done: false,
      arrowTargets: [],
      description: String(s?.description || '').slice(0, 400),
    })),
  }));
}


/* ----------------------------- data access (scoped to a user) ----------------------------- */
async function accessRole(projectId: string, userId: string): Promise<string | null> {
  const owned = await pool.query('SELECT 1 FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
  if (owned.rows[0]) return 'owner';
  const m = await pool.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
  return m.rows[0]?.role || null;
}
async function loadProject(userId: string, projectId: string): Promise<any | null> {
  const role = await accessRole(projectId, userId);
  if (!role) return null;
  const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
  return rows[0] ? { ...rows[0], role } : null;
}
async function saveNodes(projectId: string, nodes: any[]) {
  await pool.query('UPDATE projects SET nodes = $1, updated_at = now() WHERE id = $2', [JSON.stringify(nodes), projectId]);
}
async function saveItems(projectId: string, items: any[]) {
  await pool.query('UPDATE projects SET items = $1, updated_at = now() WHERE id = $2', [JSON.stringify(items), projectId]);
}

const findPage = (nodes: any[], pageId: string) =>
  nodes.find((n) => n.id === pageId) || nodes.find((n) => (n.label || '').toLowerCase() === String(pageId).toLowerCase()) || null;
const findBlock = (page: any, sectionId: string) =>
  (page?.blocks || []).find((b: any) => b.id === sectionId) || (page?.blocks || []).find((b: any) => (b.name || '').toLowerCase() === String(sectionId).toLowerCase()) || null;

/* ----------------------------- tool implementations ----------------------------- */
type Tool = { description: string; inputSchema: any; handler: (userId: string, args: any) => Promise<any> };

const S = (props: Record<string, any>, required: string[] = []) => ({ type: 'object', properties: props, required, additionalProperties: false });
const str = (description: string) => ({ type: 'string', description });

// JSON schema for a page section (used by create_sitemap / add_page_with_sections).
const sectionSchema = { type: 'object', additionalProperties: false, properties: {
  name: str('Section name, e.g. "Hero", "Pricing Tiers".'),
  frame: str(`Wireframe layout key (one of: ${FRAME_KEYS.filter((k) => k !== 'none').join(', ')}). Vary frames; don't default everything to "bar".`),
  color: str('Accent color key (blue, teal, green, lime, orange, red, pink, fuchsia, purple, indigo, slate, steel).'),
  description: str('1-2 specific sentences about what this section contains.'),
}, required: ['name'] };

async function mustLoad(userId: string, projectId: string) {
  const p = await loadProject(userId, projectId);
  if (!p) throw new Error('Project not found or you do not have access to it.');
  if (p.role === 'viewer') throw new Error('You have view-only access to this project.');
  return p;
}

// markup edit guard (viewers can't change anything)
async function mkMustEdit(userId: string, projectId: string) {
  const role = await markupAccessRole(projectId, userId);
  if (!role) throw new Error('Markup project not found or you do not have access to it.');
  if (role === 'viewer') throw new Error('You have view-only access to this markup project.');
  return role;
}

/* ----------------------------- Style Guide helpers ----------------------------- */
// This user's access role for a style guide: 'owner' | 'pm' | 'editor' | 'viewer' | null.
async function sgAccessRole(id: string, userId: string): Promise<string | null> {
  const owned = await pool.query('SELECT 1 FROM style_guides WHERE id = $1 AND user_id = $2', [id, userId]);
  if (owned.rows[0]) return 'owner';
  const member = await pool.query('SELECT role FROM style_guide_members WHERE style_guide_id = $1 AND user_id = $2', [id, userId]);
  if (member.rows[0]?.role) return member.rows[0].role;
  const team = await pool.query(
    `SELECT mine.role FROM style_guides s
       JOIN team_members owner_m ON owner_m.user_id = s.user_id
       JOIN team_members mine ON mine.team_id = owner_m.team_id AND mine.user_id = $2
      WHERE s.id = $1 AND mine.role = 'pm' LIMIT 1`,
    [id, userId]
  );
  return team.rows[0]?.role || null;
}
async function sgMustEdit(userId: string, id: string) {
  const role = await sgAccessRole(id, userId);
  if (!role) throw new Error('Style guide not found or you do not have access to it.');
  if (role === 'viewer') throw new Error('You have view-only access to this style guide.');
  return role;
}

/* ----------------------------- sharing helpers ----------------------------- */
// Public, no-login share link for a project. mod = 'sitemap' (#/view/<id>) or 'markup' (#/markup/view/<id>).
function shareUrl(mod: 'sitemap' | 'markup', id: string) {
  const base = (process.env.APP_URL || '').replace(/\/+$/, '');
  const path = mod === 'markup' ? `#/markup/view/${id}` : `#/view/${id}`;
  return base ? `${base}/${path}` : `/${path}`;
}

// Look up the name of the person doing the sharing (the MCP account owner).
async function inviterName(userId: string): Promise<string> {
  const { rows } = await pool.query('SELECT name, email FROM users WHERE id = $1', [userId]);
  return rows[0]?.name || rows[0]?.email || 'A teammate';
}

// Build + send the "project shared with you" email. Throws if delivery fails.
async function sendShareEmail(to: string, opts: { inviter: string; projectName: string; role: string; url: string; message?: string }) {
  const { inviter, projectName, role, url, message } = opts;
  const subject = `${inviter} shared a Qoders project with you`;
  const note = message
    ? `<p style="background:#f3f4f6;border-radius:10px;padding:12px 14px;color:#374151;margin:16px 0">${String(message).replace(/[<>]/g, '')}</p>`
    : '';
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#1f2937">
      <h2 style="color:#111827">${inviter} shared a project with you</h2>
      <p>You've been given <strong>${role}</strong> access to the Qoders project <strong>${String(projectName).replace(/[<>]/g, '')}</strong>.</p>
      ${note}
      <p style="margin:24px 0"><a href="${url}" style="background:#473AE0;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9999px;font-weight:600">Open the project</a></p>
      <p style="font-size:13px;color:#6b7280">Or paste this link into your browser:<br><a href="${url}">${url}</a></p>
    </div>`;
  const text = `${inviter} shared the Qoders project "${projectName}" with you (${role} access).${message ? `\n\n${message}` : ''}\n\nOpen it: ${url}`;
  await sendMail(to, subject, html, text);
}

/* ----------------------------- Active Collab helpers ----------------------------- */
// Build an Active Collab task body for a page (name + sections + their comments).
// Must mirror buildTaskBody in src/SitemapBuilder.jsx so MCP syncs look identical.
function buildTaskBody(node: any): string {
  const esc = (s: any) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const blocks = node.blocks || [];
  let html = `<p><strong>Page:</strong> ${esc(node.label)}</p>`;
  if (node.link) html += `<p><strong>Link:</strong> ${esc(node.link)}</p>`;
  html += `<p><strong>Sections (${blocks.length}):</strong></p>`;
  if (!blocks.length) {
    html += '<p><em>No sections yet.</em></p>';
  } else {
    html += '<ol>';
    blocks.forEach((b: any) => {
      html += `<li><strong>${esc(b.name || 'Section')}</strong>`;
      const meta: string[] = [];
      if (b.frame) meta.push(`layout: ${esc(b.frame)}`);
      if (b.done) meta.push('done');
      if (meta.length) html += ` <em>(${meta.join(', ')})</em>`;
      if (b.description) html += `<br>${esc(b.description)}`;
      const cs = b.comments || [];
      if (cs.length) {
        html += '<br><strong>Comments:</strong><ul>';
        cs.forEach((c: any) => { html += `<li>${esc(c.author || 'User')}: ${esc(c.text)}</li>`; });
        html += '</ul>';
      }
      html += '</li>';
    });
    html += '</ol>';
  }
  html += '<p><em>Synced from Qoders sitemap.</em></p>';
  return html;
}

/* ----------------------------- file helpers ----------------------------- */
// Save a list of files ({ name, fileBase64 } — raw base64 or a data: URL) to storage and
// return their attachment metadata ({ id, name, url, size, type }). Shared by file tools.
function saveFiles(files: any[]): any[] {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) return [];
  return list.slice(0, 20).map((f) => saveAttachment(f?.fileBase64 ?? f?.dataUrl ?? f?.data ?? '', f?.name || 'file'));
}

/* ----------------------------- Projects (boards) helpers ----------------------------- */
// A "Project" here is the page-based document (the Projects tab), stored in the `boards` table.
async function boardAccessRole(id: string, userId: string): Promise<string | null> {
  const owned = await pool.query('SELECT 1 FROM boards WHERE id = $1 AND user_id = $2', [id, userId]);
  if (owned.rows[0]) return 'owner';
  const m = await pool.query('SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2', [id, userId]);
  if (m.rows[0]?.role) return m.rows[0].role;
  const t = await pool.query(
    `SELECT mine.role FROM boards b JOIN team_members om ON om.user_id = b.user_id
       JOIN team_members mine ON mine.team_id = om.team_id AND mine.user_id = $2
      WHERE b.id = $1 AND mine.role = 'pm' LIMIT 1`, [id, userId]);
  return t.rows[0]?.role || null;
}
async function loadBoard(userId: string, id: string): Promise<any | null> {
  const role = await boardAccessRole(id, userId);
  if (!role) return null;
  const { rows } = await pool.query('SELECT * FROM boards WHERE id = $1', [id]);
  if (!rows[0]) return null;
  return { ...rows[0], role };
}
async function boardMustEdit(userId: string, id: string) {
  const b = await loadBoard(userId, id);
  if (!b) throw new Error('Project not found or you do not have access to it.');
  if (b.role === 'viewer') throw new Error('You have view-only access to this project.');
  return b;
}
async function saveBoardPages(id: string, pages: any[]) {
  await pool.query('UPDATE boards SET items = $1, updated_at = now() WHERE id = $2', [JSON.stringify(pages), id]);
}
// Normalize stored items into [{ id, name, doc }] (handles legacy free-canvas boards too).
function boardPages(items: any): { id: string; name: string; doc: any[] }[] {
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return [{ id: uid(), name: 'Page 1', doc: [] }];
  if (arr.every((p: any) => p && typeof p === 'object' && !('type' in p) && ('doc' in p || 'name' in p))) {
    return arr.map((p: any, i: number) => ({ id: p.id || uid(), name: p.name || `Page ${i + 1}`, doc: Array.isArray(p.doc) ? p.doc : [] }));
  }
  const texts = arr.filter((e: any) => e && e.type === 'text');
  const pages = texts.map((t: any, i: number) => ({ id: t.id || uid(), name: `Page ${i + 1}`, doc: Array.isArray(t.doc) ? t.doc : [] }));
  return pages.length ? pages : [{ id: uid(), name: 'Page 1', doc: [] }];
}
// Markdown → BlockNote blocks (safe default block types only, so the editor never breaks).
function mdToBlocks(md: string): any[] {
  const txt = (s: string) => (s ? [{ type: 'text', text: s, styles: {} }] : []);
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out: any[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) { const code: string[] = []; i++; while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; } i++; out.push({ type: 'codeBlock', props: {}, content: txt(code.join('\n')) }); continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { out.push({ type: 'heading', props: { level: h[1].length }, content: txt(h[2]) }); i++; continue; }
    const chk = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (chk) { out.push({ type: 'checkListItem', props: { checked: chk[1].toLowerCase() === 'x' }, content: txt(chk[2]) }); i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) { out.push({ type: 'bulletListItem', props: {}, content: txt(line.replace(/^\s*[-*]\s+/, '')) }); i++; continue; }
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) { out.push({ type: 'numberedListItem', props: {}, content: txt(ol[1]) }); i++; continue; }
    if (/^\s*>\s?/.test(line)) { out.push({ type: 'quote', props: {}, content: txt(line.replace(/^\s*>\s?/, '')) }); i++; continue; }
    out.push({ type: 'paragraph', props: {}, content: txt(line) });
    i++;
  }
  return out.length ? out : [{ type: 'paragraph', props: {}, content: [] }];
}
// BlockNote blocks → Markdown (for reading a page's content).
function inlineMd(content: any): string {
  return (Array.isArray(content) ? content : []).map((c: any) => (c && c.type === 'link' ? `[${inlineMd(c.content)}](${c.href || ''})` : (c && c.text) || '')).join('');
}
function blocksToMd(blocks: any[], depth = 0): string {
  const pad = '  '.repeat(depth);
  const out: string[] = [];
  for (const b of blocks || []) {
    if (!b) continue;
    const t = inlineMd(b.content);
    if (b.type === 'heading') out.push(pad + '#'.repeat((b.props && b.props.level) || 1) + ' ' + t);
    else if (b.type === 'bulletListItem' || b.type === 'toggleListItem') out.push(pad + '- ' + t);
    else if (b.type === 'numberedListItem') out.push(pad + '1. ' + t);
    else if (b.type === 'checkListItem') out.push(pad + '- [' + ((b.props && b.props.checked) ? 'x' : ' ') + '] ' + t);
    else if (b.type === 'quote' || b.type === 'callout') out.push(pad + '> ' + t);
    else if (b.type === 'codeBlock') out.push(pad + '```\n' + t + '\n```');
    else if (b.type === 'divider') out.push(pad + '---');
    else if (b.type === 'image') out.push(pad + '![](' + ((b.props && b.props.url) || '') + ')');
    else if (b.type === 'bookmark') out.push(pad + '[' + ((b.props && b.props.title) || '') + '](' + ((b.props && b.props.url) || '') + ')');
    else if (b.type === 'table') out.push(pad + '(table)');
    else out.push(pad + t);
    if (Array.isArray(b.children) && b.children.length) out.push(blocksToMd(b.children, depth + 1));
  }
  return out.join('\n');
}

const tools: Record<string, Tool> = {
  list_projects: {
    description: 'List all projects (sitemaps) the user owns or can edit, with id, name, page count and timestamps.',
    inputSchema: S({}),
    handler: async (userId) => {
      const { rows } = await pool.query(
        `SELECT p.id, p.name, p.archived, p.completed, p.updated_at, jsonb_array_length(p.nodes) AS pages,
                CASE WHEN p.user_id = $1 THEN 'owner' ELSE m.role END AS role
         FROM projects p LEFT JOIN project_members m ON m.project_id = p.id AND m.user_id = $1
         WHERE p.user_id = $1 OR m.user_id = $1 ORDER BY p.updated_at DESC`,
        [userId]
      );
      return rows.map((r) => ({ id: r.id, name: r.name, pages: Number(r.pages), archived: r.archived, completed: r.completed, role: r.role, updatedAt: new Date(r.updated_at).toISOString() }));
    },
  },

  get_project: {
    description: 'Get one project in full detail: all pages (nodes) with their sections (blocks), arrows, plus notes/comments (items) and settings.',
    inputSchema: S({ projectId: str('The project id.') }, ['projectId']),
    handler: async (userId, a) => {
      const p = await loadProject(userId, a.projectId);
      if (!p) throw new Error('Project not found or no access.');
      return { id: p.id, name: p.name, role: p.role, archived: p.archived, completed: p.completed, nodes: p.nodes, items: p.items, settings: p.settings };
    },
  },

  export_project: {
    description: 'Export a project in extreme detail: a structured JSON plus a readable markdown outline of every page, its sub-pages, and each section (name, wireframe frame, color, description, cross-page arrows).',
    inputSchema: S({ projectId: str('The project id.') }, ['projectId']),
    handler: async (userId, a) => {
      const p = await loadProject(userId, a.projectId);
      if (!p) throw new Error('Project not found or no access.');
      const nodes: any[] = p.nodes || [];
      const byId: Record<string, any> = {}; nodes.forEach((n) => (byId[n.id] = n));
      const childrenOf = (id: string | null) => nodes.filter((n) => (n.parentId || null) === id);
      const lines: string[] = [`# ${p.name}`, ''];
      const walk = (n: any, depth: number) => {
        lines.push(`${'  '.repeat(depth)}- **${n.label}**${n.link ? ` (${n.link})` : ''}`);
        (n.blocks || []).forEach((b: any) => {
          const arrows = (b.arrowTargets || []).map((t: string) => byId[t]?.label).filter(Boolean);
          lines.push(`${'  '.repeat(depth + 1)}• [${b.frame}] ${b.name}${b.color ? ` {${b.color}}` : ''}${b.description ? ` — ${b.description}` : ''}${arrows.length ? ` → ${arrows.join(', ')}` : ''}`);
        });
        childrenOf(n.id).forEach((c) => walk(c, depth + 1));
      };
      childrenOf(null).forEach((r) => walk(r, 0));
      return { project: { id: p.id, name: p.name, nodes: p.nodes, items: p.items, settings: p.settings }, outline: lines.join('\n') };
    },
  },

  create_project: {
    description: 'Create a new empty project (sitemap) with a name. Optionally seed a Home page.',
    inputSchema: S({ name: str('Project name.'), withHome: { type: 'boolean', description: 'Seed a Home page (default true).' } }, ['name']),
    handler: async (userId, a) => {
      const nodes = a.withHome === false ? [] : [{ id: uid(), label: 'Home', parentId: null, group: 'main', color: 'blue', link: '', pageFrame: 'window', blocks: [] }];
      const { rows } = await pool.query(
        'INSERT INTO projects (user_id, name, nodes, items, settings) VALUES ($1,$2,$3,$4,$5) RETURNING id, name',
        [userId, String(a.name).slice(0, 120) || 'Untitled project', JSON.stringify(nodes), '[]', '{}']
      );
      return { id: rows[0].id, name: rows[0].name, pages: nodes.length };
    },
  },

  create_sitemap: {
    description: 'Create a complete project from a sitemap structure YOU design. Pass the full page hierarchy with each page\'s content map (sections). Use this to build a whole sitemap in ONE call — design it yourself (pages + their sections), then call this. Every page should include 4-8 sections. parentId references another page\'s id in this same list ("" = top-level). Returns the new project id.',
    inputSchema: S({
      name: str('Project name.'),
      pages: {
        type: 'array',
        description: 'The full list of pages. Each page must include its sections (content map).',
        items: { type: 'object', additionalProperties: false, properties: {
          id: str('A temporary unique id you assign (e.g. "p1"); used only to wire parentId.'),
          title: str('Page title (1-4 words).'),
          parentId: str('Parent page id from this list, or "" for a top-level page.'),
          color: str('Optional page color key.'),
          link: str('Optional external URL.'),
          sections: { type: 'array', description: 'Ordered sections (content map), top to bottom.', items: sectionSchema },
        }, required: ['id', 'title', 'parentId', 'sections'] },
      },
    }, ['name', 'pages']),
    handler: async (userId, a) => {
      const nodes = buildNodesFromPages(a.pages || []);
      if (!nodes.length) throw new Error('Provide at least one page.');
      const { rows } = await pool.query(
        'INSERT INTO projects (user_id, name, nodes, items, settings) VALUES ($1,$2,$3,$4,$5) RETURNING id, name',
        [userId, String(a.name || 'Untitled project').slice(0, 120), JSON.stringify(nodes), '[]', '{}']
      );
      return { id: rows[0].id, name: rows[0].name, pages: nodes.length, sections: nodes.reduce((n, x) => n + x.blocks.length, 0) };
    },
  },

  add_page_with_sections: {
    description: 'Add ONE complete page (with all its sections) to an existing project in a single call. Prefer this over add_page + repeated add_section. parentId attaches it under another page (omit/empty for top-level).',
    inputSchema: S({
      projectId: str('Project id.'),
      title: str('Page title.'),
      parentId: str('Parent page id, or empty for top-level.'),
      color: str('Optional page color key.'),
      link: str('Optional external URL.'),
      sections: { type: 'array', description: 'The page\'s sections (content map).', items: sectionSchema },
    }, ['projectId', 'title', 'sections']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const nodes = p.nodes || [];
      const parent = a.parentId ? (findPage(nodes, a.parentId)?.id || null) : null;
      const id = uid();
      nodes.push({
        id, label: String(a.title).slice(0, 80), parentId: parent, group: 'main',
        color: validColor(a.color) || 'blue', link: String(a.link || ''), pageFrame: 'window',
        blocks: (Array.isArray(a.sections) ? a.sections : []).slice(0, 30).map((s: any) => ({
          id: uid(), name: String(s?.name || 'Section').slice(0, 60), color: validColor(s?.color) || 'blue',
          frame: validFrame(s?.frame) || 'bar', done: false, arrowTargets: [], description: String(s?.description || '').slice(0, 400),
        })),
      });
      await saveNodes(a.projectId, nodes);
      return { id, ok: true, sections: (a.sections || []).length };
    },
  },

  generate_sitemap: {
    description: 'OPTIONAL fallback: auto-generate a sitemap from a short description using the server\'s AI (no design input from you). Prefer create_sitemap, where YOU design the pages + sections. Returns the new project id.',
    inputSchema: S({ prompt: str('What the website is about.'), name: str('Optional project name.') }, ['prompt']),
    handler: async (userId, a) => {
      const { projectName, pages } = await generateSitemap(String(a.prompt || ''));
      const nodes = buildNodesFromPages(pages);
      const name = (a.name && String(a.name).slice(0, 120)) || projectName;
      const { rows } = await pool.query(
        'INSERT INTO projects (user_id, name, nodes, items, settings) VALUES ($1,$2,$3,$4,$5) RETURNING id, name',
        [userId, name, JSON.stringify(nodes), '[]', '{}']
      );
      return { id: rows[0].id, name: rows[0].name, pages: nodes.length, sections: nodes.reduce((n, x) => n + x.blocks.length, 0) };
    },
  },

  rename_project: {
    description: 'Rename a project.',
    inputSchema: S({ projectId: str('Project id.'), name: str('New name.') }, ['projectId', 'name']),
    handler: async (userId, a) => {
      await mustLoad(userId, a.projectId);
      await pool.query('UPDATE projects SET name = $1, updated_at = now() WHERE id = $2', [String(a.name).slice(0, 120), a.projectId]);
      return { ok: true };
    },
  },

  set_project_status: {
    description: 'Archive/unarchive or mark a project complete/incomplete.',
    inputSchema: S({ projectId: str('Project id.'), archived: { type: 'boolean' }, completed: { type: 'boolean' } }, ['projectId']),
    handler: async (userId, a) => {
      await mustLoad(userId, a.projectId);
      const sets: string[] = []; const vals: any[] = []; let i = 1;
      if (typeof a.archived === 'boolean') { sets.push(`archived = $${i++}`); vals.push(a.archived); }
      if (typeof a.completed === 'boolean') { sets.push(`completed = $${i++}`); vals.push(a.completed); }
      if (!sets.length) throw new Error('Nothing to update.');
      vals.push(a.projectId);
      await pool.query(`UPDATE projects SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i}`, vals);
      return { ok: true };
    },
  },

  duplicate_project: {
    description: 'Make a full copy of a project. The copy is owned by the user.',
    inputSchema: S({ projectId: str('Project id.'), name: str('Optional name for the copy.') }, ['projectId']),
    handler: async (userId, a) => {
      const p = await loadProject(userId, a.projectId);
      if (!p) throw new Error('Project not found or no access.');
      const { rows } = await pool.query(
        'INSERT INTO projects (user_id, name, nodes, items, settings) VALUES ($1,$2,$3,$4,$5) RETURNING id, name',
        [userId, (a.name && String(a.name).slice(0, 120)) || `${p.name} copy`, JSON.stringify(p.nodes), JSON.stringify(p.items), JSON.stringify(p.settings)]
      );
      return { id: rows[0].id, name: rows[0].name };
    },
  },

  delete_project: {
    description: 'Permanently delete a project (owner only). This cannot be undone.',
    inputSchema: S({ projectId: str('Project id.') }, ['projectId']),
    handler: async (userId, a) => {
      const role = await accessRole(a.projectId, userId);
      if (!role) throw new Error('Project not found or no access.');
      if (role !== 'owner') throw new Error('Only the owner can delete this project.');
      await pool.query('DELETE FROM projects WHERE id = $1', [a.projectId]);
      return { ok: true };
    },
  },

  leave_project: {
    description: 'Leave a project that was shared with you (removes your access). Only for shared members — the owner cannot leave their own project (use delete_project instead).',
    inputSchema: S({ projectId: str('Project id.') }, ['projectId']),
    handler: async (userId, a) => {
      const role = await accessRole(a.projectId, userId);
      if (!role) throw new Error('Project not found or no access.');
      if (role === 'owner') throw new Error('You own this project — you can’t leave it. Delete it instead if you want it gone.');
      const r = await pool.query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [a.projectId, userId]);
      if (!r.rowCount) throw new Error('You don’t have a removable membership on this project (access may be via your team).');
      return { ok: true, left: true };
    },
  },

  add_page: {
    description: 'Add a page to a project. parentId attaches it under another page (omit/empty for a top-level page).',
    inputSchema: S({ projectId: str('Project id.'), title: str('Page title.'), parentId: str('Parent page id, or empty for top-level.'), color: str('Color key.'), link: str('External URL.') }, ['projectId', 'title']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const nodes = p.nodes || [];
      const parent = a.parentId ? (findPage(nodes, a.parentId)?.id || null) : null;
      const id = uid();
      nodes.push({ id, label: String(a.title).slice(0, 80), parentId: parent, group: 'main', color: validColor(a.color) || 'blue', link: a.link || '', pageFrame: 'window', blocks: [] });
      await saveNodes(a.projectId, nodes);
      return { id, ok: true };
    },
  },

  update_page: {
    description: 'Update a page: rename, recolor, set link, or reparent.',
    inputSchema: S({ projectId: str('Project id.'), pageId: str('Page id.'), title: str('New title.'), color: str('Color key.'), link: str('External URL.'), parentId: str('New parent page id, or empty for top-level.') }, ['projectId', 'pageId']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const nodes = p.nodes || [];
      const page = findPage(nodes, a.pageId);
      if (!page) throw new Error('Page not found.');
      if (a.title) page.label = String(a.title).slice(0, 80);
      const c = validColor(a.color); if (c) page.color = c;
      if (typeof a.link === 'string') page.link = a.link;
      if (typeof a.parentId === 'string') page.parentId = a.parentId ? (findPage(nodes, a.parentId)?.id || null) : null;
      await saveNodes(a.projectId, nodes);
      return { ok: true };
    },
  },

  delete_page: {
    description: 'Delete a page and all its sub-pages.',
    inputSchema: S({ projectId: str('Project id.'), pageId: str('Page id.') }, ['projectId', 'pageId']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      let nodes = p.nodes || [];
      const page = findPage(nodes, a.pageId);
      if (!page) throw new Error('Page not found.');
      const rm = new Set([page.id]); let added = true;
      while (added) { added = false; for (const n of nodes) { if (n.parentId && rm.has(n.parentId) && !rm.has(n.id)) { rm.add(n.id); added = true; } } }
      nodes = nodes.filter((n: any) => !rm.has(n.id));
      await saveNodes(a.projectId, nodes);
      return { ok: true, deleted: rm.size };
    },
  },

  add_section: {
    description: 'Add a section (block) to a page. frame is a wireframe layout key; position is the 0-based insert index (omit for end).',
    inputSchema: S({ projectId: str('Project id.'), pageId: str('Page id.'), name: str('Section name.'), frame: str(`Wireframe key (one of: ${FRAME_KEYS.join(', ')}).`), color: str('Color key.'), description: str('Section description.'), position: { type: 'integer', description: '0-based insert index; omit for end.' } }, ['projectId', 'pageId', 'name']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const nodes = p.nodes || [];
      const page = findPage(nodes, a.pageId);
      if (!page) throw new Error('Page not found.');
      page.blocks = page.blocks || [];
      const id = uid();
      const block = { id, name: String(a.name).slice(0, 60), color: validColor(a.color) || page.color || 'blue', frame: validFrame(a.frame) || 'bar', done: false, arrowTargets: [], description: (a.description || '').slice(0, 400) };
      const pos = Number.isInteger(a.position) && a.position >= 0 && a.position <= page.blocks.length ? a.position : page.blocks.length;
      page.blocks.splice(pos, 0, block);
      await saveNodes(a.projectId, nodes);
      return { id, ok: true };
    },
  },

  update_section: {
    description: 'Update a section: rename, change wireframe frame, color, description, or done state.',
    inputSchema: S({ projectId: str('Project id.'), pageId: str('Page id.'), sectionId: str('Section id.'), name: str('New name.'), frame: str('Wireframe key.'), color: str('Color key.'), description: str('New description.'), done: { type: 'boolean', description: 'Completed toggle.' } }, ['projectId', 'pageId', 'sectionId']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const nodes = p.nodes || [];
      const page = findPage(nodes, a.pageId);
      const b = findBlock(page, a.sectionId);
      if (!b) throw new Error('Section not found.');
      if (a.name) b.name = String(a.name).slice(0, 60);
      const f = validFrame(a.frame); if (f) b.frame = f;
      const c = validColor(a.color); if (c) b.color = c;
      if (typeof a.description === 'string') b.description = a.description.slice(0, 400);
      if (typeof a.done === 'boolean') b.done = a.done;
      await saveNodes(a.projectId, nodes);
      return { ok: true };
    },
  },

  delete_section: {
    description: 'Delete a section from a page.',
    inputSchema: S({ projectId: str('Project id.'), pageId: str('Page id.'), sectionId: str('Section id.') }, ['projectId', 'pageId', 'sectionId']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const nodes = p.nodes || [];
      const page = findPage(nodes, a.pageId);
      const b = findBlock(page, a.sectionId);
      if (!page || !b) throw new Error('Section not found.');
      page.blocks = page.blocks.filter((x: any) => x.id !== b.id);
      await saveNodes(a.projectId, nodes);
      return { ok: true };
    },
  },

  move_section: {
    description: 'Reorder a section within its page to a new 0-based position.',
    inputSchema: S({ projectId: str('Project id.'), pageId: str('Page id.'), sectionId: str('Section id.'), position: { type: 'integer', description: 'New 0-based index.' } }, ['projectId', 'pageId', 'sectionId', 'position']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const nodes = p.nodes || [];
      const page = findPage(nodes, a.pageId);
      const b = findBlock(page, a.sectionId);
      if (!page || !b) throw new Error('Section not found.');
      const from = page.blocks.findIndex((x: any) => x.id === b.id);
      page.blocks.splice(from, 1);
      const pos = Number.isInteger(a.position) && a.position >= 0 && a.position <= page.blocks.length ? a.position : page.blocks.length;
      page.blocks.splice(pos, 0, b);
      await saveNodes(a.projectId, nodes);
      return { ok: true };
    },
  },

  add_arrow: {
    description: 'Draw an arrow from a section to another page (cross-page link).',
    inputSchema: S({ projectId: str('Project id.'), pageId: str('Page id holding the section.'), sectionId: str('Section id.'), toPageId: str('Target page id the arrow points to.') }, ['projectId', 'pageId', 'sectionId', 'toPageId']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const nodes = p.nodes || [];
      const page = findPage(nodes, a.pageId);
      const b = findBlock(page, a.sectionId);
      const target = findPage(nodes, a.toPageId);
      if (!b || !target) throw new Error('Section or target page not found.');
      b.arrowTargets = b.arrowTargets || [];
      if (target.id !== page.id && !b.arrowTargets.includes(target.id)) b.arrowTargets.push(target.id);
      await saveNodes(a.projectId, nodes);
      return { ok: true };
    },
  },

  remove_arrow: {
    description: 'Remove an arrow from a section to a page.',
    inputSchema: S({ projectId: str('Project id.'), pageId: str('Page id.'), sectionId: str('Section id.'), toPageId: str('Target page id.') }, ['projectId', 'pageId', 'sectionId', 'toPageId']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const nodes = p.nodes || [];
      const page = findPage(nodes, a.pageId);
      const b = findBlock(page, a.sectionId);
      const target = findPage(nodes, a.toPageId);
      if (!b || !target) throw new Error('Section or target page not found.');
      b.arrowTargets = (b.arrowTargets || []).filter((t: string) => t !== target.id);
      await saveNodes(a.projectId, nodes);
      return { ok: true };
    },
  },

  list_comments: {
    description: 'List all comments in a project: free-floating comment pins (canvas items) and comments attached to sections. Each item includes ids you can pass to delete_comment.',
    inputSchema: S({ projectId: str('Project id.') }, ['projectId']),
    handler: async (userId, a) => {
      const p = await loadProject(userId, a.projectId);
      if (!p) throw new Error('Project not found or no access.');
      const pins = (p.items || []).filter((i: any) => i.type === 'comment').map((i: any) => ({ id: i.id, kind: 'pin', author: i.author, text: i.text, ts: i.ts ? new Date(i.ts).toISOString() : null }));
      const onSections: any[] = [];
      (p.nodes || []).forEach((n: any) => (n.blocks || []).forEach((b: any) => (b.comments || []).forEach((c: any) => onSections.push({ id: c.id, kind: 'section', pageId: n.id, page: n.label, sectionId: b.id, section: b.name, author: c.author, text: c.text, ts: c.ts ? new Date(c.ts).toISOString() : null }))));
      return { comments: [...pins, ...onSections] };
    },
  },

  add_section_comment: {
    description: 'Add a comment to a specific section (block) of a page.',
    inputSchema: S({ projectId: str('Project id.'), pageId: str('Page id.'), sectionId: str('Section id.'), text: str('Comment text.'), author: str('Optional author name (default "AI").') }, ['projectId', 'pageId', 'sectionId', 'text']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const nodes = p.nodes || [];
      const page = findPage(nodes, a.pageId);
      const b = findBlock(page, a.sectionId);
      if (!b) throw new Error('Section not found.');
      b.comments = b.comments || [];
      const c = { id: uid(), text: String(a.text).slice(0, 2000), author: String(a.author || 'AI').slice(0, 60), initials: 'AI', color: '#473AE0', ts: Date.now() };
      b.comments.push(c);
      await saveNodes(a.projectId, nodes);
      return { id: c.id, ok: true };
    },
  },

  add_section_file: {
    description: 'Attach a file (image, PDF, doc, etc.) to a section (block) of a page. Provide the file as base64 (raw base64 or a data: URL) in fileBase64, plus its name. Files appear on the section like on a real website. Max 30MB per file.',
    inputSchema: S({ projectId: str('Project id.'), pageId: str('Page id.'), sectionId: str('Section id.'), name: str('File name (with extension, e.g. hero.png).'), fileBase64: str('File content as base64 or data:...;base64,... URL.') }, ['projectId', 'pageId', 'sectionId', 'name', 'fileBase64']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const nodes = p.nodes || [];
      const page = findPage(nodes, a.pageId);
      const b = findBlock(page, a.sectionId);
      if (!b) throw new Error('Section not found.');
      const att = saveAttachment(a.fileBase64, a.name);
      b.attachments = Array.isArray(b.attachments) ? b.attachments : [];
      b.attachments.push(att);
      await saveNodes(a.projectId, nodes);
      return { attachment: att, ok: true };
    },
  },

  add_comment: {
    description: 'Add a free-floating comment pin to the project canvas. x/y are canvas coordinates (optional, default near origin).',
    inputSchema: S({ projectId: str('Project id.'), text: str('Comment text.'), author: str('Optional author name (default "AI").'), x: { type: 'number' }, y: { type: 'number' } }, ['projectId', 'text']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const items = p.items || [];
      const it = { id: uid(), type: 'comment', x: Number(a.x) || 120, y: Number(a.y) || 120, text: String(a.text).slice(0, 2000), author: String(a.author || 'AI').slice(0, 60), initials: 'AI', color: '#473AE0', ts: Date.now() };
      items.push(it);
      await saveItems(a.projectId, items);
      return { id: it.id, ok: true };
    },
  },

  delete_comment: {
    description: 'Delete a comment by id — works for both canvas comment pins and section comments. Get ids from list_comments.',
    inputSchema: S({ projectId: str('Project id.'), commentId: str('Comment id.') }, ['projectId', 'commentId']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const items = (p.items || []);
      const before = items.length;
      const keptItems = items.filter((i: any) => !(i.type === 'comment' && i.id === a.commentId));
      if (keptItems.length !== before) { await saveItems(a.projectId, keptItems); return { ok: true, kind: 'pin' }; }
      const nodes = p.nodes || []; let found = false;
      nodes.forEach((n: any) => (n.blocks || []).forEach((b: any) => { if (b.comments) { const k = b.comments.filter((c: any) => c.id !== a.commentId); if (k.length !== b.comments.length) { b.comments = k; found = true; } } }));
      if (!found) throw new Error('Comment not found.');
      await saveNodes(a.projectId, nodes);
      return { ok: true, kind: 'section' };
    },
  },

  list_notes: {
    description: 'List all sticky notes on the project canvas (with ids for delete_note).',
    inputSchema: S({ projectId: str('Project id.') }, ['projectId']),
    handler: async (userId, a) => {
      const p = await loadProject(userId, a.projectId);
      if (!p) throw new Error('Project not found or no access.');
      const notes = (p.items || []).filter((i: any) => i.type === 'note').map((i: any) => ({ id: i.id, color: i.color, text: i.text }));
      return { notes };
    },
  },

  add_note: {
    description: 'Add a sticky note to the project canvas. color must be one of: yellow, pink, blue, green (default yellow). x/y are canvas coordinates (optional).',
    inputSchema: S({ projectId: str('Project id.'), text: str('Note text.'), color: { type: 'string', enum: NOTE_KEYS, description: 'Note color (yellow | pink | blue | green; default yellow).' }, x: { type: 'number' }, y: { type: 'number' } }, ['projectId', 'text']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const items = p.items || [];
      const color = NOTE_KEYS.includes(a.color) ? a.color : 'yellow';
      const it = { id: uid(), type: 'note', x: Number(a.x) || 120, y: Number(a.y) || 120, w: 184, h: 184, color, text: String(a.text).slice(0, 4000) };
      items.push(it);
      await saveItems(a.projectId, items);
      return { id: it.id, ok: true, color };
    },
  },

  delete_note: {
    description: 'Delete a sticky note by id (from list_notes).',
    inputSchema: S({ projectId: str('Project id.'), noteId: str('Note id.') }, ['projectId', 'noteId']),
    handler: async (userId, a) => {
      const p = await mustLoad(userId, a.projectId);
      const items = (p.items || []);
      const kept = items.filter((i: any) => !(i.type === 'note' && i.id === a.noteId));
      if (kept.length === items.length) throw new Error('Note not found.');
      await saveItems(a.projectId, kept);
      return { ok: true };
    },
  },

  list_members: {
    description: 'List the people a project is shared with (owner, members, and pending email invites).',
    inputSchema: S({ projectId: str('Project id.') }, ['projectId']),
    handler: async (userId, a) => {
      if (!(await accessRole(a.projectId, userId))) throw new Error('Project not found or no access.');
      const { rows } = await pool.query(
        `SELECT u.id AS user_id, u.name, u.email, 'owner' AS role, false AS pending FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = $1
         UNION ALL SELECT u.id, u.name, u.email, m.role, false FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = $1
         UNION ALL SELECT NULL, i.email, i.email, i.role, true FROM project_invites i WHERE i.project_id = $1`,
        [a.projectId]
      );
      return { members: rows.map((r) => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role, pending: r.pending })) };
    },
  },

  invite_member: {
    description: 'Share a project with someone by email (role: editor or viewer). If they have no account yet, a pending invite is created and claimed when they sign up. Owner only.',
    inputSchema: S({ projectId: str('Project id.'), email: str('Email to invite.'), role: str('editor | viewer (default editor).') }, ['projectId', 'email']),
    handler: async (userId, a) => {
      const role = await accessRole(a.projectId, userId);
      if (role !== 'owner') throw new Error('Only the owner can share this project.');
      const r = ['editor', 'viewer'].includes(a.role) ? a.role : 'editor';
      const email = String(a.email).toLowerCase().trim();
      if (!email) throw new Error('Email is required.');
      const { rows: users } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (users[0]) {
        const { rows: owner } = await pool.query('SELECT user_id FROM projects WHERE id = $1', [a.projectId]);
        if (owner[0].user_id === users[0].id) throw new Error('That user already owns this project.');
        await pool.query('INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role', [a.projectId, users[0].id, r]);
        return { ok: true, pending: false, email, role: r };
      }
      await pool.query('INSERT INTO project_invites (project_id, email, role) VALUES ($1,$2,$3) ON CONFLICT (project_id, email) DO UPDATE SET role = EXCLUDED.role', [a.projectId, email, r]);
      return { ok: true, pending: true, email, role: r };
    },
  },

  remove_member: {
    description: 'Remove someone from a project — pass either userId (existing member) or email (pending invite). Owner only.',
    inputSchema: S({ projectId: str('Project id.'), userId: str('Member user id (optional).'), email: str('Pending invite email (optional).') }, ['projectId']),
    handler: async (userId, a) => {
      const role = await accessRole(a.projectId, userId);
      if (role !== 'owner') throw new Error('Only the owner can manage sharing.');
      if (a.userId) { await pool.query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [a.projectId, a.userId]); return { ok: true }; }
      if (a.email) { await pool.query('DELETE FROM project_invites WHERE project_id = $1 AND email = $2', [a.projectId, String(a.email).toLowerCase().trim()]); return { ok: true }; }
      throw new Error('Provide userId or email.');
    },
  },

  share_project: {
    description: 'Share a sitemap project with someone — BY EMAIL and/or BY URL. Always returns a public read-only link (url) anyone can open without logging in. If "email" is given, the person is also granted access (editor or viewer) and an invitation email containing the link is sent to them (a pending invite is created if they have no account yet). Owner only.',
    inputSchema: S({
      projectId: str('Project id.'),
      email: str('Email to share with (optional — omit to just get the URL).'),
      role: str('editor | viewer (default editor). Only used with email.'),
      message: str('Optional personal note included in the email.'),
    }, ['projectId']),
    handler: async (userId, a) => {
      const role = await accessRole(a.projectId, userId);
      if (!role) throw new Error('Project not found or no access.');
      const { rows: pr } = await pool.query('SELECT name FROM projects WHERE id = $1', [a.projectId]);
      const projectName = pr[0]?.name || 'Untitled';
      const url = shareUrl('sitemap', a.projectId);
      if (!a.email) return { url, projectName, shared: false };

      if (role !== 'owner') throw new Error('Only the owner can share this project by email.');
      const r = ['editor', 'viewer'].includes(a.role) ? a.role : 'editor';
      const email = String(a.email).toLowerCase().trim();
      if (!email) throw new Error('Email is required.');
      const { rows: users } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      let pending = true;
      if (users[0]) {
        const { rows: owner } = await pool.query('SELECT user_id FROM projects WHERE id = $1', [a.projectId]);
        if (owner[0].user_id === users[0].id) throw new Error('That user already owns this project.');
        await pool.query('INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role', [a.projectId, users[0].id, r]);
        pending = false;
      } else {
        await pool.query('INSERT INTO project_invites (project_id, email, role) VALUES ($1,$2,$3) ON CONFLICT (project_id, email) DO UPDATE SET role = EXCLUDED.role', [a.projectId, email, r]);
      }
      let emailSent = true;
      let emailError: string | undefined;
      try { await sendShareEmail(email, { inviter: await inviterName(userId), projectName, role: r, url, message: a.message }); }
      catch (e) { emailSent = false; emailError = (e as Error).message; }
      return { url, projectName, shared: true, email, role: r, pending, emailSent, ...(emailError ? { emailError } : {}) };
    },
  },

  find_active_collab_project: {
    description: 'Look up an Active Collab project by its ID to verify it exists and get its name. Uses the account\'s Active Collab API token (set in Account settings). Use this to search/check a project ID before assigning it.',
    inputSchema: S({ acProjectId: str('Active Collab project ID (number).') }, ['acProjectId']),
    handler: async (userId, a) => {
      const token = await userAcToken(userId);
      if (!token) throw new Error('No Active Collab token set on your account. Add it in Account settings first.');
      const info = await fetchAcProject(token, String(a.acProjectId).trim());
      return { id: info.id, name: info.name };
    },
  },

  set_active_collab: {
    description: 'Assign (or change) the Active Collab project linked to a sitemap project, by Active Collab project ID. The ID is verified against Active Collab and its name is stored. Pass an empty acProjectId to unlink. Requires a role allowed to configure Active Collab.',
    inputSchema: S({ projectId: str('Qoders project id.'), acProjectId: str('Active Collab project ID (empty to unlink).') }, ['projectId']),
    handler: async (userId, a) => {
      const role = await accessRole(a.projectId, userId);
      if (!role) throw new Error('Project not found or no access.');
      if (!canSyncAcRole(role)) throw new Error('Your role can’t configure Active Collab.');
      if ((await teamRoleOf(userId)).role !== 'pm') throw new Error('Only PM can assign an Active Collab project.');
      const raw = String(a.acProjectId || '').trim();
      if (!raw) {
        await pool.query(`UPDATE projects SET ac_project_id = '', ac_project_name = '', updated_at = now() WHERE id = $1`, [a.projectId]);
        return { ok: true, linked: false };
      }
      const token = await userAcToken(userId);
      if (!token) throw new Error('No Active Collab token set on your account. Add it in Account settings first.');
      const info = await fetchAcProject(token, raw);
      await pool.query(`UPDATE projects SET ac_project_id = $1, ac_project_name = $2, updated_at = now() WHERE id = $3`, [info.id, info.name, a.projectId]);
      return { ok: true, linked: true, acProjectId: info.id, acProjectName: info.name };
    },
  },

  sync_active_collab: {
    description: 'Synchronize ALL pages of a sitemap project with Active Collab: each page becomes (or updates) one Active Collab task whose body lists the page, its sections and section comments. The project must already have an Active Collab project linked (set_active_collab). If a page was synced before but its task was deleted in Active Collab, a new task is created. Set onlyNew:true to sync only pages that have never been synced. Returns one row per page with its task number.',
    inputSchema: S({ projectId: str('Qoders project id.'), onlyNew: { type: 'boolean', description: 'Only sync pages not yet synced (default false = all pages).' } }, ['projectId']),
    handler: async (userId, a) => {
      const role = await accessRole(a.projectId, userId);
      if (!role) throw new Error('Project not found or no access.');
      if (!canSyncAcRole(role)) throw new Error('Your role can’t sync with Active Collab.');
      const { rows: pr } = await pool.query('SELECT ac_project_id, nodes FROM projects WHERE id = $1', [a.projectId]);
      const acProjectId = pr[0]?.ac_project_id || '';
      if (!acProjectId) throw new Error('No Active Collab project assigned. Link one first with set_active_collab.');
      const token = await userAcToken(userId);
      if (!token) throw new Error('No Active Collab token set on your account. Add it in Account settings first.');
      const nodes = pr[0]?.nodes || [];
      if (!nodes.length) throw new Error('This project has no pages to sync.');

      const results: any[] = [];
      for (const n of nodes) {
        if (a.onlyNew && n.acTaskId) { results.push({ page: n.label || 'Page', skipped: true, taskNumber: n.acTaskNumber || n.acTaskId }); continue; }
        try {
          const out = await syncAcTask(token, acProjectId, { name: n.label || 'Page', body: buildTaskBody(n), taskId: n.acTaskId || '' }); // eslint-disable-line no-await-in-loop
          n.acTaskId = out.taskId; n.acTaskNumber = out.taskNumber || out.taskId;
          (n.blocks || []).forEach((b: any) => { b.acTaskId = out.taskId; b.acTaskNumber = out.taskNumber || out.taskId; });
          results.push({ page: n.label || 'Page', ok: true, taskId: out.taskId, taskNumber: out.taskNumber || out.taskId });
        } catch (e) {
          results.push({ page: n.label || 'Page', ok: false, error: (e as Error).message });
        }
      }
      await saveNodes(a.projectId, nodes);
      const synced = results.filter((r) => r.ok).length;
      return { ok: true, pages: nodes.length, synced, results };
    },
  },

  /* ========================= Markup module ========================= */
  markup_list_projects: {
    description: 'List all Markup projects (websites annotated with comment pins) the user can access, with id, name, type (url/zip), comment counts and timestamps.',
    inputSchema: S({}),
    handler: async (userId) => ({ projects: await mkListProjects(userId) }),
  },

  markup_get_project: {
    description: 'Get a Markup project in full: its versions and all comments. Each comment is richly structured for precise fixes: "type" (spacing|color|copy|typography|layout|remove|add|animation|bug|other), "scope" (element|all-similar|section|global), "desiredValue" (explicit target if given), "screenshot" (URL of the region), and an "anchor" { mkId (stable data-mk-id — primary locator), selector, tag, id, classes, text, html, parents, sectionId, sectionHeading, computedStyles (current values) }. To fix: find the element by anchor.mkId (data-mk-id="…") or anchor.selector, use computedStyles for current values + desiredValue/type/scope for intent, then edit the page (Design save / version files).',
    inputSchema: S({ projectId: str('Markup project id.') }, ['projectId']),
    handler: async (userId, a) => {
      const p = await mkGetProjectRow(userId, a.projectId);
      if (!p) throw new Error('Markup project not found or no access.');
      return { project: markupProjectApi(p), versions: await mkListVersions(a.projectId), comments: await mkListProjectComments(a.projectId) };
    },
  },

  markup_share_project: {
    description: 'Share a Markup project with someone — BY EMAIL and/or BY URL. Always returns a public read-only link (url) anyone can open without logging in to view the annotated site and comments. If "email" is given, the person is also granted access (editor or viewer) and an invitation email with the link is sent (a pending invite is created if they have no account yet). Owner only for email sharing.',
    inputSchema: S({
      projectId: str('Markup project id.'),
      email: str('Email to share with (optional — omit to just get the URL).'),
      role: str('editor | viewer (default editor). Only used with email.'),
      message: str('Optional personal note included in the email.'),
    }, ['projectId']),
    handler: async (userId, a) => {
      const role = await markupAccessRole(a.projectId, userId);
      if (!role) throw new Error('Markup project not found or no access.');
      const { rows: pr } = await pool.query('SELECT name FROM markup_projects WHERE id = $1', [a.projectId]);
      const projectName = pr[0]?.name || 'Untitled';
      const url = shareUrl('markup', a.projectId);
      if (!a.email) return { url, projectName, shared: false };

      if (role !== 'owner') throw new Error('Only the owner can share this project by email.');
      const r = ['editor', 'viewer'].includes(a.role) ? a.role : 'editor';
      const email = String(a.email).toLowerCase().trim();
      if (!email) throw new Error('Email is required.');
      const { rows: users } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      let pending = true;
      if (users[0]) {
        const { rows: owner } = await pool.query('SELECT user_id FROM markup_projects WHERE id = $1', [a.projectId]);
        if (owner[0].user_id === users[0].id) throw new Error('That user already owns this project.');
        await pool.query('INSERT INTO markup_members (project_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role', [a.projectId, users[0].id, r]);
        pending = false;
      } else {
        await pool.query('INSERT INTO markup_invites (project_id, email, role) VALUES ($1,$2,$3) ON CONFLICT (project_id, email) DO UPDATE SET role = EXCLUDED.role', [a.projectId, email, r]);
      }
      let emailSent = true;
      let emailError: string | undefined;
      try { await sendShareEmail(email, { inviter: await inviterName(userId), projectName, role: r, url, message: a.message }); }
      catch (e) { emailSent = false; emailError = (e as Error).message; }
      return { url, projectName, shared: true, email, role: r, pending, emailSent, ...(emailError ? { emailError } : {}) };
    },
  },

  markup_set_active_collab: {
    description: 'Assign (or change) the Active Collab project linked to a Markup project, by Active Collab project ID. The ID is verified against Active Collab and its name is stored. Pass an empty acProjectId to unlink. Requires a role allowed to configure Active Collab.',
    inputSchema: S({ projectId: str('Markup project id.'), acProjectId: str('Active Collab project ID (empty to unlink).') }, ['projectId']),
    handler: async (userId, a) => {
      const role = await markupAccessRole(a.projectId, userId);
      if (!role) throw new Error('Markup project not found or no access.');
      if (!canSyncAcRole(role)) throw new Error('Your role can’t configure Active Collab.');
      if ((await teamRoleOf(userId)).role !== 'pm') throw new Error('Only PM can assign an Active Collab project.');
      const raw = String(a.acProjectId || '').trim();
      if (!raw) {
        await pool.query(`UPDATE markup_projects SET ac_project_id = '', ac_project_name = '', updated_at = now() WHERE id = $1`, [a.projectId]);
        return { ok: true, linked: false };
      }
      const token = await userAcToken(userId);
      if (!token) throw new Error('No Active Collab token set on your account. Add it in Account settings first.');
      const info = await fetchAcProject(token, raw);
      await pool.query(`UPDATE markup_projects SET ac_project_id = $1, ac_project_name = $2, updated_at = now() WHERE id = $3`, [info.id, info.name, a.projectId]);
      return { ok: true, linked: true, acProjectId: info.id, acProjectName: info.name };
    },
  },

  markup_create_url_project: {
    description: 'Create a new Markup project from a live website URL. A first version (v1) is created automatically and a screenshot captured in the background.',
    inputSchema: S({ name: str('Project name (optional; defaults to the site host).'), url: str('The website URL to annotate.') }, ['url']),
    handler: async (userId, a) => mkCreateUrlProject(userId, a.name, a.url),
  },

  markup_create_zip_project: {
    description: 'Create a new Markup project from a static-site ZIP, sending the whole ZIP as one base64 string. ONLY use this for SMALL files (a few hundred KB). For anything larger, use the chunked flow instead: markup_upload_begin → markup_upload_chunk (repeat) → markup_upload_finish(action:"create_project") — it is far more reliable. The ZIP is unpacked into version v1 and its HTML pages become selectable pages.',
    inputSchema: S({ name: str('Project name (optional).'), zipBase64: str('The .zip file content as base64 (or data:...;base64,... URL).') }, ['zipBase64']),
    handler: async (userId, a) => {
      const buf = markupDecodeZip(a.zipBase64);
      return mkCreateZipProject(userId, a.name, buf);
    },
  },

  markup_rename_project: {
    description: 'Rename a Markup project.',
    inputSchema: S({ projectId: str('Markup project id.'), name: str('New name.') }, ['projectId', 'name']),
    handler: async (userId, a) => { await mkMustEdit(userId, a.projectId); return mkRenameProject(a.projectId, a.name); },
  },

  markup_set_project_status: {
    description: 'Archive/unarchive or mark a Markup project complete/incomplete.',
    inputSchema: S({ projectId: str('Markup project id.'), archived: { type: 'boolean' }, completed: { type: 'boolean' } }, ['projectId']),
    handler: async (userId, a) => { await mkMustEdit(userId, a.projectId); return mkSetStatus(a.projectId, { archived: a.archived, completed: a.completed }); },
  },

  markup_duplicate_project: {
    description: 'Duplicate a Markup project (copies all versions and their files). The copy is owned by the user.',
    inputSchema: S({ projectId: str('Markup project id.') }, ['projectId']),
    handler: async (userId, a) => {
      if (!(await markupAccessRole(a.projectId, userId))) throw new Error('Markup project not found or no access.');
      return mkDuplicateProject(userId, a.projectId);
    },
  },

  markup_delete_project: {
    description: 'Delete a Markup project (owner: permanently removes it + files; a shared member: just leaves the project).',
    inputSchema: S({ projectId: str('Markup project id.') }, ['projectId']),
    handler: async (userId, a) => {
      const role = await markupAccessRole(a.projectId, userId);
      if (!role) throw new Error('Markup project not found or no access.');
      await mkDeleteProject(userId, a.projectId, role);
      return { ok: true };
    },
  },

  markup_leave_project: {
    description: 'Leave a Markup project that was shared with you (removes your access). Only for shared members — the owner cannot leave their own project (use markup_delete_project instead).',
    inputSchema: S({ projectId: str('Markup project id.') }, ['projectId']),
    handler: async (userId, a) => {
      const role = await markupAccessRole(a.projectId, userId);
      if (!role) throw new Error('Markup project not found or no access.');
      if (role === 'owner') throw new Error('You own this project — you can’t leave it. Delete it instead if you want it gone.');
      const r = await pool.query('DELETE FROM markup_members WHERE project_id = $1 AND user_id = $2', [a.projectId, userId]);
      if (!r.rowCount) throw new Error('You don’t have a removable membership on this project (access may be via your team).');
      return { ok: true, left: true };
    },
  },

  markup_list_versions: {
    description: 'List the versions of a Markup project (v1, v2, …), each with its type, url and pages.',
    inputSchema: S({ projectId: str('Markup project id.') }, ['projectId']),
    handler: async (userId, a) => {
      if (!(await markupAccessRole(a.projectId, userId))) throw new Error('Markup project not found or no access.');
      return { versions: await mkListVersions(a.projectId) };
    },
  },

  markup_add_url_version: {
    description: 'Add a URL version to a Markup project. By default (mode "new") it creates a NEW version with its own comments. Set mode "current" to REPLACE the current (latest) version\'s page in place, keeping that version\'s existing comments — use this when you just want to swap the HTML rather than start a new review round.',
    inputSchema: S({ projectId: str('Markup project id.'), url: str('Website URL.'), mode: { type: 'string', enum: ['new', 'current'], description: 'new = create a new version (default); current = replace the latest version in place.' } }, ['projectId', 'url']),
    handler: async (userId, a) => {
      await mkMustEdit(userId, a.projectId);
      return a.mode === 'current' ? mkReplaceCurrentVersion(a.projectId, { type: 'url', url: a.url }) : mkAddUrlVersion(a.projectId, a.url);
    },
  },

  markup_add_zip_version: {
    description: 'Add a ZIP version to a Markup project by sending the whole ZIP as one base64 string. ONLY for SMALL files — for larger ones use the chunked flow: markup_upload_begin → markup_upload_chunk (repeat) → markup_upload_finish(action:"add_version"). By default (mode "new") it creates a NEW version with its own comments. Set mode "current" to REPLACE the current (latest) version\'s pages in place, keeping that version\'s existing comments.',
    inputSchema: S({ projectId: str('Markup project id.'), zipBase64: str('The .zip content as base64.'), mode: { type: 'string', enum: ['new', 'current'], description: 'new = create a new version (default); current = replace the latest version in place.' } }, ['projectId', 'zipBase64']),
    handler: async (userId, a) => {
      await mkMustEdit(userId, a.projectId);
      const buf = markupDecodeZip(a.zipBase64);
      return a.mode === 'current' ? mkReplaceCurrentVersion(a.projectId, { type: 'zip', buf }) : mkAddZipVersion(a.projectId, buf);
    },
  },

  markup_export_version: {
    description: 'Download a Markup version as a ZIP (returned as base64) so you can work with its HTML files locally. Pass a versionId for a specific version, OR just a projectId to get the LATEST version (if neither is given but only one project exists, this still needs a projectId). Works for ZIP-type versions (their stored static-site files are zipped); URL versions have no stored files and the tool returns the live URL instead.',
    inputSchema: S({ projectId: str('Markup project id (used to pick the latest version when versionId is omitted).'), versionId: str('Specific version id (optional; from markup_list_versions).') }),
    handler: async (userId, a) => {
      let versionId = a.versionId;
      let projectId: string | null;
      if (versionId) {
        projectId = await mkProjectOfVersion(versionId);
        if (!projectId) throw new Error('Version not found.');
      } else {
        projectId = a.projectId || null;
        if (!projectId) throw new Error('Provide a versionId or a projectId.');
        const { rows } = await pool.query('SELECT id FROM markup_versions WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1', [projectId]);
        if (!rows[0]) throw new Error('This project has no versions.');
        versionId = rows[0].id;
      }
      if (!(await markupAccessRole(projectId, userId))) throw new Error('Markup project not found or no access.');
      return mkExportVersionZip(versionId);
    },
  },

  markup_create_zip_from_path: {
    description: 'FASTEST when you (the MCP client) run on the SAME machine as this server: create a Markup project from a .zip ALREADY ON DISK, given its absolute path. The server reads the file directly — no base64, no chunking, near-instant. Write your ZIP to a temp file first, then pass its path.',
    inputSchema: S({ name: str('Project name (optional).'), path: str('Absolute path to the .zip on this machine.') }, ['path']),
    handler: async (userId, a) => { const buf = mkReadZipFromPath(a.path); return mkCreateZipProject(userId, a.name, buf); },
  },

  markup_add_zip_version_from_path: {
    description: 'FASTEST (same machine): add a ZIP version from a .zip already on disk (absolute path). mode "new" (default) adds a new version; "current" replaces the latest in place keeping its comments. No base64 — the server reads the file directly.',
    inputSchema: S({ projectId: str('Markup project id.'), path: str('Absolute path to the .zip on this machine.'), mode: { type: 'string', enum: ['new', 'current'], description: 'new (default) or current.' } }, ['projectId', 'path']),
    handler: async (userId, a) => {
      await mkMustEdit(userId, a.projectId);
      const buf = mkReadZipFromPath(a.path);
      return a.mode === 'current' ? mkReplaceCurrentVersion(a.projectId, { type: 'zip', buf }) : mkAddZipVersion(a.projectId, buf);
    },
  },

  markup_create_zip_from_url: {
    description: 'FASTEST + safe way to create a Markup project from a ZIP: the server downloads the .zip directly from a URL (one call, no base64). Use this whenever the ZIP is reachable at an http(s) URL. The ZIP is unpacked into version v1.',
    inputSchema: S({ name: str('Project name (optional; defaults from the files).'), url: str('Direct http(s) URL to the .zip file.') }, ['url']),
    handler: async (userId, a) => { const buf = await mkFetchZipBuffer(a.url); return mkCreateZipProject(userId, a.name, buf); },
  },

  markup_add_zip_version_from_url: {
    description: 'FASTEST + safe way to add a ZIP version: the server downloads the .zip directly from a URL. mode "new" (default) adds a new version; mode "current" replaces the latest version in place keeping its comments.',
    inputSchema: S({ projectId: str('Markup project id.'), url: str('Direct http(s) URL to the .zip file.'), mode: { type: 'string', enum: ['new', 'current'], description: 'new (default) or current.' } }, ['projectId', 'url']),
    handler: async (userId, a) => {
      await mkMustEdit(userId, a.projectId);
      const buf = await mkFetchZipBuffer(a.url);
      return a.mode === 'current' ? mkReplaceCurrentVersion(a.projectId, { type: 'zip', buf }) : mkAddZipVersion(a.projectId, buf);
    },
  },

  markup_upload_begin: {
    description: 'Start a CHUNKED upload session for a Markup ZIP when you have the file BYTES (not a URL). Prefer markup_create_zip_from_url / markup_add_zip_version_from_url when a URL exists (one fast call). Otherwise use this: returns an uploadId, then call markup_upload_chunk with large base64 pieces (up to ~4MB each) in order, and finish with markup_upload_finish. Reliable for big files; fewer, larger chunks = faster.',
    inputSchema: S({}),
    handler: async (userId) => mkUploadBegin(userId),
  },

  markup_upload_chunk: {
    description: 'Append ONE base64 chunk to an upload session (from markup_upload_begin). Send big pieces — up to ~4MB of base64 per call — in order, to keep it fast. Returns the running byte total. Repeat until the whole file is sent, then call markup_upload_finish.',
    inputSchema: S({ uploadId: str('Upload session id from markup_upload_begin.'), dataBase64: str('One chunk of the .zip as base64 (raw base64, no data: prefix).') }, ['uploadId', 'dataBase64']),
    handler: async (userId, a) => mkUploadChunk(userId, a.uploadId, a.dataBase64),
  },

  markup_upload_finish: {
    description: 'Finish a chunked upload and use the assembled ZIP. action "create_project" creates a NEW Markup project from the ZIP (pass name). action "add_version" adds it to an existing project (pass projectId; mode "new" for a new version or "current" to replace the latest in place).',
    inputSchema: S({ uploadId: str('Upload session id.'), action: { type: 'string', enum: ['create_project', 'add_version'], description: 'create_project | add_version.' }, name: str('Project name (for create_project).'), projectId: str('Project id (for add_version).'), mode: { type: 'string', enum: ['new', 'current'], description: 'add_version: new (default) or current (replace latest).' } }, ['uploadId', 'action']),
    handler: async (userId, a) => {
      if (a.action === 'create_project') {
        const buf = mkUploadTake(userId, a.uploadId);
        return mkCreateZipProject(userId, a.name, buf);
      }
      if (a.action === 'add_version') {
        if (!a.projectId) throw new Error('projectId is required for add_version.');
        await mkMustEdit(userId, a.projectId);
        const buf = mkUploadTake(userId, a.uploadId);
        return a.mode === 'current' ? mkReplaceCurrentVersion(a.projectId, { type: 'zip', buf }) : mkAddZipVersion(a.projectId, buf);
      }
      throw new Error('Unknown action. Use create_project or add_version.');
    },
  },

  markup_list_comments: {
    description: 'List all comments of a Markup project. Each comment is structured for precise fixes: type (spacing|color|copy|typography|layout|remove|add|animation|bug|other), scope (element|all-similar|section|global), desiredValue, screenshot (region URL), and anchor { mkId (stable data-mk-id, primary locator), selector, tag, classes, text, html, parents, sectionId, sectionHeading, computedStyles (current values) }, plus page + x/y. Locate by mkId or selector, read computedStyles + desiredValue + type/scope for the intent, then apply the fix. Also includes author, priority, resolved, replies, mentions.',
    inputSchema: S({ projectId: str('Markup project id.') }, ['projectId']),
    handler: async (userId, a) => {
      if (!(await markupAccessRole(a.projectId, userId))) throw new Error('Markup project not found or no access.');
      return { comments: await mkListProjectComments(a.projectId) };
    },
  },

  markup_add_comment: {
    description: 'Add a comment pin to a specific version of a Markup project. x and y are 0..1 fractions of the page (default 0.5, 0.2). page is the sub-page path/URL (empty for the main page). Optionally attach files (each { name, fileBase64 }).',
    inputSchema: S({
      versionId: str('Version id (from markup_list_versions).'), text: str('Comment text.'), page: str('Sub-page path/URL (optional).'),
      x: { type: 'number', description: '0..1 horizontal position.' }, y: { type: 'number', description: '0..1 vertical position.' },
      priority: str('none | low | medium | high.'),
      files: { type: 'array', description: 'Optional file attachments.', items: { type: 'object', additionalProperties: false, properties: { name: str('File name with extension.'), fileBase64: str('base64 or data: URL.') }, required: ['name', 'fileBase64'] } },
    }, ['versionId', 'text']),
    handler: async (userId, a) => {
      const projectId = await mkProjectOfVersion(a.versionId);
      if (!projectId) throw new Error('Version not found.');
      await mkMustEdit(userId, projectId);
      const attachments = saveFiles(a.files);
      return mkAddComment(a.versionId, projectId, userId, { page: a.page, x: a.x ?? 0.5, y: a.y ?? 0.2, text: a.text, author: 'AI', priority: a.priority, attachments });
    },
  },

  markup_add_comment_file: {
    description: 'Attach a file (image, PDF, doc, etc.) to an existing Markup comment. Provide the file as base64 (raw base64 or a data: URL) in fileBase64, plus its name. Max 30MB.',
    inputSchema: S({ commentId: str('Comment id.'), name: str('File name with extension.'), fileBase64: str('File content as base64 or data:...;base64,... URL.') }, ['commentId', 'name', 'fileBase64']),
    handler: async (userId, a) => {
      const projectId = await mkProjectOfComment(a.commentId);
      if (!projectId) throw new Error('Comment not found.');
      await mkMustEdit(userId, projectId);
      const att = saveAttachment(a.fileBase64, a.name);
      const comment = await mkAppendCommentAttachments(a.commentId, [att]);
      return { attachment: att, comment, ok: true };
    },
  },

  markup_update_comment: {
    description: 'Update a Markup comment: resolve/reopen, change priority, or edit its text.',
    inputSchema: S({ commentId: str('Comment id.'), resolved: { type: 'boolean' }, priority: str('none | low | medium | high.'), text: str('New text.') }, ['commentId']),
    handler: async (userId, a) => {
      const projectId = await mkProjectOfComment(a.commentId);
      if (!projectId) throw new Error('Comment not found.');
      await mkMustEdit(userId, projectId);
      return mkUpdateComment(a.commentId, { resolved: a.resolved, priority: a.priority, text: a.text });
    },
  },

  markup_delete_comment: {
    description: 'Delete a Markup comment.',
    inputSchema: S({ commentId: str('Comment id.') }, ['commentId']),
    handler: async (userId, a) => {
      const projectId = await mkProjectOfComment(a.commentId);
      if (!projectId) throw new Error('Comment not found.');
      await mkMustEdit(userId, projectId);
      await mkDeleteComment(a.commentId);
      return { ok: true };
    },
  },

  /* ------------------------ Style Guides (styleguide_* tools) ------------------------ *
   * A style guide is a self-contained design-system document: one HTML doc with a token
   * layer (CSS variables for colours, typography, spacing) plus sections for brand, forms
   * and components. The whole design system is the `content` (an HTML string). To change a
   * token or text, read the content, edit the HTML/CSS, then write it back with
   * styleguide_update_content. Available to all roles; AC linking is PM-only.            */
  styleguide_list_projects: {
    description: 'List all style guides the user owns or can edit (id, name, status, timestamps). Content is omitted here — use styleguide_get_project to read a guide in full.',
    inputSchema: S({}),
    handler: async (userId) => {
      const { rows } = await pool.query(
        `SELECT s.id, s.name, s.archived, s.completed, s.updated_at, s.ac_project_id, s.ac_project_name,
                CASE WHEN s.user_id = $1 THEN 'owner' ELSE m.role END AS role
         FROM style_guides s LEFT JOIN style_guide_members m ON m.style_guide_id = s.id AND m.user_id = $1
         WHERE s.user_id = $1 OR m.user_id = $1
            OR EXISTS (SELECT 1 FROM team_members om JOIN team_members mine ON mine.team_id = om.team_id AND mine.user_id = $1 WHERE om.user_id = s.user_id AND mine.role = 'pm')
         ORDER BY s.updated_at DESC`,
        [userId]
      );
      return rows.map((r) => ({ id: r.id, name: r.name, archived: r.archived, completed: r.completed, role: r.role, acProjectId: r.ac_project_id || '', acProjectName: r.ac_project_name || '', updatedAt: new Date(r.updated_at).toISOString() }));
    },
  },

  styleguide_get_project: {
    description: 'Get one style guide in full, including its `content` — the complete design-system HTML document (token CSS variables + brand/colour/typography/components sections).',
    inputSchema: S({ styleGuideId: str('The style guide id.') }, ['styleGuideId']),
    handler: async (userId, a) => {
      const role = await sgAccessRole(a.styleGuideId, userId);
      if (!role) throw new Error('Style guide not found or no access.');
      const { rows } = await pool.query('SELECT id, name, content, settings, archived, completed, ac_project_id, ac_project_name FROM style_guides WHERE id = $1', [a.styleGuideId]);
      const r = rows[0];
      return { id: r.id, name: r.name, role, content: r.content || '', settings: r.settings || {}, archived: r.archived, completed: r.completed, acProjectId: r.ac_project_id || '', acProjectName: r.ac_project_name || '' };
    },
  },

  styleguide_create_project: {
    description: 'Create a new style guide. If `content` (an HTML document) is omitted, it is seeded from the bundled design-system template that you can then edit. Returns the new style guide id.',
    inputSchema: S({ name: str('Style guide name.'), content: str('Optional full HTML document to use as the initial design system.') }, ['name']),
    handler: async (userId, a) => {
      const html = (typeof a.content === 'string' && a.content.length) ? a.content : defaultStyleGuideHtml();
      const { rows } = await pool.query(
        'INSERT INTO style_guides (user_id, name, content, settings) VALUES ($1,$2,$3,$4) RETURNING id, name',
        [userId, String(a.name || 'Untitled style guide').slice(0, 120), html, '{}']
      );
      return { id: rows[0].id, name: rows[0].name };
    },
  },

  styleguide_update_content: {
    description: 'Replace a style guide\'s `content` with a new HTML document. Read the current content with styleguide_get_project first, edit the HTML/CSS (e.g. change a CSS variable in :root, a colour, a font, or section copy), then write the whole document back here.',
    inputSchema: S({ styleGuideId: str('Style guide id.'), content: str('The full updated HTML document.') }, ['styleGuideId', 'content']),
    handler: async (userId, a) => {
      await sgMustEdit(userId, a.styleGuideId);
      await pool.query('UPDATE style_guides SET content = $1, updated_at = now() WHERE id = $2', [String(a.content || ''), a.styleGuideId]);
      return { ok: true };
    },
  },

  styleguide_get_tokens: {
    description: 'Read a style guide\'s design tokens — the :root CSS variables (colours, fonts, type scale, spacing, radii, breakpoints, component tokens) — as a flat name→value map, plus a structured `theme` (brand palette by role, heading/body fonts, type scale). Prefer this over reading the raw HTML. Edit with styleguide_set_tokens.',
    inputSchema: S({ styleGuideId: str('Style guide id.') }, ['styleGuideId']),
    handler: async (userId, a) => {
      const role = await sgAccessRole(a.styleGuideId, userId);
      if (!role) throw new Error('Style guide not found or no access.');
      const { rows } = await pool.query('SELECT content FROM style_guides WHERE id = $1', [a.styleGuideId]);
      const content = rows[0]?.content || '';
      return { tokens: parseAllTokens(content), theme: themeFromContent(content) };
    },
  },

  styleguide_set_tokens: {
    description: 'Set one or more design tokens on a style guide and have them propagate everywhere that uses them — no HTML editing needed. Pass a map like {"--color-brand":"#16A34A","--text-h1":"72px","--radius-button":"6px","--font-heading":"Lora"}. Tokens are applied as :root overrides; webfonts for --font-* values are loaded automatically. Set a token to "" to clear an override. Call styleguide_get_tokens first to see available names. Common tokens: --color-brand/-accent/-muted/-surface-page/-surface-alt/-surface-card, --font-heading/-body, --text-h1…h6 (and -t/-m for tablet/mobile), --text-body-lg, --fw-h1…h6/-body, --section-padding-y, --container-max-width, --gap, --radius-card/-button/-input/-image/-icon-btn/-tag, --link-color, --btn-bg/-text, --card-bg, --nav-bg, --footer-bg, --bp-tablet/-mobile.',
    inputSchema: S({
      styleGuideId: str('Style guide id.'),
      tokens: { type: 'object', additionalProperties: { type: 'string' }, description: 'Map of CSS variable name (e.g. "--color-brand") to value (e.g. "#16A34A", "72px", "Lora"). Value "" removes the override.' },
    }, ['styleGuideId', 'tokens']),
    handler: async (userId, a) => {
      await sgMustEdit(userId, a.styleGuideId);
      const { rows } = await pool.query('SELECT content FROM style_guides WHERE id = $1', [a.styleGuideId]);
      const next = setRootTokens(rows[0]?.content || '', (a.tokens || {}) as Record<string, string>);
      await pool.query('UPDATE style_guides SET content = $1, updated_at = now() WHERE id = $2', [next, a.styleGuideId]);
      return { ok: true, tokens: parseAllTokens(next) };
    },
  },

  styleguide_get_css: {
    description: 'Get this style guide as a ready-to-use stylesheet so you can build NEW HTML that inherits its design system directly. Returns `fonts` (Google-Fonts <link> tags), `css` (the full token + base + component CSS with the guide\'s CURRENT token values incl. overrides), and `usage` (the building blocks to author with). Put `fonts` and `<style>{css}</style>` in your page <head>, then write semantic HTML using the listed tags/classes — it renders on-brand and responsive. For a finished page in one call, use styleguide_build_page.',
    inputSchema: S({ styleGuideId: str('Style guide id.') }, ['styleGuideId']),
    handler: async (userId, a) => {
      const role = await sgAccessRole(a.styleGuideId, userId);
      if (!role) throw new Error('Style guide not found or no access.');
      const { rows } = await pool.query('SELECT content FROM style_guides WHERE id = $1', [a.styleGuideId]);
      const head = styleGuideHead(rows[0]?.content || '');
      return { fonts: head.fonts, css: head.css, usage: SG_USAGE };
    },
  },

  styleguide_build_page: {
    description: 'Build a complete, standalone HTML page that uses this style guide directly. Provide `bodyHtml` (the page content as semantic HTML using the design-system building blocks) and an optional `title`; returns a full HTML document with the guide\'s fonts, design tokens (incl. current overrides) and styles wired in, so it is on-brand and responsive with no extra CSS. Building blocks: ' + SG_USAGE.replace(/\n/g, ' '),
    inputSchema: S({
      styleGuideId: str('Style guide id.'),
      bodyHtml: str('The page body as HTML using the design-system tags/classes (h1-h6, p, a, ul/ol, blockquote, label/input/textarea/select, .btn / .btn-secondary, .container, .section / .section.alt, .grid.cols-2|3|4, .card, .demo-nav, .demo-footer, .eyebrow, .lead, .caption). Do not include <html>/<head>/<body> — only the inner body content.'),
      title: str('Optional page <title>.'),
    }, ['styleGuideId', 'bodyHtml']),
    handler: async (userId, a) => {
      const role = await sgAccessRole(a.styleGuideId, userId);
      if (!role) throw new Error('Style guide not found or no access.');
      const { rows } = await pool.query('SELECT content FROM style_guides WHERE id = $1', [a.styleGuideId]);
      return { html: buildPageFromStyleGuide(rows[0]?.content || '', String(a.bodyHtml || ''), a.title) };
    },
  },

  styleguide_rename_project: {
    description: 'Rename a style guide.',
    inputSchema: S({ styleGuideId: str('Style guide id.'), name: str('New name.') }, ['styleGuideId', 'name']),
    handler: async (userId, a) => {
      await sgMustEdit(userId, a.styleGuideId);
      await pool.query('UPDATE style_guides SET name = $1, updated_at = now() WHERE id = $2', [String(a.name).slice(0, 120), a.styleGuideId]);
      return { ok: true };
    },
  },

  styleguide_set_status: {
    description: 'Archive/unarchive or mark a style guide complete/incomplete.',
    inputSchema: S({ styleGuideId: str('Style guide id.'), archived: { type: 'boolean' }, completed: { type: 'boolean' } }, ['styleGuideId']),
    handler: async (userId, a) => {
      await sgMustEdit(userId, a.styleGuideId);
      const sets: string[] = []; const vals: any[] = []; let i = 1;
      if (typeof a.archived === 'boolean') { sets.push(`archived = $${i++}`); vals.push(a.archived); }
      if (typeof a.completed === 'boolean') { sets.push(`completed = $${i++}`); vals.push(a.completed); }
      if (!sets.length) throw new Error('Nothing to update.');
      vals.push(a.styleGuideId);
      await pool.query(`UPDATE style_guides SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i}`, vals);
      return { ok: true };
    },
  },

  styleguide_duplicate_project: {
    description: 'Make a full copy of a style guide. The copy is owned by the user.',
    inputSchema: S({ styleGuideId: str('Style guide id.'), name: str('Optional name for the copy.') }, ['styleGuideId']),
    handler: async (userId, a) => {
      const role = await sgAccessRole(a.styleGuideId, userId);
      if (!role) throw new Error('Style guide not found or no access.');
      const { rows: src } = await pool.query('SELECT * FROM style_guides WHERE id = $1', [a.styleGuideId]);
      const s = src[0];
      const { rows } = await pool.query(
        'INSERT INTO style_guides (user_id, name, content, settings) VALUES ($1,$2,$3,$4) RETURNING id, name',
        [userId, String(a.name || `${s.name} copy`).slice(0, 120), s.content, JSON.stringify(s.settings)]
      );
      return { id: rows[0].id, name: rows[0].name };
    },
  },

  styleguide_delete_project: {
    description: 'Delete a style guide you own, or leave one that was shared with you.',
    inputSchema: S({ styleGuideId: str('Style guide id.') }, ['styleGuideId']),
    handler: async (userId, a) => {
      const role = await sgAccessRole(a.styleGuideId, userId);
      if (!role) throw new Error('Style guide not found or no access.');
      if (role === 'owner') await pool.query('DELETE FROM style_guides WHERE id = $1', [a.styleGuideId]);
      else await pool.query('DELETE FROM style_guide_members WHERE style_guide_id = $1 AND user_id = $2', [a.styleGuideId, userId]);
      return { ok: true };
    },
  },

  styleguide_set_active_collab: {
    description: 'Link (or unlink) an Active Collab project to a style guide. Pass an acProjectId to verify + link it, or "" to clear the link. PM only.',
    inputSchema: S({ styleGuideId: str('Style guide id.'), acProjectId: str('Active Collab project id, or "" to unlink.') }, ['styleGuideId', 'acProjectId']),
    handler: async (userId, a) => {
      await sgMustEdit(userId, a.styleGuideId);
      if ((await teamRoleOf(userId)).role !== 'pm') throw new Error('Only PM can assign an Active Collab project.');
      const raw = String(a.acProjectId || '').trim();
      if (!raw) {
        await pool.query(`UPDATE style_guides SET ac_project_id = '', ac_project_name = '', updated_at = now() WHERE id = $1`, [a.styleGuideId]);
        return { ok: true, acProjectId: '', acProjectName: '' };
      }
      const acToken = await userAcToken(userId);
      const info = await fetchAcProject(acToken, raw);
      await pool.query('UPDATE style_guides SET ac_project_id = $1, ac_project_name = $2, updated_at = now() WHERE id = $3', [info.id, info.name, a.styleGuideId]);
      return { ok: true, acProjectId: info.id, acProjectName: info.name };
    },
  },

  /* ----------------------------- Projects (page documents) ----------------------------- */
  project_list: {
    description: 'List the page-based Projects (the "Projects" tab — a document of pages) you can access. Returns id, name, page count and dates. NOTE: these are different from sitemap projects (list_projects).',
    inputSchema: S({}),
    handler: async (userId) => {
      const { rows } = await pool.query(
        `SELECT b.* FROM boards b
           LEFT JOIN board_members m ON m.board_id = b.id AND m.user_id = $1
          WHERE b.user_id = $1 OR m.user_id = $1
             OR EXISTS (SELECT 1 FROM team_members om JOIN team_members mine ON mine.team_id = om.team_id AND mine.user_id = $1 WHERE om.user_id = b.user_id AND mine.role = 'pm')
          ORDER BY b.updated_at DESC`, [userId]);
      return { projects: rows.map((r: any) => ({ id: r.id, name: r.name, pages: boardPages(r.items).length, createdAt: r.created_at, updatedAt: r.updated_at, acProjectId: r.ac_project_id || '' })) };
    },
  },
  project_get: {
    description: 'Get a Project with its pages. Each page has id + name, and (unless includeContent=false) its content as Markdown.',
    inputSchema: S({ projectId: str('The Project id.'), includeContent: { type: 'boolean', description: 'Include each page content as Markdown (default true).' } }, ['projectId']),
    handler: async (userId, a) => {
      const b = await loadBoard(userId, a.projectId);
      if (!b) throw new Error('Project not found or you do not have access to it.');
      const pages = boardPages(b.items);
      return {
        id: b.id, name: b.name, acProjectId: b.ac_project_id || '', acProjectName: b.ac_project_name || '',
        pages: pages.map((p) => ({ id: p.id, name: p.name, ...(a.includeContent === false ? {} : { content: blocksToMd(p.doc || []) }) })),
      };
    },
  },
  project_create: {
    description: 'Create a new page-based Project (starts with one empty page). PM/Production only.',
    inputSchema: S({ name: str('Project name.') }, ['name']),
    handler: async (userId, a) => {
      const { role } = await teamRoleOf(userId);
      if (!['pm', 'production'].includes(role)) throw new Error('Projects are available to PM and Production only.');
      const pages = [{ id: uid(), name: 'Page 1', doc: [] }];
      const { rows } = await pool.query('INSERT INTO boards (user_id, name, items, settings) VALUES ($1, $2, $3, $4) RETURNING id', [userId, String(a.name || 'Untitled project').slice(0, 120), JSON.stringify(pages), '{}']);
      return { ok: true, projectId: rows[0].id };
    },
  },
  project_rename: {
    description: 'Rename a Project.',
    inputSchema: S({ projectId: str('Project id.'), name: str('New name.') }, ['projectId', 'name']),
    handler: async (userId, a) => {
      await boardMustEdit(userId, a.projectId);
      await pool.query('UPDATE boards SET name = $1, updated_at = now() WHERE id = $2', [String(a.name).slice(0, 120), a.projectId]);
      return { ok: true };
    },
  },
  project_delete: {
    description: 'Delete a Project (owner) or leave it (shared member).',
    inputSchema: S({ projectId: str('Project id.') }, ['projectId']),
    handler: async (userId, a) => {
      const role = await boardAccessRole(a.projectId, userId);
      if (!role) throw new Error('Project not found or you do not have access to it.');
      if (role === 'owner') await pool.query('DELETE FROM boards WHERE id = $1', [a.projectId]);
      else await pool.query('DELETE FROM board_members WHERE board_id = $1 AND user_id = $2', [a.projectId, userId]);
      return { ok: true };
    },
  },
  project_add_page: {
    description: 'Add a page to a Project. Optionally provide content as Markdown (headings, lists, quotes, code). Returns the new pageId.',
    inputSchema: S({ projectId: str('Project id.'), name: str('Page name (optional).'), content: str('Optional page content as Markdown.'), position: { type: 'integer', description: '0-based insert index; omit to append at the end.' } }, ['projectId']),
    handler: async (userId, a) => {
      const b = await boardMustEdit(userId, a.projectId);
      const pages = boardPages(b.items);
      const page = { id: uid(), name: String(a.name || `Page ${pages.length + 1}`).slice(0, 120), doc: a.content ? mdToBlocks(a.content) : [] };
      const pos = (typeof a.position === 'number') ? Math.max(0, Math.min(pages.length, a.position)) : pages.length;
      pages.splice(pos, 0, page);
      await saveBoardPages(a.projectId, pages);
      return { ok: true, pageId: page.id, pages: pages.length };
    },
  },
  project_update_page: {
    description: 'Update a page: set its name and/or replace (or append to) its content with Markdown.',
    inputSchema: S({ projectId: str('Project id.'), pageId: str('Page id.'), name: str('New page name (optional).'), content: str('New page content as Markdown (optional).'), append: { type: 'boolean', description: 'If true, append content to the page instead of replacing it.' } }, ['projectId', 'pageId']),
    handler: async (userId, a) => {
      const b = await boardMustEdit(userId, a.projectId);
      const pages = boardPages(b.items);
      const p = pages.find((x) => x.id === a.pageId);
      if (!p) throw new Error('Page not found in this project.');
      if (a.name != null) p.name = String(a.name).slice(0, 120);
      if (a.content != null) { const blocks = mdToBlocks(a.content); p.doc = a.append ? [...(Array.isArray(p.doc) ? p.doc : []), ...blocks] : blocks; }
      await saveBoardPages(a.projectId, pages);
      return { ok: true };
    },
  },
  project_delete_page: {
    description: 'Delete a page from a Project (a project keeps at least one page).',
    inputSchema: S({ projectId: str('Project id.'), pageId: str('Page id.') }, ['projectId', 'pageId']),
    handler: async (userId, a) => {
      const b = await boardMustEdit(userId, a.projectId);
      const pages = boardPages(b.items);
      if (pages.length <= 1) throw new Error('A project must have at least one page.');
      const next = pages.filter((p) => p.id !== a.pageId);
      if (next.length === pages.length) throw new Error('Page not found in this project.');
      await saveBoardPages(a.projectId, next);
      return { ok: true, pages: next.length };
    },
  },
  project_export_pdf: {
    description: 'Render the whole Project to a PDF (all pages, with images) and return it as base64.',
    inputSchema: S({ projectId: str('Project id.') }, ['projectId']),
    handler: async (userId, a) => {
      const b = await loadBoard(userId, a.projectId);
      if (!b) throw new Error('Project not found or you do not have access to it.');
      const buf = await generateBoardPdf(b.items, { markupDir: MARKUP_DIR, title: b.name });
      const safe = String(b.name || 'project').replace(/[^a-z0-9_\- ]/gi, '').trim() || 'project';
      return { filename: `${safe}.pdf`, mimeType: 'application/pdf', bytes: buf.length, base64: buf.toString('base64') };
    },
  },
  project_set_active_collab: {
    description: 'Link (or unlink with empty id) an existing Active Collab project to a Project. Verifies the AC id.',
    inputSchema: S({ projectId: str('Project id.'), acProjectId: str('Active Collab project id, or empty to unlink.') }, ['projectId']),
    handler: async (userId, a) => {
      await boardMustEdit(userId, a.projectId);
      const raw = String(a.acProjectId || '').trim();
      if (!raw) { await pool.query("UPDATE boards SET ac_project_id = '', ac_project_name = '', updated_at = now() WHERE id = $1", [a.projectId]); return { ok: true, acProjectId: '', acProjectName: '' }; }
      const acToken = await userAcToken(userId);
      const info = await fetchAcProject(acToken, raw);
      await pool.query('UPDATE boards SET ac_project_id = $1, ac_project_name = $2, updated_at = now() WHERE id = $3', [info.id, info.name, a.projectId]);
      return { ok: true, acProjectId: info.id, acProjectName: info.name };
    },
  },
};

/* ----------------------------- JSON-RPC plumbing ----------------------------- */
const rpcResult = (id: any, result: any) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id: any, code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });

async function resolveUser(req: Request): Promise<string | null> {
  let token = String((req.query.token as string) || '').trim();
  if (!token) {
    const h = req.headers.authorization || '';
    if (h.startsWith('Bearer ')) token = h.slice(7).trim();
  }
  if (!token) return null;
  const { rows } = await pool.query('SELECT id FROM users WHERE mcp_token = $1', [token]);
  return rows[0]?.id || null;
}

export async function handleMcp(req: Request, res: Response) {
  const userId = await resolveUser(req);
  if (!userId) return res.status(401).json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Invalid or missing MCP token.' } });

  const body = req.body;
  const msgs = Array.isArray(body) ? body : [body];
  const out: any[] = [];

  for (const msg of msgs) {
    if (!msg || msg.jsonrpc !== '2.0') continue;
    const { id, method, params } = msg;
    const isNotification = id === undefined || id === null;

    try {
      if (method === 'initialize') {
        const clientVersion = params?.protocolVersion;
        out.push(rpcResult(id, {
          protocolVersion: typeof clientVersion === 'string' ? clientVersion : PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: 'Two toolsets. SITEMAPS (tool names without a prefix): to build a whole sitemap, DESIGN it yourself (the full page hierarchy AND each page\'s sections/content map) and create it in ONE call with create_sitemap — every page must include 4-8 sections (pick a wireframe frame, color and 1-2 sentence description per section). Use add_page_with_sections to add a complete page later. Avoid building page-by-page with bare add_page (it leaves pages empty). generate_sitemap is only an optional auto-AI fallback. Also: list/get/export/duplicate/rename/delete projects, update/delete/move pages & sections (update_section sets a section\'s description), draw arrows; comments — add_section_comment, add_comment (canvas pin), list_comments, delete_comment; files — add_section_file (attach an image/PDF/doc to a section, file as base64); notes — add_note, list_notes, delete_note; sharing — share_project (share by EMAIL and/or get a public URL link), list_members, invite_member, remove_member, leave_project (leave a project shared with you); Active Collab — the acProjectId/acProjectName shown by get_project are READ-ONLY status fields; to change the link use the tools: find_active_collab_project (look up/verify an AC project by ID), set_active_collab (link/unlink an AC project ID to a sitemap project), sync_active_collab (sync ALL pages — each page becomes/updates one AC task). Call list_projects first. MARKUP (markup_* tools): website annotation projects — list/get/create (from a site URL; from a ZIP — pick the FASTEST available: if you run on the SAME machine as the server, write the ZIP to a temp file and use markup_create_zip_from_path (instant, no base64); else if it is at an http(s) URL use markup_create_zip_from_url; ONLY if you have raw bytes and no path/URL, use the chunked upload markup_upload_begin → markup_upload_chunk → markup_upload_finish. NEVER send a whole ZIP as one base64 string — it is extremely slow because the bytes must pass through the model token-by-token)/rename/status/duplicate/delete projects, manage versions (markup_add_url_version / markup_add_zip_version — both take mode: "new" to add a new version or "current" to replace the latest version in place keeping its comments), download a version\'s files as a ZIP with markup_export_version, and list/add/update/delete comments — call markup_list_projects first, then markup_list_versions to get a versionId before adding comments. Every comment is structured for precise fixes: type, scope, desiredValue, screenshot, and an anchor (mkId=stable data-mk-id primary locator, selector, tag, text, html, parents, sectionId, sectionHeading, computedStyles=current values) plus page + x/y — locate by mkId/selector and use computedStyles + desiredValue + type/scope to know exactly what and how much to change. Attach files to comments with markup_add_comment (files param) or markup_add_comment_file (existing comment), file as base64. Share a markup project by EMAIL and/or get a public URL link with markup_share_project. Link an Active Collab project ID with markup_set_active_collab (verify an ID first with find_active_collab_project). Leave a shared markup project with markup_leave_project. STYLE GUIDES (styleguide_* tools): a style guide is a token-driven design-system document — one HTML doc whose every visual property uses a CSS variable (token) from :root (colours, fonts, type scale incl. responsive -t/-m variants, spacing, radii, breakpoints, component tokens). styleguide_list_projects, then styleguide_get_project for the full HTML. PREFER editing via TOKENS: styleguide_get_tokens reads all tokens (+ a structured theme), and styleguide_set_tokens sets any tokens (e.g. {"--color-brand":"#16A34A","--font-heading":"Lora","--text-h1":"72px","--radius-button":"6px"}) which then propagate to everything that uses them — webfonts load automatically, no HTML editing needed. This is the right way to recolour/retypeset/retheme a guide. Only use styleguide_update_content (rewrite the whole HTML) when you must change structure or copy, not for tokens. To BUILD NEW HTML that uses the guide: styleguide_get_css returns the design-system stylesheet (fonts + css with current token values + a usage guide of building blocks) to drop into any page <head>; or styleguide_build_page takes your body HTML and returns a complete, on-brand, responsive standalone page wired to the guide\'s tokens — so new pages work directly through the style guide. Also rename/set_status/duplicate/delete, create with styleguide_create_project (omit content to seed the built-in template), and link Active Collab with styleguide_set_active_collab (PM only). PROJECTS (project_* tools): a Project is a page-based document (the "Projects" tab) — different from a sitemap. project_list, then project_get to read pages (each page content is returned as Markdown). Create with project_create; rename/delete with project_rename/project_delete. Pages: project_add_page (optional Markdown content + position), project_update_page (set name and/or content as Markdown; append:true to append instead of replace), project_delete_page. project_export_pdf renders the whole project (all pages, with images) to a base64 PDF. project_set_active_collab links an existing Active Collab project id. Page content uses Markdown: # / ## / ### headings, - bullet, 1. numbered, - [ ] / - [x] to-do, > quote, ``` code fences.',
        }));
      } else if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
        // notification — no response
      } else if (method === 'ping') {
        out.push(rpcResult(id, {}));
      } else if (method === 'tools/list') {
        out.push(rpcResult(id, {
          tools: Object.entries(tools).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })),
        }));
      } else if (method === 'tools/call') {
        const name = params?.name;
        const tool = tools[name];
        if (!tool) { out.push(rpcError(id, -32602, `Unknown tool: ${name}`)); continue; }
        try {
          const result = await tool.handler(userId, params?.arguments || {});
          out.push(rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }));
        } catch (e: any) {
          // tool errors are reported in-band so the model can react
          out.push(rpcResult(id, { content: [{ type: 'text', text: `Error: ${e?.message || 'tool failed'}` }], isError: true }));
        }
      } else if (!isNotification) {
        out.push(rpcError(id, -32601, `Method not found: ${method}`));
      }
    } catch (e: any) {
      if (!isNotification) out.push(rpcError(id, -32603, e?.message || 'Internal error'));
    }
  }

  if (!out.length) return res.status(202).end(); // only notifications
  res.json(Array.isArray(body) ? out : out[0]);
}
