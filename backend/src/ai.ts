// Shared AI building blocks (OpenAI Responses API) used by the HTTP routes AND the MCP
// server, so sitemap generation behaves identically everywhere. Single source of truth.

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4';
// A cheap model for tiny lookups (e.g. closest Google Font for a proprietary font).
export const OPENAI_CHEAP_MODEL = process.env.OPENAI_CHEAP_MODEL || 'gpt-5.4-mini';
export const SCREENSHOTENGINE_API_KEY = process.env.SCREENSHOTENGINE_API_KEY || '';

// Capture a full-page screenshot of a URL via ScreenshotEngine and return an image URL
// (hosted) or a data: URL — used as the vision input for AI style-guide generation when
// Firecrawl's screenshot/branding isn't available.
export async function captureScreenshot(url: string): Promise<string> {
  if (!SCREENSHOTENGINE_API_KEY || !url) return '';
  try {
    const api = new URL('https://api.screenshotengine.com/v1/screenshot');
    api.searchParams.set('url', url);
    api.searchParams.set('fullPage', 'true');
    api.searchParams.set('api_key', SCREENSHOTENGINE_API_KEY);
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 60000);
    let r: any;
    try { r = await fetch(api.toString(), { signal: ctrl.signal }); } finally { clearTimeout(to); }
    if (!r.ok) { console.error('ScreenshotEngine error', r.status, await r.text().catch(() => '')); return ''; }
    const ct = String(r.headers.get('content-type') || '');
    if (ct.includes('application/json')) {
      const j: any = await r.json();
      return j.url || j.screenshot || j.image || '';
    }
    // binary image response → inline as a data URL
    const buf = Buffer.from(await r.arrayBuffer());
    return 'data:' + (ct || 'image/png') + ';base64,' + buf.toString('base64');
  } catch (e) { console.error('ScreenshotEngine failed:', (e as Error).message); return ''; }
}

// Render a URL in a headless browser at a DESKTOP viewport and read the REAL computed styles
// (exact font-size / spacing / radii / colours) via STYLE_PROBE_JS. Also returns a screenshot.
// Self-hosted (no per-request cost, full viewport control). Degrades to {null,''} if Puppeteer
// isn't installed or the page fails — callers then fall back to ScreenshotEngine + the model.
let _puppeteer: any = null; let _puppeteerTried = false;
function loadPuppeteer(): any {
  if (_puppeteerTried) return _puppeteer;
  _puppeteerTried = true;
  try { _puppeteer = (0, eval)('require')('puppeteer'); } catch { _puppeteer = null; }
  return _puppeteer;
}
export async function probeSite(url: string): Promise<{ computed: any; screenshot: string }> {
  const puppeteer = loadPuppeteer();
  if (!puppeteer || !url) return { computed: null, screenshot: '' };
  let browser: any = null;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 1200)); // let lazy/animated content settle
    let computed: any = null;
    try { computed = await page.evaluate(STYLE_PROBE_JS); } catch (e) { console.error('probe eval failed:', (e as Error).message); }
    let screenshot = '';
    try { const buf = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false }); screenshot = 'data:image/jpeg;base64,' + Buffer.from(buf).toString('base64'); } catch {}
    return { computed, screenshot };
  } catch (e) { console.error('puppeteer probe failed:', (e as Error).message); return { computed: null, screenshot: '' }; }
  finally { try { if (browser) await browser.close(); } catch {} }
}

// Fetch text (HTML/CSS) with a timeout. Returns '' on any failure.
async function fetchText(url: string, ms = 12000): Promise<string> {
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), ms);
    let r: any;
    try { r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 QodersBot' } }); } finally { clearTimeout(to); }
    if (!r.ok) return '';
    const ct = String(r.headers.get('content-type') || '');
    if (ct && !/text|css|html|javascript|json|xml|font/i.test(ct)) return '';
    return (await r.text()).slice(0, 1500000);
  } catch { return ''; }
}
// first real (non-generic) font family in a CSS font-family value/stack ('' if none)
function firstRealFamily(stack: any): string {
  const f = String(stack || '').split(',')[0].replace(/["']/g, '').trim();
  return /^(inherit|initial|unset|revert|sans-serif|serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|-apple-system|blinkmacsystemfont)$/i.test(f) ? '' : f;
}
// find the font-family declared in the first CSS rule whose selector matches one of `sels`
function famInRuleFor(css: string, sels: string[]): string {
  const re = /([^{}]+)\{([^{}]*)\}/g; let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const body = m[2]; if (!/font-family/i.test(body)) continue;
    const sel = m[1].toLowerCase();
    if (sels.some((s) => sel.includes(s))) {
      const fm = body.match(/font-family\s*:\s*([^;}]+)/i);
      const real = fm ? firstRealFamily(fm[1]) : '';
      if (real) return fm![1];
    }
  }
  return '';
}
// Ask a CHEAP model for the closest Google Font to a proprietary/unknown font. Constrained to
// our known GF list so the result is guaranteed to render. Cached in-memory.
const _fontMatchCache = new Map<string, string>();
export async function closestGoogleFont(name: string): Promise<string> {
  const key = String(name || '').toLowerCase().trim();
  if (!key) return '';
  if (_fontMatchCache.has(key)) return _fontMatchCache.get(key)!;
  if (!OPENAI_API_KEY) return '';
  try {
    const choices = Array.from(GF_SET).map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase()));
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15000);
    let r: any;
    try {
      r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: OPENAI_CHEAP_MODEL,
          input: [
            { role: 'developer', content: 'You pick the closest visual match for a font from a fixed list of Google Fonts. Consider classification (serif/sans/mono/display), weight, width and personality. Reply with ONLY one family name copied exactly from the list.' },
            { role: 'user', content: `Font to match: "${name}".\nChoose the closest from this list:\n${choices.join(', ')}` },
          ],
          max_output_tokens: 20,
        }),
        signal: ctrl.signal,
      });
    } finally { clearTimeout(to); }
    if (!r.ok) return '';
    const data: any = await r.json();
    const pretty = prettifyFont(String(extractResponsesText(data) || '').replace(/["'.\n]/g, '').trim(), '');
    const result = pretty && GF_SET.has(pretty.toLowerCase()) ? pretty : '';
    if (result) _fontMatchCache.set(key, result);
    return result;
  } catch { return ''; }
}
// Resolve a font stack to a renderable Google Font: keep it if it's a GF; else use the static
// foundry map; else ask the cheap AI for the closest match; else fall back by category.
async function resolveFontSmart(rawStack: any): Promise<string> {
  const first = firstRealFamily(rawStack);
  if (!first) return '';
  const pretty = prettifyFont(first, '');
  if (pretty && GF_SET.has(pretty.toLowerCase())) return pretty;        // already a Google Font
  for (const [re, sub] of FONT_SUBS) if (re.test(String(rawStack))) return sub; // known proprietary
  const ai = await closestGoogleFont(pretty || first);                  // cheap AI for the rest
  if (ai) return ai;
  return resolveFont(rawStack, 'Inter');                                // category fallback
}
// Extract the REAL heading & body fonts from a site's HTML + linked CSS (most reliable source
// for font NAMES — Google Fonts links, @font-face, and h1/body font-family rules). Each is
// resolved to a renderable Google Font (proprietary → close substitute).
export async function extractSiteFonts(url: string): Promise<{ heading?: string; body?: string; families: string[] }> {
  const html = await fetchText(url);
  if (!html) return { families: [] };
  let css = '';
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) css += '\n' + m[1];
  let base: URL | null = null; try { base = new URL(url); } catch { base = null; }
  const hrefs: string[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) { const tag = m[0]; if (/stylesheet/i.test(tag)) { const h = (tag.match(/href=["']([^"']+)["']/) || [])[1]; if (h) hrefs.push(h); } }
  const cssUrls = base ? hrefs.map((h) => { try { return new URL(h, base!).toString(); } catch { return ''; } }).filter(Boolean).slice(0, 6) : [];
  for (const cu of cssUrls) css += '\n' + await fetchText(cu);
  css = css.slice(0, 1000000);
  const hay = html + '\n' + css;
  // Google Fonts families (the actually-loaded webfonts), in load order
  const gf: string[] = [];
  for (const m of hay.matchAll(/fonts\.googleapis\.com\/css2?\?([^"')\s>]+)/gi)) {
    for (const fm of m[1].matchAll(/family=([^&:]+)/gi)) { const name = decodeURIComponent(fm[1].replace(/\+/g, ' ')).trim(); if (name && gf.indexOf(name) < 0) gf.push(name); }
  }
  const headingRaw = famInRuleFor(css, ['h1', 'h2', 'h3', 'heading', 'display', 'headline', '.title']) || (gf[0] || '');
  const bodyRaw = famInRuleFor(css, ['body', 'html', ':root', 'p,', 'p ', '.body', 'p{']) || (gf[1] || gf[0] || '');
  const heading = firstRealFamily(headingRaw) ? await resolveFontSmart(headingRaw) : '';
  const body = firstRealFamily(bodyRaw) ? await resolveFontSmart(bodyRaw) : '';
  return { heading: heading || undefined, body: body || undefined, families: gf };
}

// Must stay in sync with FRAME_KEYS / COLOR_KEYS in src/SitemapBuilder.jsx.
export const AI_FRAME_KEYS = [
  'bar', 'text', 'carousel', 'cols2', 'text2', 'dots', 'cols3', 'text3', 'banner',
  'cols4', 'text4', 'table', 'carousel2', 'cards2', 'text2b', 'carousel3', 'cards3',
  'dashes', 'media-text', 'list2', 'text-media', 'cards-grid', 'media-split', 'video',
  'iconrow', 'video-center', 'list',
];
export const AI_COLOR_KEYS = ['blue', 'teal', 'green', 'lime', 'orange', 'red', 'pink', 'fuchsia', 'purple', 'indigo', 'slate', 'steel'];

export const FRAME_GUIDE: Record<string, string> = {
  bar: 'a single full-width band — generic header/nav, announcement strip, or a plain full-width section',
  banner: 'a full-width box with one centered line — a CTA banner with a single button/headline',
  text: 'a paragraph of text lines — rich body copy, about/story text, long-form content',
  text2: 'two columns of text — two side-by-side paragraphs',
  text2b: 'a heading followed by an intro paragraph — section title + lead text',
  text3: 'three columns of text',
  text4: 'four columns of text',
  carousel: 'left/right arrows around one large slide — a full-width hero slider / image carousel',
  dots: 'a box with pagination dots — a slider/carousel with dot navigation',
  carousel2: 'arrows around two items — a carousel showing 2 cards at a time',
  carousel3: 'arrows around three items — a carousel showing 3 cards at a time',
  cols2: 'two boxes side by side — two columns / two image or feature blocks',
  cols3: 'three boxes in a row — three columns / three feature blocks',
  cols4: 'four boxes in a row — four columns, logo strip, or a stats row',
  cards2: 'two cards each with a caption — two image+text cards',
  cards3: 'three cards each with a caption — three image+text cards (features, blog posts)',
  'cards-grid': 'a grid of captioned cards — gallery, blog grid, product/portfolio grid',
  iconrow: 'a row of icons — icon feature row, trust badges, integrations/logos',
  list: 'bulleted rows — a simple bullet list, checklist, or FAQ list',
  list2: 'two icon+text rows side by side — a two-column feature/benefit list',
  table: 'a grid/table — comparison table or pricing/spec table',
  'media-text': 'image on the LEFT, text on the right — media + copy',
  'text-media': 'text on the left, image on the RIGHT — copy + media',
  'media-split': 'one large media box next to a smaller panel — split media layout',
  video: 'a video thumbnail with a play button beside text — video + copy',
  'video-center': 'a full-width centered video with a play button',
  dashes: 'small dashes/tags — a divider, breadcrumb, or small meta row',
};
export const COLOR_GUIDE =
  'Suggested accents by role: header/nav→teal, hero→blue, features/benefits→indigo, ' +
  'how-it-works→blue, pricing→green, stats/numbers→lime, testimonials/social-proof→purple, ' +
  'logos/partners→steel, gallery/portfolio→fuchsia, FAQ→blue, CTA→pink, contact→orange, ' +
  'warnings/urgency→red, footer→slate.';

export const frameLegend = AI_FRAME_KEYS.map((k) => `- ${k}: ${FRAME_GUIDE[k] || k}`).join('\n');

export function extractResponsesText(data: any): string {
  if (!data) return '';
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
  const out = Array.isArray(data.output) ? data.output : [];
  for (const item of out) {
    const parts = Array.isArray(item?.content) ? item.content : [];
    for (const p of parts) {
      if ((p?.type === 'output_text' || p?.type === 'text') && typeof p?.text === 'string' && p.text.trim()) return p.text;
    }
  }
  return '';
}

const AI_SITEMAP_PROMPT = `You are a SENIOR UX/UI DESIGNER and information architect with 10 years of experience planning and designing complete websites for startups, agencies and enterprise brands. You have architected hundreds of sites and you know information architecture, user journeys, conversion strategy, content design and modern web patterns by heart. Given a short description of a website, you design a COMPLETE, professional sitemap for it — a brand-new project — including the content map (sections) of every page.

WHAT TO PRODUCE
- projectName: a concise, human project name for this website (the brand/site name, or a clear descriptive title). No file extensions, no quotes.
- pages: the full list of pages the website should have, organized as a sensible hierarchy.

THINK LIKE A SENIOR DESIGNER (do this reasoning before answering)
1. Identify the website type, the target audience, and the business's primary goals/conversions.
2. Map the real user journeys and the information architecture a best-in-class version of this site would have: logical top-level sections plus the sub-pages each needs, grouped the way a user actually expects to navigate.
3. Tailor it precisely to THIS business — include the pages it genuinely needs and omit filler. Adapt common patterns to the case: Home, About, Services/Products (with individual sub-pages), Solutions/Use-cases, Pricing, Case Studies/Portfolio, Blog (with key category/article pages), Resources, FAQ, Careers, Contact, plus legal pages (Privacy, Terms) where appropriate.
4. For each page, design its content map like a senior designer would wireframe it: a persuasive narrative arc with strong visual hierarchy and a clear CTA.

PAGE FORMAT — each page is { "id", "title", "parentId", "sections" }:
- id: a short unique string you assign, e.g. "p1", "p2", "p3"...
- title: the page name (1-4 words, human readable).
- parentId: the id of its parent page, or "" (empty string) if it is a top-level page.
- sections: the page's CONTENT MAP — the ordered list of sections (blocks) that page should contain, top to bottom. EVERY page must have a real content map (do not leave it empty).

EACH SECTION is { "name", "frame", "color", "description" }:
- name: a concrete, specific 1-4 word label (e.g. "Hero", "Pricing Tiers", "Customer Logos", "FAQ").
- frame: the wireframe layout that best matches the section's CONTENT. Choose deliberately from this legend (pick the closest visual match, vary them — do NOT default everything to "bar"):
${frameLegend}
- color: an accent reflecting the section's role. ${COLOR_GUIDE}
- description: ONE short, specific sentence about what this section contains for THIS page (concrete elements/value angle, not a restatement of the name).

RULES
- Exactly ONE root page with parentId "": the Home page (id "p1", title "Home").
- Every other page's parentId must reference an id that exists in the list.
- Hierarchy depth 1-3 levels. Keep ids unique. No duplicate sibling titles.
- Give each page 4-7 sections in a logical, persuasive order (start with hero/header, end with a CTA and/or footer where appropriate). Match the frame to the content type and deliberately vary frames for visual rhythm — never stack the same frame repeatedly or default to "bar".
- Every page must read like it was wireframed by a senior designer: clear hierarchy, a primary CTA where relevant, content tailored to that exact page's role in the journey.
- Produce a thorough sitemap: typically 6-14 pages depending on the site's scope. Keep section descriptions concise so the whole sitemap fits in one response.`;

export type AiSection = { name: string; frame: string; color: string; description: string };
export type AiPage = { id: string; title: string; parentId: string; sections: AiSection[] };

// Generate a complete sitemap (projectName + normalized pages with sections) from a prompt.
// Throws an Error (with a user-friendly message) on failure.
export async function generateSitemap(prompt: string): Promise<{ projectName: string; pages: AiPage[] }> {
  if (!OPENAI_API_KEY) throw new Error('AI is not configured (OPENAI_API_KEY missing on the server).');
  const p = String(prompt || '').trim();
  if (!p) throw new Error('Describe the website first.');

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      projectName: { type: 'string', description: 'Concise project/site name.' },
      pages: {
        type: 'array',
        description: 'All pages of the site as a flat list with parent references.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', description: 'Unique short id, e.g. p1.' },
            title: { type: 'string', description: '1-4 word page name.' },
            parentId: { type: 'string', description: 'Parent page id, or "" for a top-level page.' },
            sections: {
              type: 'array',
              description: "The page's content map — ordered sections, top to bottom.",
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string', description: 'Specific 1-4 word section label.' },
                  frame: { type: 'string', enum: AI_FRAME_KEYS, description: 'Wireframe layout key.' },
                  color: { type: 'string', enum: AI_COLOR_KEYS, description: 'Accent color key.' },
                  description: { type: 'string', description: 'One short sentence about the section.' },
                },
                required: ['name', 'frame', 'color', 'description'],
              },
            },
          },
          required: ['id', 'title', 'parentId', 'sections'],
        },
      },
    },
    required: ['projectName', 'pages'],
  };

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 60000);
  let r: any;
  try {
    r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          { role: 'developer', content: AI_SITEMAP_PROMPT },
          { role: 'user', content: `Website to map:\n${p}` },
        ],
        text: { format: { type: 'json_schema', name: 'sitemap', strict: true, schema } },
        max_output_tokens: 16000,
      }),
      signal: ctrl.signal,
    });
  } catch (e) { clearTimeout(to); throw new Error('AI request failed (timeout or network).'); }
  clearTimeout(to);

  if (!r.ok) { console.error('OpenAI error', r.status, await r.text().catch(() => '')); throw new Error('AI request failed. Check the OpenAI key / model / quota.'); }
  const data: any = await r.json();
  const content = extractResponsesText(data);
  if (!content) throw new Error('AI returned no content. Try again or a more detailed prompt.');
  let parsed: any;
  try { parsed = JSON.parse(content); } catch { throw new Error('AI returned invalid JSON.'); }

  const projectName = String(parsed?.projectName || '').trim().slice(0, 80) || 'AI sitemap';
  const rawPages = Array.isArray(parsed?.pages) ? parsed.pages : [];
  const seenIds = new Set<string>();
  const pages: AiPage[] = rawPages.slice(0, 60).map((pg: any, i: number) => {
    let id = String(pg?.id || '').trim() || `p${i + 1}`;
    while (seenIds.has(id)) id = `${id}_${i}`;
    seenIds.add(id);
    const sections = (Array.isArray(pg?.sections) ? pg.sections : []).slice(0, 12).map((s: any) => ({
      name: String(s?.name || '').trim().slice(0, 60) || 'Section',
      frame: AI_FRAME_KEYS.includes(s?.frame) ? s.frame : 'bar',
      color: AI_COLOR_KEYS.includes(s?.color) ? s.color : 'blue',
      description: String(s?.description || '').trim().slice(0, 400),
    }));
    return { id, title: String(pg?.title || '').trim().slice(0, 60) || 'Page', parentId: String(pg?.parentId || '').trim(), sections };
  });
  if (!pages.length) throw new Error('AI returned no pages. Try a more detailed prompt.');

  const ids = new Set(pages.map((x) => x.id));
  const roots = pages.filter((x) => !x.parentId || x.parentId === x.id || !ids.has(x.parentId));
  roots.forEach((x) => { x.parentId = ''; });
  if (roots.length > 1) { const mainRoot = roots[0]; roots.slice(1).forEach((x) => { x.parentId = mainRoot.id; }); }
  return { projectName, pages };
}

/* ------------------------------------------------------------------ */
/*  Style guide generation from a real website. We feed OpenAI the     */
/*  site's screenshot + extracted branding and ask for a normalized    */
/*  design-system token set that maps onto our style-guide template.   */
/* ------------------------------------------------------------------ */

export type SgTokens = {
  brandName: string;
  colors: { brand: string; accent: string; surfaceAlt: string; surfaceCard: string; surfacePage: string; muted: string; text: string };
  headingFont: string;
  bodyFont: string;
  type: { h1: string; h2: string; h3: string; h4: string; h5: string; h6: string; bodyLg: string; bodySm: string; caption: string };
  lineHeights: { heading: string; body: string };
  letterSpacing: { heading: string; body: string };
  radii: { card: string; button: string; input: string; tag: string };
  spacing: { sectionY: string; sectionYTablet: string; sectionYMobile: string; containerWidth: string; containerPadding: string };
};

const HEX = /^#([0-9a-fA-F]{6})$/;
function okHex(v: any, fallback: string): string {
  const s = String(v || '').trim();
  if (HEX.test(s)) return s.toUpperCase();
  const m = s.match(/^#([0-9a-fA-F]{3})$/);
  if (m) return ('#' + m[1].split('').map((c) => c + c).join('')).toUpperCase();
  return fallback;
}
function cleanFont(v: any, fallback: string): string {
  const s = String(v || '').replace(/["']/g, '').split(',')[0].trim();
  return s && s.length <= 40 ? s : fallback;
}
// Popular Google Fonts (lowercase) we can actually load.
const GF_SET = new Set<string>([
  'inter', 'roboto', 'open sans', 'lato', 'montserrat', 'poppins', 'raleway', 'nunito', 'nunito sans',
  'work sans', 'rubik', 'mulish', 'manrope', 'dm sans', 'dm serif display', 'karla', 'source sans 3',
  'source serif 4', 'pt sans', 'pt serif', 'merriweather', 'playfair display', 'lora', 'noto sans',
  'noto serif', 'ibm plex sans', 'ibm plex serif', 'ibm plex mono', 'libre franklin', 'archivo', 'barlow',
  'oswald', 'bebas neue', 'josefin sans', 'quicksand', 'cabin', 'fira sans', 'fira code', 'heebo',
  'space grotesk', 'space mono', 'jetbrains mono', 'sora', 'epilogue', 'figtree', 'plus jakarta sans',
  'outfit', 'red hat display', 'urbanist', 'lexend', 'crimson pro', 'eb garamond', 'cormorant garamond',
  'spectral', 'bitter', 'roboto slab', 'roboto mono', 'overpass', 'comfortaa', 'dosis', 'inconsolata',
  'anton', 'fraunces', 'newsreader', 'hanken grotesk', 'albert sans', 'instrument sans', 'mukta', 'cairo',
]);
// Known proprietary/system fonts → the closest Google Fonts substitute (so the guide still
// RENDERS in a similar typeface instead of a generic fallback when the real font isn't on GF).
const FONT_SUBS: Array<[RegExp, string]> = [
  [/sohne|söhne|soehne/i, 'Inter'], [/untitled sans/i, 'Inter'], [/graphik/i, 'Inter'],
  [/circular/i, 'Manrope'], [/gt america|gt walsheim/i, 'Inter'], [/founders grotesk|founders/i, 'Space Grotesk'],
  [/neue montreal|aeonik|ginto|basis grotesque/i, 'Space Grotesk'], [/neue haas|helvetica|arial|aktiv grotesk|suisse|maison neue/i, 'Inter'],
  [/proxima nova/i, 'Montserrat'], [/gilroy|geomanist/i, 'Poppins'], [/averta/i, 'Mulish'],
  [/recoleta/i, 'Fraunces'], [/tiempos/i, 'Lora'], [/canela|ogg/i, 'Playfair Display'],
  [/calibre|styrene|ppmori|mori|national|tt commons|tt norms/i, 'Inter'], [/gellix|cera/i, 'Poppins'],
];
// Resolve a computed font-family stack into a font that WILL render: the real font if it's
// a Google Font, else a close GF substitute (by foundry map, then by generic category).
function resolveFont(stack: any, fallback: string): string {
  const raw = String(stack || '');
  const pretty = prettifyFont(raw.split(',')[0], '');
  if (pretty && GF_SET.has(pretty.toLowerCase())) return pretty;     // real Google Font → keep
  for (const [re, sub] of FONT_SUBS) if (re.test(raw)) return sub;   // known proprietary → close match
  const lc = raw.toLowerCase();
  if (/monospace/.test(lc) || /\bmono\b/.test(pretty.toLowerCase())) return 'JetBrains Mono';
  if (/sans-serif|sans serif/.test(lc)) return 'Inter';
  if (/serif/.test(lc)) return 'Lora';
  return pretty && GF_SET.has(pretty.toLowerCase()) ? pretty : (fallback || 'Inter');
}
// Turn a raw computed font-family token (often an internal @font-face name like
// "sohne-var", "untitled-sans", "GT-America-Standard") into a clean display name.
function prettifyFont(v: any, fallback: string): string {
  let s = String(v || '').replace(/["']/g, '').split(',')[0].trim();
  if (!s) return fallback;
  // normalise separators (e.g. "Manrope_bold", "sohne-var") → spaces
  s = s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  // strip TRAILING weight / style / variable-font tokens repeatedly (keep real names like
  // "Playfair Display" / "DM Serif Text", so we don't strip display/text).
  const junk = /\s+(variable|vf|variablefont|webfont|thin|extralight|ultralight|light|regular|normal|book|roman|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|oblique|var)$/i;
  while (junk.test(s)) s = s.replace(junk, '').trim();
  if (!s) return fallback;
  s = s.split(' ').map((w) => /^[A-Z0-9]+$/.test(w) ? w : (w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  return s.length <= 40 ? s : fallback;
}
// first valid #RRGGBB among candidates ('' if none)
function firstHex(...vals: any[]): string { for (const v of vals) { const h = okHex(v, ''); if (h) return h; } return ''; }
// mix a hex toward white by ratio (0..1) — for derived light surfaces
function lighten(hex: string, ratio: number): string {
  const h = okHex(hex, ''); if (!h) return '';
  const n = parseInt(h.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * ratio);
  const to2 = (c: number) => ('0' + c.toString(16)).slice(-2);
  return ('#' + to2(mix(r)) + to2(mix(g)) + to2(mix(b))).toUpperCase();
}

const SG_PROMPT = `You are a senior brand and design-systems expert. From a website's screenshot and its extracted branding data, distill a clean, accessible DESIGN SYSTEM token set for a style guide. Honor any extra instructions from the user (e.g. "make it darker", "use the blue as primary").

Return these tokens:
- brandName: the brand / site name (short, human; no quotes).
- colors (all as #RRGGBB hex):
  - brand: the primary brand colour — the dominant strong colour used for headlines, nav and dark UI. Pick a deep, saturated colour, not near-black unless the brand truly is.
  - accent: the vivid action colour for buttons / links / highlights.
  - surfaceAlt: a very light tinted surface for alternate sections.
  - surfaceCard: a soft/warm light surface for cards.
  - surfacePage: the page background (usually #FFFFFF or very close).
  - muted: a neutral grey for captions / metadata.
- headingFont: a real Google Fonts family that matches the site's headings vibe (e.g. "Playfair Display", "Poppins", "Inter").
- bodyFont: a real Google Fonts family for body text.

Also reproduce the site's FULL system in detail (read it from the screenshot + your knowledge of the site):
- type: the desktop type scale in px — h1 (hero), h2, h3, h4, h5, h6, bodyLg, bodySm, caption. Use realistic values matching the site (e.g. a bold modern site may have h1 ~64–96px).
- lineHeights: heading (tight, e.g. 1.1–1.25) and body (1.5–1.7).
- letterSpacing: heading (often slightly negative like -0.02em) and body (0em).
- radii: card, button, input, tag — match the site (rounded vs sharp; "999px" for pill buttons).
- spacing: sectionY (desktop section vertical padding), sectionYTablet, sectionYMobile, containerWidth (max content width), containerPadding.

Ensure good contrast (brand and accent must be readable as text on white, and white must be readable on them). Prefer fonts that actually exist on Google Fonts.`;

// JS run on the LIVE page (via Firecrawl executeJavascript) to read REAL computed styles —
// so font sizes, line-heights, letter-spacing, radii, fonts and colours are exact, not guessed.
export const STYLE_PROBE_JS = `(function(){
  function num(v){var n=parseFloat(v);return isNaN(n)?null:n;}
  function px(n){return n!=null?(Math.round(n)+'px'):'';}
  function all(sel){try{return Array.prototype.slice.call(document.querySelectorAll(sel));}catch(e){return [];}}
  function vis(el){try{var r=el.getBoundingClientRect();var s=getComputedStyle(el);return r.width>1&&r.height>1&&s.display!=='none'&&s.visibility!=='hidden'&&parseFloat(s.opacity||'1')>0.05;}catch(e){return false;}}
  function mode(arr){if(!arr.length)return null;var m={},best=arr[0],bc=0;arr.forEach(function(v){var k=Math.round(v);m[k]=(m[k]||0)+1;if(m[k]>bc){bc=m[k];best=v;}});return best;}
  function median(arr){if(!arr.length)return null;var a=arr.slice().sort(function(x,y){return x-y;});return a[Math.floor(a.length/2)];}
  // Representative heading element for a tag = the LARGEST visible one with real text.
  function head(tag){var best=null,bs=0;all(tag).forEach(function(e){if(!vis(e))return;if(((e.textContent||'').trim()).length<2)return;var fs=num(getComputedStyle(e).fontSize)||0;if(fs>bs){bs=fs;best=e;}});if(!best)return null;var s=getComputedStyle(best);return {size:s.fontSize,lh:s.lineHeight,ls:s.letterSpacing,family:s.fontFamily,color:s.color};}
  var h1=head('h1'),h2=head('h2'),h3=head('h3'),h4=head('h4'),h5=head('h5'),h6=head('h6');
  var H=h1||h2||h3;
  var bodyEl=document.body, bcs=getComputedStyle(bodyEl);
  // Body size = most common visible paragraph size.
  var psz=all('p, li').filter(vis).map(function(e){return num(getComputedStyle(e).fontSize);}).filter(function(x){return x&&x>=11&&x<=24;});
  var bodySize=mode(psz)||num(bcs.fontSize);
  var pRep=all('p').filter(function(e){return vis(e)&&Math.round(num(getComputedStyle(e).fontSize))===Math.round(bodySize);})[0]||all('p').filter(vis)[0];
  var pcs=pRep?getComputedStyle(pRep):bcs;
  // Buttons = BUTTON-SIZED elements with a fill/border + padding (so we don't mistake a big
  // coloured card or section for a button). Accent = the MOST COMMON filled-button colour.
  function modeStr(arr){var m={},best='',bc=0;arr.forEach(function(v){if(!v)return;m[v]=(m[v]||0)+1;if(m[v]>bc){bc=m[v];best=v;}});return best;}
  function btnLike(e){try{var s=getComputedStyle(e);var bg=s.backgroundColor;var hasBg=bg&&bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent';var hasBorder=(num(s.borderTopWidth)||0)>0;var r=e.getBoundingClientRect();var okSize=r.height>=28&&r.height<=72&&r.width>=56&&r.width<=440;return vis(e)&&okSize&&(hasBg||hasBorder)&&(num(s.paddingLeft)||0)>=10;}catch(e){return false;}}
  var btns=all('button, a, [role="button"], input[type="submit"], input[type="button"], .btn, [class*="btn"], [class*="button"]').filter(btnLike);
  var filled=btns.filter(function(e){var bg=getComputedStyle(e).backgroundColor;return bg&&bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent';});
  // a real CTA is usually a COLOURFUL fill (not a dark/neutral nav button). Prefer those for
  // BOTH the accent colour AND the button radius (nav links are often sharp & outnumber them).
  function colorful(c){var m=String(c).match(/rgba?\(([^)]+)\)/);if(!m)return false;var p=m[1].split(',').map(parseFloat);var mx=Math.max(p[0],p[1],p[2]),mn=Math.min(p[0],p[1],p[2]);var lum=(p[0]+p[1]+p[2])/3;return (mx-mn)>=36&&lum>30&&lum<232;}
  var colorBtns=filled.filter(function(e){return colorful(getComputedStyle(e).backgroundColor);});
  function firstNonNull(){for(var i=0;i<arguments.length;i++){if(arguments[i]!=null)return arguments[i];}return null;}
  function radList(arr){return arr.map(function(e){return num(getComputedStyle(e).borderRadius);}).filter(function(x){return x!=null;});}
  var btnRad=firstNonNull(mode(radList(colorBtns)), mode(radList(filled)), mode(radList(btns)));
  var btnBgColor=modeStr(colorBtns.map(function(e){return getComputedStyle(e).backgroundColor;}))||modeStr(filled.map(function(e){return getComputedStyle(e).backgroundColor;}));
  var bf=(colorBtns.length?colorBtns:filled).filter(function(e){return getComputedStyle(e).backgroundColor===btnBgColor;})[0]||filled[0];
  var bfc=bf?getComputedStyle(bf):null;
  // Cards = boxed elements (shadow or border) with radius.
  function cardLike(e){try{var s=getComputedStyle(e);var br=num(s.borderRadius)||0;var sh=s.boxShadow&&s.boxShadow!=='none';var bd=(num(s.borderTopWidth)||0)>0;var r=e.getBoundingClientRect();return vis(e)&&br>0&&br<200&&(sh||bd)&&r.width>=120&&r.height>=80;}catch(e){return false;}}
  var cards=all('div, article, li, section').filter(cardLike);
  var cardRad=mode(cards.map(function(e){return num(getComputedStyle(e).borderRadius);}).filter(function(x){return x!=null;}));
  var inp=all('input, textarea, select').filter(vis)[0];
  // Sections = full-width blocks (incl. generic divs — many sites don't use <section>).
  // Section rhythm = the MOST COMMON sizable vertical padding (top or bottom).
  var iw=window.innerWidth||1280;
  var spads=[];
  all('section, header, footer, div, [class*="section"], [class*="block"], [class*="container"], [class*="row"], [class*="wrap"]').forEach(function(e){
    if(!vis(e))return; var r=e.getBoundingClientRect(); if(r.width < iw*0.55) return;
    var s=getComputedStyle(e); var pt=num(s.paddingTop)||0, pb=num(s.paddingBottom)||0;
    if(pt>=40&&pt<=400) spads.push(pt);
    if(pb>=40&&pb<=400) spads.push(pb);
  });
  var sectionY=mode(spads)||median(spads);
  var cws=all('[class*="container"],[class*="wrapper"],[class*="wrap"],main,section > div').map(function(e){return num(getComputedStyle(e).maxWidth);}).filter(function(x){return x&&x>=600&&x<=1800;});
  var containerWidth=mode(cws);
  var link=all('main a, article a, p a').filter(vis)[0]||all('a').filter(vis)[0];
  return {
    fonts:{heading:(H&&H.family)||bcs.fontFamily, body:pcs.fontFamily||bcs.fontFamily},
    type:{h1:h1&&h1.size,h2:h2&&h2.size,h3:h3&&h3.size,h4:h4&&h4.size,h5:h5&&h5.size,h6:h6&&h6.size,body:px(bodySize)},
    lh:{heading:H&&H.lh,headingSize:H&&H.size,body:pcs.lineHeight,bodySize:px(bodySize)},
    ls:{heading:H&&H.ls,body:pcs.letterSpacing},
    colors:{heading:(H&&H.color)||bcs.color,text:bcs.color,pageBg:bcs.backgroundColor,link:link?getComputedStyle(link).color:'',btnBg:btnBgColor||(bfc?bfc.backgroundColor:''),btnColor:bfc?bfc.color:''},
    radii:{button:px(btnRad),card:px(cardRad),input:inp?getComputedStyle(inp).borderRadius:''},
    spacing:{sectionY:px(sectionY),containerWidth:px(containerWidth)}
  };
})()`;

function rgbToHexStr(v: string): string {
  const s = String(v || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return '';
  const p = m[1].split(',').map((x) => parseFloat(x));
  if (p.length >= 4 && p[3] === 0) return ''; // transparent
  const h = (n: number) => ('0' + Math.max(0, Math.min(255, Math.round(n || 0))).toString(16)).slice(-2);
  return ('#' + h(p[0]) + h(p[1]) + h(p[2])).toUpperCase();
}
const roundPx = (v: any): string => { const n = parseFloat(String(v)); return isNaN(n) ? '' : Math.round(n) + 'px'; };

// Build accurate tokens from the page's REAL computed styles (+ Firecrawl branding for colours).
export function tokensFromComputed(branding: any, computed: any): Partial<SgTokens> | null {
  let cmp = computed;
  if (typeof cmp === 'string') { try { cmp = JSON.parse(cmp); } catch { cmp = null; } }
  if (!cmp || typeof cmp !== 'object') return null;
  const b = (branding && branding.colors) || {};
  const ratio = (lh: any, size: any, fb: string) => { const l = parseFloat(lh), s = parseFloat(size); if (!isNaN(l) && !isNaN(s) && s) return String(Math.round((l / s) * 100) / 100); return /px$/.test(String(lh)) ? fb : fb; };
  const emOf = (ls: any, size: any, fb: string) => { const l = parseFloat(ls), s = parseFloat(size); if (String(ls).trim() === 'normal' || isNaN(l)) return fb; if (!s) return fb; return (Math.round((l / s) * 1000) / 1000) + 'em'; };
  const t = cmp.type || {}; const lh = cmp.lh || {}; const ls = cmp.ls || {}; const rd = cmp.radii || {}; const sp = cmp.spacing || {}; const cc = cmp.colors || {};
  const radius = (v: any, fb: string) => { const n = parseFloat(String(v)); if (isNaN(n)) return fb; return n >= 100 ? '999px' : Math.round(n) + 'px'; };

  // Heading/brand colour = the REAL colour headings use on the page — but reject a near-white
  // reading (e.g. a heading captured inside a dark hero) so headings stay readable on a light page.
  const lum = (hex: string): number => { const h = String(hex || '').replace('#', ''); if (h.length !== 6) return 0; const n = parseInt(h, 16); const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, bl = (n & 255) / 255; return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const satOf = (hex: string): number => { const h = String(hex || '').replace('#', ''); if (h.length !== 6) return 0; const n = parseInt(h, 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, bl = n & 255; return Math.max(r, g, bl) - Math.min(r, g, bl); };
  // brand = the dark, near-neutral TEXT colour (heading/body). Never a saturated/colourful value
  // (a coloured hero headline or the accent), so text never comes out blue/purple.
  const pickBrand = (...cands: any[]): string => {
    const hexes = cands.map((c) => rgbToHexStr(c)).filter(Boolean);
    for (const h of hexes) { if (lum(h) < 0.45 && satOf(h) <= 70) return h; } // dark & near-neutral
    for (const h of hexes) { if (lum(h) < 0.55) return h; }                   // any dark
    return hexes[0] || '#1F2937';
  };
  // accent must be COLOURFUL (a saturated CTA), not a pale tint or a neutral/near-grey.
  const pickAccent = (...cands: any[]): string => {
    const hexes = cands.map((c) => rgbToHexStr(c)).filter(Boolean);
    for (const h of hexes) { if (satOf(h) >= 36 && lum(h) > 0.12 && lum(h) < 0.92) return h; } // saturated first
    return hexes[0] || '';
  };
  const brandHex = pickBrand(cc.heading, cc.text, b.textPrimary, b.primary);
  const accentHex = pickAccent(cc.btnBg, b.accent, cc.link, b.link);

  // Build a clean, strictly-decreasing heading scale from the real measured sizes.
  // The probe may miss a level or grab an unrepresentative element — interpolate gaps
  // and clamp so h1 > h2 > … > h6 and every step stays above body size.
  const pxn = (v: any): number | null => { const n = parseFloat(String(v)); return isNaN(n) ? null : Math.round(n); };
  const bodyPx = pxn(t.body) || 16;
  const buildScale = (): number[] => {
    const raw = [pxn(t.h1), pxn(t.h2), pxn(t.h3), pxn(t.h4), pxn(t.h5), pxn(t.h6)];
    const def = [56, 40, 30, 24, 20, 17];
    const out: (number | null)[] = raw.slice();
    // Keep only strictly-decreasing values that sit clearly ABOVE body size; a heading
    // measured at/near body size is a misread (e.g. a tiny inline h4) → drop & interpolate.
    let prev = Infinity;
    for (let i = 0; i < 6; i++) { const v = out[i]; if (v == null || !(v < prev) || v <= bodyPx) out[i] = null; else prev = v; }
    if (out[0] == null) out[0] = raw.find((x) => x != null) ?? def[0];
    for (let i = 1; i < 6; i++) {
      if (out[i] != null) continue;
      let p = i - 1; while (p >= 0 && out[p] == null) p--;
      let n = i + 1; while (n < 6 && out[n] == null) n++;
      if (p >= 0 && n < 6) out[i] = Math.round((out[p] as number) + ((out[n] as number) - (out[p] as number)) * ((i - p) / (n - p)));
      else if (p >= 0) out[i] = Math.max(bodyPx + 1, Math.round((out[p] as number) * 0.84));
      else out[i] = def[i];
    }
    // Final guarantee: strictly decreasing, never at/below body.
    prev = Infinity;
    for (let i = 0; i < 6; i++) { let v = out[i] as number; if (v >= prev) v = prev - 1; if (v <= bodyPx) v = bodyPx + 1; out[i] = v; prev = v; }
    return out as number[];
  };
  const hs = buildScale();

  const out: Partial<SgTokens> = {
    colors: {
      // brand = dark, near-neutral text colour (never the saturated accent / coloured hero)
      brand: brandHex || '#1F2937',
      // accent = the saturated CTA / brand accent (pickAccent prefers a colourful value over a
      // pale tint or neutral). brand is the dark heading colour, so this stays distinct.
      accent: accentHex || rgbToHexStr(b.accent) || rgbToHexStr(cc.btnBg) || '#2563EB',
      surfacePage: rgbToHexStr(b.background) || rgbToHexStr(cc.pageBg) || '#FFFFFF',
      muted: rgbToHexStr(b.textSecondary) || '#6B7280',
      // body text = the real reading colour (dark, near-neutral)
      text: pickBrand(cc.text, cc.heading, b.textPrimary),
      surfaceAlt: '', surfaceCard: '',
    },
    headingFont: resolveFont(cmp.fonts && cmp.fonts.heading, 'Inter'),
    bodyFont: resolveFont(cmp.fonts && cmp.fonts.body, 'Inter'),
    type: {
      h1: hs[0] + 'px', h2: hs[1] + 'px', h3: hs[2] + 'px', h4: hs[3] + 'px',
      h5: hs[4] + 'px', h6: hs[5] + 'px',
      bodyLg: (bodyPx + 1) + 'px', bodySm: bodyPx + 'px', caption: Math.max(12, bodyPx - 2) + 'px',
    },
    lineHeights: { heading: ratio(lh.heading, lh.headingSize, '1.15'), body: ratio(lh.body, lh.bodySize, '1.6') },
    letterSpacing: { heading: emOf(ls.heading, lh.headingSize, '-0.02em'), body: emOf(ls.body, lh.bodySize, '0em') },
    radii: { card: radius(rd.card, '16px'), button: radius(rd.button, '8px'), input: radius(rd.input, '8px'), tag: '999px' },
    spacing: (() => {
      const secY = parseFloat(roundPx(sp.sectionY)) || 96;
      return {
        sectionY: secY + 'px',
        sectionYTablet: Math.round(secY * 0.62) + 'px',
        sectionYMobile: Math.round(secY * 0.46) + 'px',
        containerWidth: roundPx(sp.containerWidth) || '1200px',
        containerPadding: '24px',
      };
    })(),
  };
  return out;
}

// Generate a style-guide token set. `branding` is Firecrawl's BrandingProfile (optional),
// `screenshotUrl` is a public screenshot URL (optional). At least one signal should be present.
export async function generateStyleGuideTokens(opts: { url: string; instructions?: string; branding?: any; screenshotUrl?: string }): Promise<SgTokens> {
  if (!OPENAI_API_KEY) throw new Error('AI is not configured (OPENAI_API_KEY missing on the server).');

  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      brandName: { type: 'string', description: 'Brand / site name.' },
      colors: {
        type: 'object', additionalProperties: false,
        properties: {
          brand: { type: 'string', description: 'Primary brand colour #RRGGBB.' },
          accent: { type: 'string', description: 'Accent / action colour #RRGGBB.' },
          surfaceAlt: { type: 'string', description: 'Light tinted surface #RRGGBB.' },
          surfaceCard: { type: 'string', description: 'Soft card surface #RRGGBB.' },
          surfacePage: { type: 'string', description: 'Page background #RRGGBB.' },
          muted: { type: 'string', description: 'Neutral grey #RRGGBB.' },
        },
        required: ['brand', 'accent', 'surfaceAlt', 'surfaceCard', 'surfacePage', 'muted'],
      },
      headingFont: { type: 'string', description: 'Google Fonts family for headings.' },
      bodyFont: { type: 'string', description: 'Google Fonts family for body.' },
      type: {
        type: 'object', additionalProperties: false,
        description: 'Desktop type scale in px (numbers like "64px").',
        properties: {
          h1: { type: 'string' }, h2: { type: 'string' }, h3: { type: 'string' }, h4: { type: 'string' }, h5: { type: 'string' }, h6: { type: 'string' },
          bodyLg: { type: 'string', description: 'Large body size.' }, bodySm: { type: 'string', description: 'Default body size.' }, caption: { type: 'string' },
        },
        required: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'bodyLg', 'bodySm', 'caption'],
      },
      lineHeights: {
        type: 'object', additionalProperties: false,
        properties: { heading: { type: 'string', description: 'Heading line-height, e.g. "1.15".' }, body: { type: 'string', description: 'Body line-height, e.g. "1.6".' } },
        required: ['heading', 'body'],
      },
      letterSpacing: {
        type: 'object', additionalProperties: false,
        properties: { heading: { type: 'string', description: 'Heading letter-spacing, e.g. "-0.02em".' }, body: { type: 'string', description: 'Body letter-spacing, e.g. "0em".' } },
        required: ['heading', 'body'],
      },
      radii: {
        type: 'object', additionalProperties: false,
        properties: { card: { type: 'string', description: 'Card radius px.' }, button: { type: 'string', description: 'Button radius px (use "999px" for pills).' }, input: { type: 'string' }, tag: { type: 'string' } },
        required: ['card', 'button', 'input', 'tag'],
      },
      spacing: {
        type: 'object', additionalProperties: false,
        properties: {
          sectionY: { type: 'string', description: 'Desktop section vertical padding px.' },
          sectionYTablet: { type: 'string' }, sectionYMobile: { type: 'string' },
          containerWidth: { type: 'string', description: 'Max content width px (e.g. "1200px").' },
          containerPadding: { type: 'string', description: 'Horizontal container padding px.' },
        },
        required: ['sectionY', 'sectionYTablet', 'sectionYMobile', 'containerWidth', 'containerPadding'],
      },
    },
    required: ['brandName', 'colors', 'headingFont', 'bodyFont', 'type', 'lineHeights', 'letterSpacing', 'radii', 'spacing'],
  };

  const userParts: any[] = [{
    type: 'input_text',
    text: `Website: ${String(opts.url || '').trim()}\n`
      + `User instructions: ${String(opts.instructions || '(none)').trim()}\n`
      + `Extracted branding (may be partial or empty):\n${JSON.stringify(opts.branding || {}, null, 0).slice(0, 4000)}`,
  }];
  if (opts.screenshotUrl) userParts.push({ type: 'input_image', image_url: opts.screenshotUrl });

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 90000);
  let r: any;
  try {
    r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [{ role: 'developer', content: SG_PROMPT }, { role: 'user', content: userParts }],
        text: { format: { type: 'json_schema', name: 'styleguide_tokens', strict: true, schema } },
        max_output_tokens: 2000,
      }),
      signal: ctrl.signal,
    });
  } catch (e) { clearTimeout(to); throw new Error('AI request failed (timeout or network).'); }
  clearTimeout(to);
  if (!r.ok) { console.error('OpenAI error', r.status, await r.text().catch(() => '')); throw new Error('AI request failed. Check the OpenAI key / model / quota.'); }

  const data: any = await r.json();
  const content = extractResponsesText(data);
  if (!content) throw new Error('AI returned no content.');
  let p: any; try { p = JSON.parse(content); } catch { throw new Error('AI returned invalid JSON.'); }
  const c = p?.colors || {};
  // Firecrawl's extracted branding is the SOURCE OF TRUTH (real site CSS) — prefer it so
  // each site comes out accurate; the model only fills gaps / picks fonts / brand name.
  const b = (opts.branding && opts.branding.colors) || {};
  const bf = (opts.branding && opts.branding.typography && opts.branding.typography.fontFamilies) || {};
  const bFonts = (opts.branding && Array.isArray(opts.branding.fonts)) ? opts.branding.fonts : [];

  const brand = firstHex(b.textPrimary, b.primary, c.brand) || '#1F2937';
  const text = firstHex(b.textPrimary, c.text, c.brand) || '#111827';
  const accent = firstHex(b.accent, b.link, b.secondary, b.primary, c.accent) || '#2563EB';
  const surfacePage = firstHex(b.background, c.surfacePage) || '#FFFFFF';
  const muted = firstHex(b.textSecondary, c.muted) || '#6B7280';
  const surfaceAlt = firstHex(c.surfaceAlt) || lighten(accent, 0.88) || '#F4F4F7';
  const surfaceCard = firstHex(c.surfaceCard) || lighten(brand, 0.93) || '#FAFAF8';

  const headingFont = cleanFont(bf.heading || bf.display || (bFonts[0] && bFonts[0].family), '') || cleanFont(p?.headingFont, 'Inter');
  const bodyFont = cleanFont(bf.body || bf.primary || (bFonts[1] && bFonts[1].family) || (bFonts[0] && bFonts[0].family), '') || cleanFont(p?.bodyFont, 'Inter');

  // sanitizers for scale values
  const pxv = (v: any, fb: string): string => { const s = String(v || '').trim(); if (/^[0-9]+(\.[0-9]+)?px$/.test(s)) return s; if (/^[0-9]+(\.[0-9]+)?$/.test(s)) return s + 'px'; return fb; };
  const numv = (v: any, fb: string): string => { const s = String(v || '').trim(); return /^[0-9]+(\.[0-9]+)?$/.test(s) ? s : fb; };
  const emv = (v: any, fb: string): string => { const s = String(v || '').trim(); return /^-?[0-9]+(\.[0-9]+)?em$/.test(s) ? s : (/^-?[0-9]+(\.[0-9]+)?$/.test(s) ? s + 'em' : fb); };
  const ty = p?.type || {}; const lh = p?.lineHeights || {}; const ls = p?.letterSpacing || {}; const rd = p?.radii || {}; const sp = p?.spacing || {};

  return {
    brandName: String(p?.brandName || '').trim().slice(0, 80) || 'Brand',
    colors: { brand, accent, surfaceAlt, surfaceCard, surfacePage, muted, text },
    headingFont,
    bodyFont,
    type: {
      h1: pxv(ty.h1, '64px'), h2: pxv(ty.h2, '48px'), h3: pxv(ty.h3, '36px'), h4: pxv(ty.h4, '28px'),
      h5: pxv(ty.h5, '22px'), h6: pxv(ty.h6, '18px'), bodyLg: pxv(ty.bodyLg, '18px'), bodySm: pxv(ty.bodySm, '16px'), caption: pxv(ty.caption, '14px'),
    },
    lineHeights: { heading: numv(lh.heading, '1.15'), body: numv(lh.body, '1.6') },
    letterSpacing: { heading: emv(ls.heading, '-0.02em'), body: emv(ls.body, '0em') },
    radii: { card: pxv(rd.card, '20px'), button: pxv(rd.button, '10px'), input: pxv(rd.input, '10px'), tag: /^999/.test(String(rd.tag)) ? '999px' : pxv(rd.tag, '999px') },
    spacing: {
      sectionY: pxv(sp.sectionY, '96px'), sectionYTablet: pxv(sp.sectionYTablet, '72px'), sectionYMobile: pxv(sp.sectionYMobile, '56px'),
      containerWidth: pxv(sp.containerWidth, '1200px'), containerPadding: pxv(sp.containerPadding, '24px'),
    },
  };
}

/* Sample typography copy for the type-scale specimens, written in the brand's voice so the
   style guide's headlines/body samples are ABOUT the (content) brand, not the template. */
export type SgCopy = { h1: string; h2: string; h3: string; h4: string; h5: string; h6: string; eyebrow: string; muted: string };
export async function generateStyleGuideCopy(opts: { brandName: string; about?: string; instructions?: string }): Promise<SgCopy | null> {
  if (!OPENAI_API_KEY) return null;
  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      h1: { type: 'string', description: 'Hero headline, 2–4 words (a tagline).' },
      h2: { type: 'string', description: 'Section heading, ~4–7 words.' },
      h3: { type: 'string', description: 'Longer subheading, ~8–12 words.' },
      h4: { type: 'string', description: 'Small heading, 2–4 words.' },
      h5: { type: 'string', description: 'Lead body sentence, ~10–14 words.' },
      h6: { type: 'string', description: 'Smaller body sentence, ~10–14 words.' },
      eyebrow: { type: 'string', description: 'Category label, 1–2 words.' },
      muted: { type: 'string', description: 'Caption / metadata sentence.' },
    },
    required: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'eyebrow', 'muted'],
  };
  const prompt = `Write SHORT sample copy for a design system's typography specimens, in the voice and industry of the brand below. Each field is a realistic example sentence/heading that brand would actually use. No quotes, no markdown.`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 60000);
  let r: any;
  try {
    r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          { role: 'developer', content: prompt },
          { role: 'user', content: `Brand: ${opts.brandName}\nAbout: ${(opts.about || '').slice(0, 1200) || '(infer from the brand name)'}\nExtra: ${opts.instructions || '(none)'}` },
        ],
        text: { format: { type: 'json_schema', name: 'sg_copy', strict: true, schema } },
        max_output_tokens: 1200,
      }),
      signal: ctrl.signal,
    });
  } catch (e) { clearTimeout(to); return null; }
  clearTimeout(to);
  if (!r.ok) return null;
  const data: any = await r.json();
  const content = extractResponsesText(data);
  if (!content) return null;
  let p: any; try { p = JSON.parse(content); } catch { return null; }
  const s = (v: any, n = 200) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  return { h1: s(p.h1, 60), h2: s(p.h2, 90), h3: s(p.h3, 140), h4: s(p.h4, 60), h5: s(p.h5, 160), h6: s(p.h6, 160), eyebrow: s(p.eyebrow, 40), muted: s(p.muted, 160) };
}

/* ------------------------------------------------------------------ */
/*  Style-guide assistant: a chat that edits the design system. It      */
/*  returns CSS-variable token updates and per-role font assignments     */
/*  the editor applies live. If the user references a website, the route  */
/*  passes its screenshot + branding so the assistant can match it.      */
/* ------------------------------------------------------------------ */

export type SgAssistantResult = {
  reply: string;
  tokenUpdates: Array<{ name: string; value: string }>;
  roleFonts: Array<{ role: string; font: string }>;
};

const SG_ASSIST_PROMPT = `You are the assistant inside a DESIGN-SYSTEM / style-guide editor. The whole look is driven by CSS custom properties (design tokens) on :root.

You receive the CURRENT tokens and a user instruction. Optionally you also receive a referenced website's extracted branding and a screenshot — when present, change the tokens so the style guide MATCHES that site's look (colours, fonts, feel).

BRAND PALETTE TOKENS (these drive the big visible colour swatches — set them when changing the colour scheme):
- --color-brand        = primary brand colour (headings, nav, dark UI)
- --color-secondary    = supporting colour
- --color-accent       = accent / action colour (buttons, links, highlights)
- --color-text         = body text colour
- --color-surface-page = page background (usually #FFFFFF)
- --color-border       = borders & dividers
- --color-muted        = neutral grey for captions
- --color-surface-alt / --color-surface-card = tinted / card surfaces
Semantic tokens reference the palette and usually don't need changing: --text-heading, --text-primary, --text-muted, --link-color, --btn-bg, --btn-text.

FONTS: --font-heading (display/headings) and --font-body (body/UI). Use real Google Fonts family names.
TYPE: --text-h1…--text-h6, --text-body-lg, --text-body-sm, --text-caption (px). LINE-HEIGHT: --lh-heading, --lh-body (unitless). LETTER-SPACING: --ls-heading, --ls-body (em).
BUTTON: --btn-bg, --btn-text, --btn-font-size, --btn-weight, --btn-letter-spacing, --btn-text-transform, --btn-radius, --btn-bg-hover, --btn-text-hover.
FORM FIELDS: --input-bg, --input-text, --input-font-size, --input-border, --input-focus-border, --input-radius, --input-placeholder-color.
SPACING & RADII: --section-padding-y (+ -t / -m), --container-max-width, --container-padding-x, --gap, --radius-card, --radius-button, --radius-input, --radius-tag.

Return:
- reply: one short, friendly sentence describing what you changed.
- tokenUpdates: ONLY the tokens you are changing, each as { name (the exact --token), value }. Colours must be #RRGGBB. Sizes keep their unit (e.g. "120px", "1.2", "-0.03em"). For fonts prefer setting --font-heading / --font-body directly.
- roleFonts: optional per-role font assignments, each { role (one of H1,H2,H3,H4,H5,H6,Body,Buttons,Nav), font (Google Fonts family) } — H1/H2/H3 map to the heading font, the rest to the body font.

Change as much or as little as the instruction needs. Keep good contrast and readability. Do not invent token names that aren't listed.`;

export async function styleGuideAssistant(opts: { message: string; tokens?: Record<string, string>; branding?: any; screenshotUrl?: string }): Promise<SgAssistantResult> {
  if (!OPENAI_API_KEY) throw new Error('AI is not configured (OPENAI_API_KEY missing on the server).');
  const msg = String(opts.message || '').trim();
  if (!msg) throw new Error('Type an instruction first.');

  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      reply: { type: 'string', description: 'Short summary of the change.' },
      tokenUpdates: {
        type: 'array', description: 'CSS variable updates to apply.',
        items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name', 'value'] },
      },
      roleFonts: {
        type: 'array', description: 'Per-role font assignments.',
        items: { type: 'object', additionalProperties: false, properties: { role: { type: 'string', enum: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'Body', 'Buttons', 'Nav'] }, font: { type: 'string' } }, required: ['role', 'font'] },
      },
    },
    required: ['reply', 'tokenUpdates', 'roleFonts'],
  };

  const parts: any[] = [{
    type: 'input_text',
    text: `Current tokens:\n${JSON.stringify(opts.tokens || {}, null, 0).slice(0, 4000)}\n\n`
      + (opts.branding ? `Referenced site branding:\n${JSON.stringify(opts.branding, null, 0).slice(0, 3000)}\n\n` : '')
      + `User instruction: ${msg}`,
  }];
  if (opts.screenshotUrl) parts.push({ type: 'input_image', image_url: opts.screenshotUrl });

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 90000);
  let r: any;
  try {
    r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [{ role: 'developer', content: SG_ASSIST_PROMPT }, { role: 'user', content: parts }],
        text: { format: { type: 'json_schema', name: 'sg_assistant', strict: true, schema } },
        max_output_tokens: 3000,
      }),
      signal: ctrl.signal,
    });
  } catch (e) { clearTimeout(to); throw new Error('AI request failed (timeout or network).'); }
  clearTimeout(to);
  if (!r.ok) { console.error('OpenAI error', r.status, await r.text().catch(() => '')); throw new Error('AI request failed. Check the OpenAI key / model / quota.'); }

  const data: any = await r.json();
  const content = extractResponsesText(data);
  if (!content) throw new Error('AI returned no content.');
  let p: any; try { p = JSON.parse(content); } catch { throw new Error('AI returned invalid JSON.'); }

  const tokenUpdates = (Array.isArray(p?.tokenUpdates) ? p.tokenUpdates : [])
    .filter((t: any) => t && typeof t.name === 'string' && t.name.indexOf('--') === 0 && typeof t.value === 'string')
    .slice(0, 80)
    .map((t: any) => ({ name: t.name.trim(), value: String(t.value).trim().slice(0, 120) }));
  const roleFonts = (Array.isArray(p?.roleFonts) ? p.roleFonts : [])
    .filter((t: any) => t && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'Body', 'Buttons', 'Nav'].includes(t.role) && typeof t.font === 'string')
    .slice(0, 12)
    .map((t: any) => ({ role: t.role, font: cleanFont(t.font, 'Inter') }));
  return { reply: String(p?.reply || 'Done.').slice(0, 300), tokenUpdates, roleFonts };
}
