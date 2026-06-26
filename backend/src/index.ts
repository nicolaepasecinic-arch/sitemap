import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Firecrawl } from 'firecrawl';
import { initDb, migrateMarkupFiles, pool } from './db';
import { authRouter, requireAuth } from './auth';
import { projectsRouter, publicProjectsRouter } from './projects';
import { boardsRouter } from './boards';
import { styleGuidesRouter, styleGuidesPublicRouter, buildStyleGuideFromTokens, accessRole as sgAccessRole, parseAllTokens as sgParseTokens } from './styleguides';
import { handleMcp } from './mcp';
import { markupRouter, markupPublicRouter, MARKUP_DIR, markupProxyHandler } from './markup';
import { moodboardsRouter, publicMoodboardsRouter, MOODBOARD_DIR } from './moodboards';
import { teamsRouter } from './teams';
import { OPENAI_API_KEY, OPENAI_MODEL, AI_FRAME_KEYS, AI_COLOR_KEYS, FRAME_GUIDE, COLOR_GUIDE, frameLegend, extractResponsesText, generateSitemap, generateStyleGuideTokens, generateStyleGuideCopy, styleGuideAssistant, tokensFromComputed, STYLE_PROBE_JS, captureScreenshot, extractSiteFonts, probeSite } from './ai';

const app = express();

// Firecrawl — used by the Crawler tab to map every URL of a site reliably
// (handles JS-rendered sites and bot blocking that the plain fetch crawler can't).
const firecrawl = process.env.FIRECRAWL_API_KEY
  ? new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })
  : null;

// OpenAI config + AI frame/color vocabularies + helpers live in ./ai (shared with MCP).

// CORS — allow the frontend origin(s). Set CORS_ORIGIN in env (comma-separated) in production.
const origins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());
app.use(cors({ origin: origins.includes('*') ? true : origins }));
// Markup ZIP uploads (base64) can be large — give that one route a bigger limit BEFORE the global parser.
app.use('/api/markup/projects/upload', express.json({ limit: '64mb' }));
// Comment file attachments (base64) — also need a bigger limit, on both authed + public paths.
app.use('/api/markup/attachments', express.json({ limit: '32mb' }));
app.use('/api/markup/public/attachments', express.json({ limit: '32mb' }));
app.use('/mcp', express.json({ limit: '64mb' })); // MCP can upload ZIPs (base64)
app.use('/api/styleguides', express.json({ limit: '32mb' })); // design-system HTML docs can be large
app.use('/api/moodboards', express.json({ limit: '32mb' })); // pasted images (base64) can be large
app.use(express.json({ limit: '5mb' })); // sitemaps can be large

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Serve unzipped markup sites (static files). UUID path acts as the access key.
app.use('/markup-files', express.static(MARKUP_DIR));
// Serve moodboard images (static files). UUID path acts as the access key.
app.use('/moodboard-files', express.static(MOODBOARD_DIR));
// Same-origin live proxy (unauthenticated; before the authed router).
app.get('/api/markup/proxy', markupProxyHandler);
app.use('/api/markup/public', markupPublicRouter); // public share-link access, no auth
app.use('/api/markup', markupRouter);

// MCP server endpoint (Connect to AI). Auth is by per-account token (?token= or Bearer).
app.post('/mcp', handleMcp);
app.get('/mcp', (_req, res) => res.status(405).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Use POST for the MCP endpoint.' } }));

app.use('/api/auth', authRouter);
app.use('/api/team', teamsRouter);
app.use('/api/public/projects', publicProjectsRouter); // read-only, no auth
app.use('/api/projects', projectsRouter);
app.use('/api/boards', boardsRouter);
app.use('/api/moodboards/public', publicMoodboardsRouter); // read-only share links, no auth
app.use('/api/moodboards', moodboardsRouter);
// Generate a style guide from one or more real websites. Each style site becomes a version;
// with several sites we also add a blended "Mix" version. An optional content site supplies
// the brand name / text, so you can take the TEXT from one site and the STYLE from another.
const normUrl = (u: string) => { let t = String(u || '').trim(); if (!t) return ''; if (!/^https?:\/\//i.test(t)) t = 'https://' + t; return t; };
const siteLabel = (u: string) => { try { return new URL(normUrl(u)).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
const siteName = (u: string) => { const h = siteLabel(u).split('.')[0] || 'Brand'; return h.charAt(0).toUpperCase() + h.slice(1); };

app.post('/api/styleguides/generate', requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const body = req.body || {};
  let urls: string[] = Array.isArray(body.urls) ? body.urls : [];
  if (!urls.length && body.url) urls = [body.url];
  urls = urls.map(normUrl).filter(Boolean).filter((u, i, a) => a.indexOf(u) === i).slice(0, 5);
  if (!urls.length) return res.status(400).json({ error: 'Add at least one website URL.' });
  if (!OPENAI_API_KEY) return res.status(400).json({ error: 'AI is not configured (OPENAI_API_KEY missing).' });
  const instructions = String(body.instructions || '').trim();
  const contentUrl = body.contentUrl ? normUrl(body.contentUrl) : '';

  // content source → brand name + short "about" text (text comes from here)
  let brandName = siteName(contentUrl || urls[0]);
  let about = '';
  if (contentUrl && firecrawl) {
    try {
      const doc: any = await firecrawl.scrape(contentUrl, { formats: ['summary', 'branding'] });
      about = String(doc?.summary || '').slice(0, 400);
    } catch (e) { console.error('content scrape failed:', (e as Error).message); }
  }

  try {
    // sample specimen copy in the (content) brand's voice — same text across all versions
    const copy = await generateStyleGuideCopy({ brandName, about, instructions }) || undefined;

    const versions: Array<{ label: string; content: string }> = [];
    const brandings: any[] = [];
    let firstShot = '';
    for (const u of urls) {
      let branding: any = null; let shot = ''; let computed: any = null;
      // PRIMARY: render in a headless browser at desktop viewport → exact computed styles.
      try { const p = await probeSite(u); computed = p.computed; shot = p.screenshot; } catch (e) { console.error('probe failed:', (e as Error).message); }
      // Optional: Firecrawl branding to refine colours (only if available and probe missing).
      if (firecrawl && !computed) {
        try {
          const doc: any = await firecrawl.scrape(u, { mobile: false, formats: ['branding', { type: 'screenshot', fullPage: true, viewport: { width: 1440, height: 900 } }], actions: [{ type: 'executeJavascript', script: STYLE_PROBE_JS }] });
          branding = doc?.branding || null; if (!shot) shot = doc?.screenshot || '';
          if (!computed) computed = doc?.actions?.javascriptReturns?.[0]?.value ?? null;
        } catch (e) { console.error('firecrawl fallback failed:', (e as Error).message); }
      }
      // Still no screenshot? Use ScreenshotEngine so the vision model has a rendered image.
      if (!computed && !shot) shot = await captureScreenshot(u);
      brandings.push(branding); if (!firstShot) firstShot = shot;
      // Prefer REAL computed styles from the live page; fall back to the model (+screenshot) otherwise.
      const real = tokensFromComputed(branding, computed);
      const tokens: any = real || await generateStyleGuideTokens({ url: u, instructions, branding, screenshotUrl: shot });
      // Fonts: read the REAL fonts from the site's HTML/CSS (most reliable) and override.
      try { const sf = await extractSiteFonts(u); if (sf.heading) tokens.headingFont = sf.heading; if (sf.body) tokens.bodyFont = sf.body; } catch {}
      versions.push({ label: siteLabel(u), content: buildStyleGuideFromTokens({ ...tokens, brandName, about, copy }) });
    }
    // blended "Mix" version when there are several sites (model blends the brandings)
    if (urls.length > 1) {
      const mixInstr = `Blend these websites into ONE cohesive design system, taking the best of each: ${urls.join(', ')}. ${instructions}`.trim();
      const tokens: any = await generateStyleGuideTokens({ url: urls.join(', '), instructions: mixInstr, branding: { sites: brandings }, screenshotUrl: firstShot });
      try { const sf = await extractSiteFonts(urls[0]); if (sf.heading) tokens.headingFont = sf.heading; if (sf.body) tokens.bodyFont = sf.body; } catch {}
      versions.push({ label: 'Mix', content: buildStyleGuideFromTokens({ ...tokens, brandName, about, copy }) });
    }

    const name = `${brandName} — Style Guide`.slice(0, 100);
    const latest = versions[versions.length - 1].content;
    const ins = await pool.query('INSERT INTO style_guides (user_id, name, content, settings) VALUES ($1,$2,$3,$4) RETURNING id', [userId, name, latest, '{}']);
    const gid = ins.rows[0].id;
    for (const v of versions) await pool.query('INSERT INTO style_guide_versions (style_guide_id, label, content) VALUES ($1,$2,$3)', [gid, v.label.slice(0, 40), v.content]);
    res.json({ id: gid, name, versions: versions.length });
  } catch (e) {
    res.status(502).json({ error: (e as Error).message || 'AI generation failed.' });
  }
});

// Style-guide AI assistant: edits the design via token updates. If the message references a
// website, we screenshot + read its branding and pass them to the model.
app.post('/api/styleguides/:id/assistant', requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const role = await sgAccessRole(req.params.id, userId);
  if (!role) return res.status(404).json({ error: 'Style guide not found' });
  if (role === 'viewer') return res.status(403).json({ error: 'You have view-only access to this style guide.' });
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Type an instruction first.' });

  const { rows } = await pool.query('SELECT content FROM style_guides WHERE id = $1', [req.params.id]);
  const tokens = sgParseTokens(rows[0]?.content || '');

  // a referenced website → screenshot + branding
  let branding: any = null; let screenshotUrl = '';
  const um = message.match(/\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/i);
  if (um && firecrawl) {
    let target = um[1]; if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
    try {
      const doc: any = await firecrawl.scrape(target, { formats: ['branding', { type: 'screenshot', fullPage: true }] });
      branding = doc?.branding || null; screenshotUrl = doc?.screenshot || '';
    } catch (e) { console.error('assistant scrape failed:', (e as Error).message); }
  }
  try {
    const out = await styleGuideAssistant({ message, tokens, branding, screenshotUrl });
    // tell the user when a referenced site couldn't actually be captured
    if (um && !screenshotUrl) {
      const why = firecrawl ? "couldn't capture a live screenshot of that site" : 'site capture is off (FIRECRAWL_API_KEY not set)';
      out.reply = `Note: ${why}, so I matched it from what I know. ` + out.reply;
    }
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: (e as Error).message || 'AI assistant failed.' });
  }
});

app.use('/api/styleguides/public', styleGuidesPublicRouter); // read-only share links, no auth
app.use('/api/styleguides', styleGuidesRouter);

// Fetch a site's sitemap.xml server-side (avoids browser CORS). Tries the URL,
// then <origin>/sitemap.xml. Returns the raw XML text.
app.get('/api/import/sitemap', requireAuth, async (req, res) => {
  const raw = String(req.query.url || '').trim();
  if (!raw) return res.status(400).json({ error: 'url is required' });
  let base = raw;
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base;
  let origin = base;
  try { origin = new URL(base).origin; } catch { return res.status(400).json({ error: 'Invalid URL' }); }

  const candidates = Array.from(new Set([
    base,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
  ]));

  for (const u of candidates) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(u, { headers: BROWSER_HEADERS, redirect: 'follow', signal: ctrl.signal });
      clearTimeout(to);
      if (!r.ok) continue;
      const text = await r.text();
      if (!/<loc>/i.test(text)) continue;
      // A sitemap index points to other sitemaps — let the user choose which to import.
      const subs = [...text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
      const isIndex = /<sitemapindex/i.test(text) || (subs.length > 0 && subs.every((s) => /\.xml(\?|$)/i.test(s)));
      if (isIndex) return res.json({ index: true, sitemaps: subs, source: u });
      return res.json({ xml: text, source: u });
    } catch { /* try next */ }
  }
  res.status(404).json({ error: 'No sitemap.xml found for that site' });
});

// Crawl a site by following internal links (bounded), then return a synthetic urlset.
app.get('/api/import/crawl', requireAuth, async (req, res) => {
  const raw = String(req.query.url || '').trim();
  if (!raw) return res.status(400).json({ error: 'url is required' });
  let start = raw;
  if (!/^https?:\/\//i.test(start)) start = 'https://' + start;
  let origin: string;
  try { origin = new URL(start).origin; } catch { return res.status(400).json({ error: 'Invalid URL' }); }

  // Preferred path: Firecrawl maps every URL of the site (handles JS sites + bot blocking).
  if (firecrawl) {
    try {
      const r = await firecrawl.map(start, { limit: 500, includeSubdomains: false });
      const urls = (r.links || [])
        .map((l: any) => (typeof l === 'string' ? l : l && l.url))
        .filter((u: any): u is string => typeof u === 'string' && u.startsWith('http'));
      const uniq = Array.from(new Set(urls));
      if (uniq.length) {
        const xml = '<urlset>' + uniq.map((u) => `<url><loc>${u}</loc></url>`).join('') + '</urlset>';
        return res.json({ xml, count: uniq.length, source: origin, via: 'firecrawl' });
      }
    } catch (e) {
      console.error('Firecrawl map failed, falling back to fetch crawler:', (e as Error).message);
    }
  }

  const MAX_FETCH = 24, MAX_DEPTH = 2, MAX_PAGES = 150;
  const pages = new Set<string>(['/']);
  const seen = new Set<string>(['/']);
  const queue: { path: string; depth: number }[] = [{ path: '/', depth: 0 }];
  let fetches = 0;
  const skip = /\.(pdf|jpe?g|png|gif|svg|webp|zip|mp4|mp3|css|js|ico|woff2?)(\?|$)/i;

  while (queue.length && fetches < MAX_FETCH && pages.size < MAX_PAGES) {
    const { path, depth } = queue.shift()!;
    fetches++;
    let html = '';
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(origin + path, { headers: BROWSER_HEADERS, redirect: 'follow', signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok || !/text\/html/i.test(r.headers.get('content-type') || '')) continue;
      html = await r.text();
    } catch { continue; }

    const hrefRe = /href\s*=\s*["']([^"'#]+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = hrefRe.exec(html))) {
      let href = m[1].trim();
      if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || skip.test(href)) continue;
      let p: string;
      try {
        const u = new URL(href, origin + path);
        if (u.origin !== origin) continue;        // internal only
        p = u.pathname.replace(/\/+$/, '') || '/';
      } catch { continue; }
      if (!pages.has(p)) pages.add(p);
      if (depth < MAX_DEPTH && !seen.has(p) && pages.size < MAX_PAGES) { seen.add(p); queue.push({ path: p, depth: depth + 1 }); }
    }
  }

  const xml = '<urlset>' + [...pages].map((p) => `<url><loc>${origin}${p === '/' ? '' : p}</loc></url>`).join('') + '</urlset>';
  res.json({ xml, count: pages.size, source: origin });
});

// AI — generate ONLY the content map (the ordered sections/blocks) for ONE page.
// Does not invent other pages or a sitemap. Uses the OpenAI Responses API with a
// strict JSON schema (frame/color enums are enforced by the model).
const AI_SYSTEM_PROMPT = `You are a SENIOR UX/UI DESIGNER with 10 years of experience designing high-converting websites for startups, agencies and enterprise brands. You have shipped hundreds of landing pages and marketing sites, you know conversion-rate-optimization, visual hierarchy, F/Z reading patterns, accessibility and modern web design patterns by heart. You are now wireframing the CONTENT MAP for ONE single page inside a visual sitemap/wireframe tool — the ordered list of sections (blocks) that make up that page, top to bottom.

THINK LIKE A SENIOR DESIGNER (do this reasoning before answering)
1. Identify the page type, the target audience, and the ONE primary conversion goal of this page.
2. Decide the persuasion/narrative arc that a best-in-class version of this page would follow: grab attention → communicate value → prove it (trust/social proof) → handle objections → make the ask. Sequence sections to support that arc, not as a random stack.
3. Apply real design judgement: strong visual hierarchy, alternating layouts/rhythm (don't repeat the same frame back to back), clear primary CTA placement, and only the sections this specific page genuinely needs.

CRITICAL SCOPE
- Map ONLY the page you are given. NEVER invent other pages, navigation trees, or a sitemap.
- Tailor everything to THIS page's exact subject (the real product/service/audience/offer) — never output a generic template.

OUTPUT — one object {"sections":[...]}, each section has:
- name: a concrete, specific 1-4 word label tied to the content ("Pricing Tiers", "Customer Logos", "How It Works") — never vague ("Section", "Content").
- frame: the wireframe layout that best matches the section's CONTENT. Choose deliberately and with intent from this legend (pick the closest visual match; deliberately vary frames for rhythm — NEVER default everything to "bar"):
${frameLegend}
- color: an accent reflecting the section's role. ${COLOR_GUIDE}
- description: 1-2 specific, senior-level sentences a designer/copywriter could build from — the concrete elements inside, the copy angle/value message, and example items where relevant (name the actual pricing tiers, feature categories, testimonial type, form fields, etc.). No restating the name.

QUALITY BAR (non-negotiable)
- Typically 6-12 sections for a full page; fewer only for a deliberately simple page.
- Start with the hero (or header/nav), end with a strong closing CTA and footer where appropriate.
- Match frame to content: comparison → table; image+copy → media-text/text-media; logos/trust → cols4/iconrow; steps/process → cols3/dots; gallery/blog/portfolio → cards-grid; testimonials → cards3/carousel3; FAQ/checklist → list; video → video/video-center; stats → cols4.
- Vary frames for visual rhythm; ensure at least one clear primary CTA. The result must read like a real, polished, production-grade page designed by a senior pro.`;

app.post('/api/ai/contentmap', async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(503).json({ error: 'AI is not configured (OPENAI_API_KEY missing on the server).' });

  const prompt = String((req.body && req.body.prompt) || '').trim();
  const pageName = String((req.body && req.body.pageName) || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Describe the page content first.' });

  const user = pageName
    ? `Design the content map for the page named "${pageName}".\nWhat this page is about: ${prompt}`
    : `Design the content map for this page.\nWhat this page is about: ${prompt}`;

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      sections: {
        type: 'array',
        description: 'Ordered sections of the page, top to bottom.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', description: 'Specific 1-4 word section label.' },
            frame: { type: 'string', enum: AI_FRAME_KEYS, description: 'Wireframe layout key.' },
            color: { type: 'string', enum: AI_COLOR_KEYS, description: 'Accent color key.' },
            description: { type: 'string', description: '1-2 specific sentences about this section.' },
          },
          required: ['name', 'frame', 'color', 'description'],
        },
      },
    },
    required: ['sections'],
  };

  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 45000);
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          { role: 'developer', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: user },
        ],
        text: {
          format: { type: 'json_schema', name: 'content_map', strict: true, schema },
        },
        max_output_tokens: 8000,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(to);

    if (!r.ok) {
      console.error('OpenAI error', r.status, await r.text().catch(() => ''));
      return res.status(502).json({ error: 'AI request failed. Check the OpenAI key / model / quota.' });
    }

    const data: any = await r.json();
    const content = extractResponsesText(data);
    if (!content) {
      console.error('OpenAI empty/incomplete response', data?.status, JSON.stringify(data?.incomplete_details || {}));
      return res.status(502).json({ error: 'AI returned no content. Try again or a more detailed prompt.' });
    }

    let parsed: any;
    try { parsed = JSON.parse(content); } catch { return res.status(502).json({ error: 'AI returned invalid JSON.' }); }

    const rawList = Array.isArray(parsed?.sections) ? parsed.sections : [];
    const sections = rawList
      .slice(0, 14)
      .map((s: any) => ({
        name: String(s?.name || '').trim().slice(0, 60) || 'Section',
        frame: AI_FRAME_KEYS.includes(s?.frame) ? s.frame : 'bar',
        color: AI_COLOR_KEYS.includes(s?.color) ? s.color : 'blue',
        description: String(s?.description || '').trim().slice(0, 400),
      }));

    if (!sections.length) return res.status(502).json({ error: 'AI returned no sections. Try a more detailed prompt.' });
    res.json({ sections });
  } catch (e) {
    console.error('AI contentmap failed:', (e as Error).message);
    res.status(502).json({ error: 'AI request failed (timeout or network).' });
  }
});

// AI — generate a COMPLETE sitemap (a whole new project). Logic lives in ./ai (shared with MCP).
app.post('/api/ai/sitemap', async (req, res) => {
  try {
    const out = await generateSitemap(String((req.body && req.body.prompt) || ''));
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: (e as Error).message || 'AI request failed.' });
  }
});

// AI — conversational assistant that can MANIPULATE the current project. Receives the
// user's message + a snapshot of the project, returns a friendly reply plus a list of
// structured OPERATIONS the frontend applies to the canvas (add/edit/delete pages &
// sections, recolor, link, reorder, draw arrows between a section and a page).
const AI_ASSISTANT_OPS = [
  'add_page', 'rename_page', 'delete_page', 'set_page_color', 'set_page_link',
  'add_section', 'update_section', 'delete_section', 'move_section', 'set_section_done',
  'add_arrow', 'remove_arrow', 'noop',
];

const AI_ASSISTANT_PROMPT = `You are "Qoders Map Assistant", a SENIOR UX/UI DESIGNER with 10 years of experience, embedded inside a visual sitemap/wireframe tool. You help the user build and edit their project by chatting. You can both ANSWER questions and PERFORM actions on the project.

YOU RECEIVE
- The user's message.
- A JSON snapshot of the current project: { name, pages:[{ id, label, parentId, color, link, blocks:[{ id, name, frame, color, description, done, arrowTargets }] }] }.
  - "pages" are the website's pages (nodes). "blocks" are the sections/content of each page. "arrowTargets" are ids of pages a section points to.

HOW TO RESPOND — return { "reply": string, "operations": [ ... ] }:
- reply: a short, friendly, professional sentence or two describing what you did (or answering the question). Speak like a helpful senior designer. Match the user's language.
- operations: the ordered list of changes to apply. Use [] when the user only asks a question or no change is needed (op "noop").

USING IDS (critical)
- To act on something that already exists, use its EXACT id from the snapshot (pageId for a page, sectionId for a block).
- When you CREATE a page or section, invent a NEW unique id for it (e.g. "n1", "s1") that is not in the snapshot; later operations in the same response may reference that new id. The app turns these into real ids.

OPERATIONS — every operation is an object with ALL of these fields present (fill the relevant ones, leave the rest as "" / 0 / false):
- op: one of ${AI_ASSISTANT_OPS.join(', ')}.
- pageId: the page the op targets (or the NEW id for add_page).
- parentId: for add_page — the parent page id, or "" for a top-level page.
- sectionId: the section the op targets (or the NEW id for add_section).
- toPageId: for add_arrow / remove_arrow — the page the arrow points TO.
- title: page title (for add_page / rename_page).
- name: section name (for add_section / update_section).
- frame: wireframe key (for add_section / update_section). Must be one of: ${AI_FRAME_KEYS.join(', ')}.
- color: color key (for set_page_color / add_section / update_section). Must be one of: ${AI_COLOR_KEYS.join(', ')}.
- description: section description (for add_section / update_section).
- url: page link (for set_page_link).
- done: boolean (for set_section_done).
- position: integer insert index for add_section / move_section (0 = first; use -1 for end).

WIREFRAME LEGEND (pick the frame that matches the content; vary them, never default everything to "bar"):
${frameLegend}
COLOR ROLES: ${COLOR_GUIDE}

QUALITY & SAFETY
- Apply design judgement worthy of a senior pro: good section ordering, meaningful names, frames matched to content, sensible colors.
- Only do what the user asked; don't wipe existing work unless they ask. For destructive actions (delete), do exactly what was requested.
- If the request is ambiguous, make the most reasonable interpretation and explain it briefly in reply.
- If the user asks to add full content to a page, create a complete, well-structured set of sections for it.`;

app.post('/api/ai/assistant', async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(503).json({ error: 'AI is not configured (OPENAI_API_KEY missing on the server).' });

  const message = String((req.body && req.body.message) || '').trim();
  const project = (req.body && req.body.project) || {};
  if (!message) return res.status(400).json({ error: 'Type a message first.' });

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      reply: { type: 'string', description: 'Short friendly reply describing what was done or answering.' },
      operations: {
        type: 'array',
        description: 'Ordered operations to apply to the project.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            op: { type: 'string', enum: AI_ASSISTANT_OPS },
            pageId: { type: 'string' },
            parentId: { type: 'string' },
            sectionId: { type: 'string' },
            toPageId: { type: 'string' },
            title: { type: 'string' },
            name: { type: 'string' },
            frame: { type: 'string' },
            color: { type: 'string' },
            description: { type: 'string' },
            url: { type: 'string' },
            done: { type: 'boolean' },
            position: { type: 'integer' },
          },
          required: ['op', 'pageId', 'parentId', 'sectionId', 'toPageId', 'title', 'name', 'frame', 'color', 'description', 'url', 'done', 'position'],
        },
      },
    },
    required: ['reply', 'operations'],
  };

  // Compact the project snapshot so we send only what the model needs.
  const pages = Array.isArray(project?.nodes) ? project.nodes : [];
  const snapshot = {
    name: String(project?.name || 'Untitled project'),
    pages: pages.slice(0, 120).map((n: any) => ({
      id: n?.id,
      label: n?.label,
      parentId: n?.parentId || '',
      color: n?.color || '',
      link: n?.link || '',
      blocks: (Array.isArray(n?.blocks) ? n.blocks : []).slice(0, 40).map((b: any) => ({
        id: b?.id,
        name: b?.name,
        frame: b?.frame,
        color: b?.color,
        description: b?.description || '',
        done: !!b?.done,
        arrowTargets: Array.isArray(b?.arrowTargets) ? b.arrowTargets : [],
      })),
    })),
  };

  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 60000);
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          { role: 'developer', content: AI_ASSISTANT_PROMPT },
          { role: 'user', content: `Current project (JSON):\n${JSON.stringify(snapshot)}\n\nUser request:\n${message}` },
        ],
        text: { format: { type: 'json_schema', name: 'assistant_actions', strict: true, schema } },
        max_output_tokens: 16000,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(to);

    if (!r.ok) {
      console.error('OpenAI error', r.status, await r.text().catch(() => ''));
      return res.status(502).json({ error: 'AI request failed. Check the OpenAI key / model / quota.' });
    }

    const data: any = await r.json();
    const content = extractResponsesText(data);
    if (!content) {
      console.error('OpenAI empty/incomplete response', data?.status, JSON.stringify(data?.incomplete_details || {}));
      return res.status(502).json({ error: 'AI returned no content. Try rephrasing.' });
    }

    let parsed: any;
    try { parsed = JSON.parse(content); } catch { return res.status(502).json({ error: 'AI returned invalid JSON.' }); }

    const reply = String(parsed?.reply || '').trim().slice(0, 1000);
    const operations = (Array.isArray(parsed?.operations) ? parsed.operations : [])
      .slice(0, 200)
      .filter((o: any) => o && AI_ASSISTANT_OPS.includes(o.op) && o.op !== 'noop');

    res.json({ reply: reply || 'Done.', operations });
  } catch (e) {
    console.error('AI assistant failed:', (e as Error).message);
    res.status(502).json({ error: 'AI request failed (timeout or network).' });
  }
});

// Browser-like headers — many sites (WordPress/Yoast, Cloudflare) block plain bots.
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const PORT = Number(process.env.PORT) || 3000;

// Connect to the DB with retries — Postgres may accept connections a few seconds after the
// container starts, and we don't want a transient hiccup to crash-loop the whole app.
async function initDbWithRetry(attempts = 12, delayMs = 3000): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try { await initDb(); return; }
    catch (e) {
      console.error(`DB connect attempt ${i}/${attempts} failed:`, (e as Error).message);
      if (i < attempts) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Could not connect to the database after retries — check DATABASE_URL (host must be the Postgres internal service name, both on the same network).');
}

initDbWithRetry()
  .then(() => migrateMarkupFiles(MARKUP_DIR).catch(() => {}))
  .then(() => {
    app.listen(PORT, () => console.log(`Qoders API listening on :${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
