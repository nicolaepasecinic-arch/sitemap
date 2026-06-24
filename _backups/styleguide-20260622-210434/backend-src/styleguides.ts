import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { pool } from './db';
import { requireAuth, AuthedRequest, teamRoleOf } from './auth';
import { userAcToken } from './projects';
import { fetchAcProject } from './activecollab';

/* ------------------------------------------------------------------ */
/*  Style Guides module — UI tab "Style Guides". A style guide is a     */
/*  self-contained design-system document (one HTML doc with a token    */
/*  layer: colours, typography, spacing, brand, forms, components).     */
/*  Mirrors the Sitemap projects model (CRUD + status + sharing +       */
/*  Active Collab) and is available to all team roles. AC assignment    */
/*  is PM-only, matching the rest of the app.                           */
/* ------------------------------------------------------------------ */

export const styleGuidesRouter = Router();

// Public, no-login read-only access for share links (#/styleguides/view/<id>).
// Mounted before the authed router so /api/styleguides/public/:id isn't gated.
export const styleGuidesPublicRouter = Router();
styleGuidesPublicRouter.get('/:id', async (req, res: Response) => {
  const { rows } = await pool.query('SELECT id, name, content FROM style_guides WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Style guide not found' });
  res.json({ id: rows[0].id, name: rows[0].name, content: rows[0].content || '' });
});

styleGuidesRouter.use(requireAuth);

/* Default content for a new style guide: the bundled design-system template.
   Resolved across dev (src) and prod (dist) layouts, then cached in memory. */
// Remove the big hero/cover header from the bundled template (per design: no hero block).
function stripHero(html: string): string {
  const i = html.indexOf('<header class="cover"');
  if (i < 0) return html;
  const end = html.indexOf('</header>', i);
  if (end < 0) return html;
  return html.slice(0, i) + html.slice(end + '</header>'.length);
}

// Remove the redundant bottom "SSA / Design System · One source of truth" footer.
function stripFooter(html: string): string {
  const i = html.indexOf('<footer class="ds-foot"');
  if (i < 0) return html;
  const end = html.indexOf('</footer>', i);
  if (end < 0) return html;
  return html.slice(0, i) + html.slice(end + '</footer>'.length);
}

// Add a "Font Families" card to the Typography section (heading + body), so a style guide
// can show MULTIPLE fonts and say where each is used. The .fam class wires the editor's
// Google-Fonts picker + "Apply to H1…Nav" role checkboxes; duplicate a card to add fonts.
function addFontFamilies(html: string): string {
  if (/class="(families|fam)"/.test(html)) return html;       // already present
  const ti = html.indexOf('id="typography"') >= 0 ? html.indexOf('id="typography"') : html.indexOf('id="type"');
  if (ti < 0) return html;
  const si = html.indexOf('<div class="specimen"', ti);
  if (si < 0) return html;
  const card = (famVar: string, label: string, where: string) =>
    '<div class="col" style="flex:1;min-width:240px;border:1px solid rgba(0,0,0,.08);border-radius:var(--radius-card);padding:24px;">'
    + `<div class="fam" style="font-family:var(${famVar});font-size:40px;line-height:1.1;color:var(--color-brand);">${label}</div>`
    + `<div class="fmeta" style="color:var(--text-muted);font-size:14px;margin-top:10px;">${where}</div>`
    + '</div>';
  const block = '<div class="grid-label" style="font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted);margin:8px 0 12px;">Font Families</div>'
    + '<div class="families" style="display:flex;gap:20px;flex-wrap:wrap;margin:0 0 32px;">'
    + card('--font-heading', 'Heading', 'H1 · H2 · H3 — Display / Headings')
    + card('--font-body', 'Body', 'H4 · H5 · H6 · Body · Buttons · Nav')
    + '</div>';
  return html.slice(0, si) + block + html.slice(si);
}

// Our default brand mark (Qoders star) as an SVG data URL, used in place of the SSA logo.
const OUR_LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">'
  + '<circle cx="12" cy="12" r="12" fill="#FDE7E4"/>'
  + '<rect x="10.8" y="4" width="2.4" height="16" rx="1.2" fill="#EF3B2D"/>'
  + '<rect x="10.8" y="4" width="2.4" height="16" rx="1.2" fill="#EF3B2D" transform="rotate(60 12 12)"/>'
  + '<rect x="10.8" y="4" width="2.4" height="16" rx="1.2" fill="#EF3B2D" transform="rotate(120 12 12)"/></svg>';
const OUR_LOGO_URL = 'data:image/svg+xml;base64,' + Buffer.from(OUR_LOGO_SVG).toString('base64');
function replaceLogos(html: string): string {
  // every SSA logo (incl. the unclassed showcase imgs) is an SVG data URL whose payload
  // starts with "<svg width=" → base64 "PHN2ZyB3aWR0aD0i". Swap them all for our mark.
  return html.replace(/(src=")data:image\/svg\+xml;base64,PHN2ZyB3aWR0aD0i[^"]*(")/g, `$1${OUR_LOGO_URL}$2`);
}

// Footer should be a soft LIGHT-blue panel with dark text by default (not a dark/grey slab).
function recolorFooter(html: string): string {
  return html
    .replace(/--footer-bg:\s*var\(--color-brand\)/i, '--footer-bg: #EEF4FF')
    .replace(/--footer-text:\s*#FFFFFF/i, '--footer-text: var(--color-brand)');
}

// Swatch names must describe the ROLE, not the colour (the colour is editable), so a
// label never contradicts the actual hex once it's changed.
function relabelSwatches(html: string): string {
  const map: Record<string, string> = {
    '<div class="nm">Brand Plum</div>': '<div class="nm">Brand Color</div>',
    '<div class="nm">Accent Orange</div>': '<div class="nm">Accent Color</div>',
    '<div class="nm">Light Lavender</div>': '<div class="nm">Surface Alt</div>',
    '<div class="nm">Warm Cream</div>': '<div class="nm">Surface Card</div>',
    '<div class="nm">White</div>': '<div class="nm">Surface Page</div>',
    '<div class="nm">Muted Gray</div>': '<div class="nm">Muted</div>',
  };
  let out = html;
  for (const [from, to] of Object.entries(map)) out = out.split(from).join(to);
  return out;
}

let TEMPLATE_CACHE: string | null = null;
const CACHE_TEMPLATE = process.env.NODE_ENV === 'production'; // dev: re-read so edits apply live
export function defaultStyleGuideHtml(): string {
  if (CACHE_TEMPLATE && TEMPLATE_CACHE != null) return TEMPLATE_CACHE;
  const candidates = [
    path.join(__dirname, 'styleguide-template.html'),
    path.join(__dirname, '..', 'src', 'styleguide-template.html'),
    path.join(process.cwd(), 'src', 'styleguide-template.html'),
    path.join(process.cwd(), 'backend', 'src', 'styleguide-template.html'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) { TEMPLATE_CACHE = addFontFamilies(replaceLogos(recolorFooter(relabelSwatches(stripFooter(stripHero(fs.readFileSync(p, 'utf8'))))))); return TEMPLATE_CACHE; }
    } catch (e) { /* try next */ }
  }
  TEMPLATE_CACHE = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Style Guide</title></head><body></body></html>';
  return TEMPLATE_CACHE;
}

// Build a style-guide document from AI-extracted tokens by substituting the template's
// default colours/fonts (and loading the fonts from Google Fonts). Returns clean HTML.
export type SgBuildTokens = {
  brandName?: string;
  about?: string;
  colors?: { brand?: string; accent?: string; surfaceAlt?: string; surfaceCard?: string; surfacePage?: string; muted?: string };
  headingFont?: string;
  bodyFont?: string;
  type?: { h1?: string; h2?: string; h3?: string; h4?: string; h5?: string; h6?: string; bodyLg?: string; bodySm?: string; caption?: string };
  lineHeights?: { heading?: string; body?: string };
  letterSpacing?: { heading?: string; body?: string };
  radii?: { card?: string; button?: string; input?: string; tag?: string };
  spacing?: { sectionY?: string; sectionYTablet?: string; sectionYMobile?: string; containerWidth?: string; containerPadding?: string };
  copy?: { h1?: string; h2?: string; h3?: string; h4?: string; h5?: string; h6?: string; eyebrow?: string; muted?: string };
};
export function buildStyleGuideFromTokens(t: SgBuildTokens): string {
  let html = defaultStyleGuideHtml();
  const c = t.colors || {};
  // Read the template's CURRENT default hex for each role from :root (the template palette
  // can change), then globally swap that hex → the new value. A global swap updates the
  // :root token (so var()-based swatches change) AND any literal hex (data-copy/.hx text).
  const tokenDefault = (name: string): string => {
    const m = html.match(new RegExp(name.replace(/-/g, '\\-') + '\\s*:\\s*(#[0-9a-fA-F]{6})', 'i'));
    return m ? m[1] : '';
  };
  const defs: Array<[string, string | undefined]> = [
    [tokenDefault('--color-brand'), c.brand],
    [tokenDefault('--color-accent'), c.accent],
    [tokenDefault('--color-bg-light') || tokenDefault('--color-surface-alt'), c.surfaceAlt],
    [tokenDefault('--color-warm') || tokenDefault('--color-surface-card'), c.surfaceCard],
    [tokenDefault('--color-muted'), c.muted],
    [tokenDefault('--color-white') || tokenDefault('--color-surface-page'), c.surfacePage],
  ];
  for (const [from, to] of defs) {
    if (!from || !to || !/^#[0-9a-fA-F]{6}$/.test(to)) continue;
    if (from.toUpperCase() === '#FFFFFF') continue;       // never global-replace white
    if (from.toUpperCase() === to.toUpperCase()) continue;
    const v = to.toUpperCase();
    html = html.split(from.toLowerCase()).join(v).split(from.toUpperCase()).join(v).split(from).join(v);
  }
  // Generic: set a :root design-token's VALUE (first occurrence = base) so everything that
  // uses var(--token) reflects it. Works regardless of which tokens the template defines.
  const setRootToken = (name: string, value: string) => {
    if (!value) return;
    const re = new RegExp('(' + name.replace(/-/g, '\\-') + '\\s*:\\s*)([^;]+)(;)');
    if (re.test(html)) html = html.replace(re, `$1${value}$3`);
  };

  // Footer: a soft LIGHT tint of the accent with dark text (instead of a dark/grey slab) —
  // matches the light-blue look we want by default and adapts to the brand's accent on generate.
  const tint = (hex: string, ratio: number): string => {
    const h = String(hex || '').replace('#', ''); if (h.length !== 6) return '';
    const n = parseInt(h, 16); const mix = (x: number) => Math.round(x + (255 - x) * ratio);
    const to2 = (x: number) => ('0' + x.toString(16)).slice(-2);
    return ('#' + to2(mix((n >> 16) & 255)) + to2(mix((n >> 8) & 255)) + to2(mix(n & 255))).toUpperCase();
  };
  const footerTint = tint(c.accent || '#2563EB', 0.9) || '#EEF4FF';
  setRootToken('--footer-bg', footerTint);
  setRootToken('--footer-text', c.brand && /^#[0-9a-fA-F]{6}$/.test(c.brand) ? c.brand : '#1F2937');

  // fonts: set both possible token names, update the "Font Families" card labels, load from GF
  const heading = (t.headingFont || '').replace(/["']/g, '').trim();
  const body = (t.bodyFont || '').replace(/["']/g, '').trim();
  if (heading) { setRootToken('--font-heading', `"${heading}", ui-serif, Georgia, serif`); setRootToken('--font-serif', `"${heading}", ui-serif, Georgia, serif`); }
  if (body) { setRootToken('--font-body', `"${body}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`); setRootToken('--font-sans', `"${body}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`); }
  // the two .fam cards: 1st = heading font name, 2nd = body font name (says which font where)
  if (heading || body) {
    let n = 0;
    html = html.replace(/(<div class="fam"[^>]*>)([^<]*)(<\/div>)/g, (m, a, _txt, z) => {
      n += 1;
      const name = n === 1 ? (heading || _txt) : n === 2 ? (body || _txt) : _txt;
      return a + name + z;
    });
  }
  const fams = [heading, body].filter(Boolean).filter((f, i, a) => a.indexOf(f) === i)
    .filter((f) => GOOGLE_FONTS.has(f.toLowerCase())) // only real Google Fonts → no 404 links
    .map((f) => 'family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@300;400;500;600;700;800');
  if (fams.length) {
    const link = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap">`;
    html = html.indexOf('</head>') !== -1 ? html.replace('</head>', link + '</head>') : link + html;
  }

  // type scale + line-heights + letter-spacing + radii + spacing → set the real token values
  const ty = t.type || {}; const lh = t.lineHeights || {}; const ls = t.letterSpacing || {}; const rd = t.radii || {}; const sp = t.spacing || {};
  setRootToken('--text-h1', ty.h1 || ''); setRootToken('--text-h2', ty.h2 || ''); setRootToken('--text-h3', ty.h3 || '');
  setRootToken('--text-h4', ty.h4 || ''); setRootToken('--text-h5', ty.h5 || ''); setRootToken('--text-h6', ty.h6 || '');
  setRootToken('--text-body-lg', ty.bodyLg || ''); setRootToken('--text-body-sm', ty.bodySm || ''); setRootToken('--text-caption', ty.caption || '');
  setRootToken('--lh-heading', lh.heading || ''); setRootToken('--lh-body', lh.body || '');
  setRootToken('--ls-heading', ls.heading || ''); setRootToken('--ls-body', ls.body || '');
  setRootToken('--radius-card', rd.card || ''); setRootToken('--radius-image', rd.card || '');
  setRootToken('--radius-button', rd.button || ''); setRootToken('--radius-input', rd.input || ''); setRootToken('--radius-icon-btn', rd.input || '');
  setRootToken('--radius-tag', rd.tag || '');
  setRootToken('--section-padding-y', sp.sectionY || ''); setRootToken('--section-padding-y-t', sp.sectionYTablet || ''); setRootToken('--section-padding-y-m', sp.sectionYMobile || '');
  setRootToken('--container-max-width', sp.containerWidth || ''); setRootToken('--container-padding-x', sp.containerPadding || '');

  // keep the visible type-scale ".spec" labels in sync with the new sizes/line-heights
  const lhPctHead = Math.round((parseFloat(lh.heading || '1.15') || 1.15) * 100);
  const lhPctBody = Math.round((parseFloat(lh.body || '1.6') || 1.6) * 100);
  const specMap: Array<[string, string, number]> = [
    ['H1', ty.h1 || '', lhPctHead], ['H2', ty.h2 || '', lhPctHead], ['H3', ty.h3 || '', lhPctHead], ['H4', ty.h4 || '', lhPctHead],
    ['H5 / Body LG', ty.bodyLg || ty.h5 || '', lhPctBody], ['H6 / Body SM', ty.bodySm || ty.h6 || '', lhPctBody],
  ];
  for (const [tag, size, pct] of specMap) {
    if (!size) continue;
    const re = new RegExp('(<span class="tag">' + tag.replace(/[/]/g, '\\/') + '<\\/span>[\\s\\S]*?<span class="spec"[^>]*>)([^<]*)(<\\/span>)');
    html = html.replace(re, `$1${size} · lh ${pct}%$3`);
  }
  if (t.brandName) {
    const safe = String(t.brandName).replace(/[<>]/g, '').slice(0, 80);
    html = /<title>[^<]*<\/title>/i.test(html) ? html.replace(/<title>[^<]*<\/title>/i, `<title>${safe} — Design System</title>`) : html;
    // text personalization: the template's brand mentions become the content brand.
    html = html.split('SSA Group').join(safe).replace(/\bSSA\b/g, safe);
  }
  // typography specimen copy — rewrite the sample headlines/body in the brand's voice
  if (t.copy) {
    const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const repl: Array<[string, string | undefined]> = [
      ['Hospitality, Unleashed.', t.copy.h1],
      ['Trusted by leading cultural attractions', t.copy.h2],
      ['We provide full hospitality services through One Revenue Strategy', t.copy.h3],
      ['Hospitality at Scale', t.copy.h4],
      ['We partner with leading cultural attractions to create meaningful memories.', t.copy.h5],
      ['From admissions and membership to dining, retail, events, and technology.', t.copy.h6],
      ['Partner Spotlight', t.copy.eyebrow],
      ['Supporting information, captions, metadata, secondary descriptions.', t.copy.muted],
    ];
    for (const [from, to] of repl) if (to) html = html.split(from).join(esc(to));
  }
  return html;
}

// Extract a small live preview (a few brand colours + a font) from a guide's HTML content,
// so the dashboard cards can show the real palette/typography instead of a generic icon.
function hexRgb(h: string): [number, number, number] {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function isBrandColor([r, g, b]: [number, number, number]): boolean {
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  const lum = (r + g + b) / 3;
  return sat > 22 && lum > 16 && lum < 244; // skip near-grays / pure black / pure white
}
// resolve a real font-family name from the content (resolves var(...) refs, skips generics)
function fontFromContent(htmlRaw: string): string {
  // decode the HTML entities the editor writes for quotes (&quot;, &#34;, &apos;, &#39;)
  // so a value like font-family:&quot;Inter&quot; parses cleanly instead of yielding "&quot".
  const html = String(htmlRaw)
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, '&');
  const candidates: string[] = [];
  for (const m of html.matchAll(/font-family[^:]*:\s*([^;"'}]+)/gi)) candidates.push(m[1]);
  for (const m of html.matchAll(/--[a-z0-9-]*font[a-z0-9-]*:\s*([^;"'}]+)/gi)) candidates.push(m[1]);
  const generic = /^(var\(|inherit|initial|unset|sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|-apple-system)$/i;
  for (let v of candidates) {
    v = v.trim();
    if (/^var\(/i.test(v)) {
      const vm = v.match(/var\(\s*(--[a-z0-9-]+)/i);
      if (!vm) continue;
      const dm = html.match(new RegExp(vm[1].replace(/-/g, '\\-') + '\\s*:\\s*([^;"\'}]+)'));
      if (!dm) continue;
      v = dm[1].trim();
    }
    const fam = (v.split(',')[0] || '').replace(/['"]/g, '').trim();
    if (fam && !generic.test(fam)) return fam;
  }
  // fallback: a Google Fonts <link> reveals the loaded family
  const gf = html.match(/fonts\.googleapis\.com\/css2?\?[^"']*family=([^&":'\s]+)/i);
  if (gf) return decodeURIComponent(gf[1].split(':')[0]).replace(/\+/g, ' ').trim();
  return '';
}
// resolve the effective design-token colours: stylesheet :root defs, then inline
// <html style="--color-…"> overrides (what the editor writes when you change a colour).
function colorTokens(html: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of html.matchAll(/(--color-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/gi)) map[m[1].toLowerCase()] = m[2];
  const hm = html.match(/<html[^>]*\sstyle\s*=\s*"([^"]*)"/i);
  if (hm) for (const m of hm[1].matchAll(/(--color-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/gi)) map[m[1].toLowerCase()] = m[2];
  return map;
}
// The brand palette swatches (.sw tiles) carry the authoritative colour in their
// data-copy="#hex" attribute, in display order. The editor updates these (and the .hx
// label) when a colour is changed, but does NOT rewrite the :root --color-* vars — so
// the swatches, not the CSS variables, are the source of truth for the live palette.
function swatchColors(html: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // ordered swatch tiles
  for (const m of html.matchAll(/class="sw"[^>]*\bdata-copy="(#[0-9a-fA-F]{6})"/gi)) {
    const hex = m[1].toLowerCase();
    if (!seen.has(hex)) { seen.add(hex); out.push(hex); }
  }
  // fallback: data-copy hexes anywhere (attribute order can vary), else .hx label text
  if (!out.length) {
    for (const m of html.matchAll(/\bdata-copy="(#[0-9a-fA-F]{6})"/gi)) {
      const hex = m[1].toLowerCase();
      if (!seen.has(hex)) { seen.add(hex); out.push(hex); }
    }
  }
  if (!out.length) {
    for (const m of html.matchAll(/class="hx"[^>]*>\s*(#[0-9a-fA-F]{6})/gi)) {
      const hex = m[1].toLowerCase();
      if (!seen.has(hex)) { seen.add(hex); out.push(hex); }
    }
  }
  return out;
}
function previewFromContent(content: any): { colors: string[]; font: string } {
  const html = String(content || '');
  const font = fontFromContent(html);
  const colors: string[] = [];
  const seen = new Set<string>();
  // 1) preferred: the actual palette swatches (what the editor edits)
  for (const hex of swatchColors(html)) {
    if (!seen.has(hex)) { seen.add(hex); colors.push(hex); }
  }
  // 2) fallback: design-token CSS vars (for guides not using the swatch template)
  if (!colors.length) {
    const map = colorTokens(html);
    const order = ['--color-brand', '--color-accent', '--color-accent-dark', '--color-accent-hover', '--color-warm', '--color-bg-light', '--color-muted'];
    for (const k of order) {
      const v = map[k] && map[k].toLowerCase();
      if (v && v !== '#ffffff' && !seen.has(v)) { seen.add(v); colors.push(v); }
    }
  }
  // 3) last resort: any brand-ish hexes in the document
  if (!colors.length) {
    for (const mm of html.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const hex = mm[0].toLowerCase();
      if (seen.has(hex) || !isBrandColor(hexRgb(hex))) continue;
      seen.add(hex); colors.push(hex);
      if (colors.length >= 6) break;
    }
  }
  return { colors: colors.slice(0, 6), font };
}

// Pair each brand-palette swatch's role label (.nm) with its authoritative hex
// (data-copy). Splitting on the swatch open-tag keeps each swatch's label local.
function swatchRoles(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const chunks = html.split('class="sw"');
  for (let i = 1; i < chunks.length; i++) {
    const dc = chunks[i].match(/data-copy="(#[0-9a-fA-F]{6})"/i);
    const nm = chunks[i].match(/class="nm"[^>]*>([^<]+)/i);
    if (!dc || !nm) continue;
    const hex = dc[1].toLowerCase();
    const label = nm[1].toLowerCase();
    let role = '';
    if (label.includes('brand')) role = 'brand';
    else if (label.includes('accent')) role = 'accent';
    else if (label.includes('page')) role = 'surfacePage';
    else if (label.includes('card')) role = 'surfaceCard';
    else if (label.includes('alt')) role = 'surfaceAlt';
    else if (label.includes('muted')) role = 'muted';
    if (role && !out[role]) out[role] = hex;
  }
  return out;
}

// Common Google Fonts — only inject a webfont <link> for these, so proprietary fonts
// detected on a real site (e.g. "Sohne", "Untitled Sans") don't produce a 404 link;
// those fall back gracefully to the system stack instead.
const GOOGLE_FONTS = new Set<string>([
  'inter', 'roboto', 'open sans', 'lato', 'montserrat', 'poppins', 'raleway', 'nunito', 'nunito sans',
  'work sans', 'rubik', 'mulish', 'manrope', 'dm sans', 'dm serif display', 'dm serif text', 'karla',
  'source sans pro', 'source sans 3', 'source serif pro', 'source serif 4', 'pt sans', 'pt serif',
  'merriweather', 'playfair display', 'lora', 'noto sans', 'noto serif', 'ibm plex sans', 'ibm plex serif',
  'ibm plex mono', 'libre franklin', 'libre baskerville', 'archivo', 'archivo black', 'barlow', 'oswald',
  'bebas neue', 'josefin sans', 'quicksand', 'cabin', 'titillium web', 'fira sans', 'fira code', 'hind',
  'heebo', 'assistant', 'space grotesk', 'space mono', 'jetbrains mono', 'sora', 'epilogue', 'figtree',
  'plus jakarta sans', 'outfit', 'red hat display', 'red hat text', 'urbanist', 'lexend',
  'crimson text', 'crimson pro', 'eb garamond', 'cormorant garamond', 'spectral', 'bitter', 'arvo',
  'zilla slab', 'roboto slab', 'roboto condensed', 'roboto mono', 'overpass', 'questrial', 'comfortaa',
  'dosis', 'exo', 'exo 2', 'kanit', 'prompt', 'mukta', 'tajawal', 'cairo', 'm plus rounded 1c',
  'inconsolata', 'anton', 'teko', 'abril fatface', 'pacifico', 'caveat', 'dancing script', 'satisfy',
  'gloria hallelujah', 'permanent marker', 'shadows into light', 'lobster', 'righteous', 'fredoka',
  'baloo 2', 'chivo', 'newsreader', 'fraunces', 'instrument sans', 'instrument serif', 'unbounded',
  'schibsted grotesk', 'onest', 'bricolage grotesque', 'geist', 'geist mono', 'hanken grotesk', 'albert sans',
]);
// Ensure a Google-Fonts <link> exists for a font family (so a token-set font renders).
function ensureFontLink(html: string, family: string): string {
  const fam = (family || '').split(',')[0].replace(/["']/g, '').trim();
  if (!fam || /^(ui-|system-ui|-apple-system|sans-serif|serif|monospace|inherit|initial)/i.test(fam)) return html;
  if (!GOOGLE_FONTS.has(fam.toLowerCase())) return html; // proprietary/unknown → rely on fallback stack
  const id = 'sgfont-' + fam.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  if (html.indexOf('id="' + id + '"') >= 0 || new RegExp('family=' + fam.replace(/\s+/g, '\\+'), 'i').test(html)) return html;
  const link = `<link id="${id}" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam).replace(/%20/g, '+')}:wght@300;400;500;600;700;800&display=swap">`;
  return html.indexOf('</head>') >= 0 ? html.replace('</head>', link + '</head>') : link + html;
}

// Apply :root design-token overrides to a guide's HTML by writing them as inline custom
// properties on the <html> element (style="--x:y;…") — exactly like the editor does, so
// every var(--token) usage picks them up. Merges with existing inline overrides; a value
// of "" removes that override. Also loads webfonts for any --font-* token set.
export function setRootTokens(content: any, tokens: Record<string, string>): string {
  let html = String(content || '');
  const existing: Record<string, string> = {};
  let pre = '', post = '', hadStyle = false;
  const m = html.match(/<html([^>]*?)\sstyle\s*=\s*"([^"]*)"([^>]*)>/i);
  if (m) {
    hadStyle = true; pre = m[1]; post = m[3];
    for (const mm of m[2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+)/gi)) existing[mm[1].toLowerCase().trim()] = mm[2].trim();
  }
  for (const [k, v] of Object.entries(tokens || {})) {
    const name = String(k).trim().toLowerCase();
    if (!/^--[a-z0-9-]+$/.test(name)) continue;
    const val = String(v == null ? '' : v).trim().replace(/[;"]/g, '');
    if (val === '') delete existing[name]; else existing[name] = val;
    if ((name === '--font-heading' || name === '--font-body') && val) html = ensureFontLink(html, val);
  }
  const styleStr = Object.entries(existing).map(([k, v]) => `${k}:${v}`).join(';');
  if (hadStyle) return html.replace(/<html[^>]*>/i, `<html${pre} style="${styleStr}"${post}>`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html([^>]*)>/i, `<html$1 style="${styleStr}">`);
  return html;
}

// Extract the design-system stylesheet from a guide: all <style> blocks + the live :root
// token overrides (merged in), plus the font <link>s — a standalone head a consumer can
// drop into ANY page so it inherits the design system (tokens, base styles, components).
export function styleGuideHead(content: any): { css: string; fonts: string } {
  const html = String(content || '');
  const fonts = (html.match(/<link[^>]+fonts\.googleapis[^>]*>/gi) || []).join('\n');
  let css = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [])
    .map((s) => s.replace(/<\/?style[^>]*>/gi, '')).join('\n\n');
  const m = html.match(/<html[^>]*\sstyle\s*=\s*"([^"]*)"/i);
  if (m) {
    const ov = (m[1].match(/--[a-z0-9-]+\s*:\s*[^;]+/gi) || []).join(';');
    if (ov) css += `\n\n/* applied token overrides */\n:root{${ov}}`;
  }
  return { css, fonts };
}

// Build a complete standalone HTML page that uses the guide's design system directly:
// the guide's fonts + tokens + styles in <head>, the provided body content below.
export function buildPageFromStyleGuide(content: any, bodyHtml: string, title?: string): string {
  const { css, fonts } = styleGuideHead(content);
  const safeTitle = String(title || 'Page').replace(/[<>]/g, '').slice(0, 120);
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
    + '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + `<title>${safeTitle}</title>\n${fonts}\n<style>\n${css}\n</style>\n</head>\n<body>\n`
    + String(bodyHtml || '') + '\n</body>\n</html>\n';
}

// A structured, applyable theme: brand palette (by role), heading/body fonts and the
// type scale. Text/link/button colours are derived from these on the client.
export function themeFromContent(content: any): {
  colors: Record<string, string>;
  fonts: { heading: string; body: string };
  type: Record<string, number>;
  name: string;
} {
  const html = String(content || '');
  const tokens = parseAllTokens(html);
  const roles = swatchRoles(html);
  const ordered = swatchColors(html);
  const ord = (i: number) => ordered[i] || '';
  // The :root colour tokens are the source of truth (Properties mode edits them);
  // fall back to swatch role labels, then to swatch order, for older guides.
  const tokHex = (name: string): string => { const v = (tokens[name] || '').trim(); return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v.toLowerCase() : ''; };
  const colors = {
    brand: tokHex('--color-brand') || roles.brand || ord(0) || '#1f2937',
    accent: tokHex('--color-accent') || roles.accent || ord(1) || '#2563eb',
    surfaceAlt: tokHex('--color-surface-alt') || tokHex('--color-bg-light') || roles.surfaceAlt || ord(2) || '',
    surfaceCard: tokHex('--color-surface-card') || tokHex('--color-warm') || roles.surfaceCard || ord(3) || '',
    surfacePage: tokHex('--color-surface-page') || roles.surfacePage || ord(4) || '#FFFFFF',
    muted: tokHex('--color-muted') || roles.muted || ord(5) || '#767676',
  };
  // Read a --font-* token's first family. Done with a dedicated regex (NOT parseAllTokens)
  // because font values start with a quote ("Public Sans", …) which the generic token
  // parser excludes — so parseAllTokens returns empty for them.
  const fontVar = (name: string): string => {
    const re = new RegExp(name.replace(/-/g, '\\-') + '\\s*:\\s*([^;]+)', 'i');
    let val = '';
    const hm = html.match(/<html[^>]*\sstyle\s*=\s*"([^"]*)"/i);
    if (hm) { const m = hm[1].match(re); if (m) val = m[1]; }     // inline override wins
    if (!val) { const m = html.match(re); if (m) val = m[1]; }    // else stylesheet :root
    return (val.split(',')[0] || '').replace(/["']/g, '').trim();
  };
  const fonts = {
    heading: fontVar('--font-heading') || fontVar('--font-serif') || fontFromContent(html) || '',
    body: fontVar('--font-body') || fontVar('--font-sans') || fontVar('--font-heading') || fontFromContent(html) || '',
  };
  // Desktop type scale: prefer the inline <html style> override (what Properties mode writes
  // at root scope), else the FIRST :root occurrence — i.e. the base value, NOT the smaller
  // sizes that @media query blocks override later in the document.
  const baseTextPx = (name: string): number => {
    const re = new RegExp(name.replace(/-/g, '\\-') + '\\s*:\\s*([0-9.]+)\\s*px', 'i');
    const hm = html.match(/<html[^>]*\sstyle\s*=\s*"([^"]*)"/i);
    if (hm) { const m = hm[1].match(re); if (m) return Math.round(parseFloat(m[1])); }
    const m = html.match(re);
    return m ? Math.round(parseFloat(m[1])) : 0;
  };
  const type = {
    h1: baseTextPx('--text-h1'), h2: baseTextPx('--text-h2'), h3: baseTextPx('--text-h3'),
    h4: baseTextPx('--text-h4'), h5: baseTextPx('--text-h5'), h6: baseTextPx('--text-h6'),
    bodyLg: baseTextPx('--text-body-lg') || 18, bodySm: baseTextPx('--text-body-sm') || 16,
    caption: baseTextPx('--text-caption') || 14,
  };
  return { colors, fonts, type, name: '' };
}

// shape returned to the frontend (camelCase, epoch millis). 'content' is omitted from
// list responses (large) and only included on a single get.
const toApi = (r: any, withContent = false) => ({
  id: r.id,
  name: r.name,
  ...(withContent ? { content: r.content || '' } : {}),
  preview: previewFromContent(r.content),
  settings: r.settings || {},
  archived: r.archived,
  completed: r.completed,
  role: r.role || 'owner',                 // owner | editor | viewer (this user's access)
  shared: r.role && r.role !== 'owner',    // true if it's someone else's guide shared with you
  acProjectId: r.ac_project_id || '',      // linked Active Collab project
  acProjectName: r.ac_project_name || '',
  createdAt: new Date(r.created_at).getTime(),
  updatedAt: new Date(r.updated_at).getTime(),
});

// All CSS custom properties (design tokens) defined in the content: stylesheet :root
// defs plus inline <html style="--…"> overrides (what the editor writes). For the assistant.
export function parseAllTokens(content: any): Record<string, string> {
  const html = String(content || '');
  const map: Record<string, string> = {};
  for (const m of html.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;"'}]+)/gi)) map[m[1].toLowerCase()] = m[2].trim();
  const hm = html.match(/<html[^>]*\sstyle\s*=\s*"([^"]*)"/i);
  if (hm) for (const m of hm[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;"']+)/gi)) map[m[1].toLowerCase()] = m[2].trim();
  return map;
}

// This user's access role for a style guide: 'owner' | 'pm' | 'editor' | 'viewer' | null.
// Team co-membership (owner and this user share a team, this user is PM) grants PM-wide access.
export async function accessRole(id: string, userId: string): Promise<string | null> {
  const owned = await pool.query('SELECT 1 FROM style_guides WHERE id = $1 AND user_id = $2', [id, userId]);
  if (owned.rows[0]) return 'owner';
  const member = await pool.query('SELECT role FROM style_guide_members WHERE style_guide_id = $1 AND user_id = $2', [id, userId]);
  if (member.rows[0]?.role) return member.rows[0].role;
  const team = await pool.query(
    `SELECT mine.role
       FROM style_guides s
       JOIN team_members owner_m ON owner_m.user_id = s.user_id
       JOIN team_members mine ON mine.team_id = owner_m.team_id AND mine.user_id = $2
      WHERE s.id = $1 AND mine.role = 'pm'
      LIMIT 1`,
    [id, userId]
  );
  return team.rows[0]?.role || null;
}

// GET /api/styleguides — guides this user owns OR is a member of OR team-wide (PM). No content.
styleGuidesRouter.get('/', async (req: AuthedRequest, res: Response) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.content, s.settings, s.archived, s.completed, s.ac_project_id, s.ac_project_name,
            s.created_at, s.updated_at, s.user_id,
       CASE WHEN s.user_id = $1 THEN 'owner'
            WHEN m.role IS NOT NULL THEN m.role
            ELSE (SELECT mine.role FROM team_members om JOIN team_members mine ON mine.team_id = om.team_id AND mine.user_id = $1 WHERE om.user_id = s.user_id AND mine.role = 'pm' LIMIT 1)
       END AS role
     FROM style_guides s
     LEFT JOIN style_guide_members m ON m.style_guide_id = s.id AND m.user_id = $1
     WHERE s.user_id = $1 OR m.user_id = $1
        OR EXISTS (SELECT 1 FROM team_members om JOIN team_members mine ON mine.team_id = om.team_id AND mine.user_id = $1 WHERE om.user_id = s.user_id AND mine.role = 'pm')
     ORDER BY s.updated_at DESC`,
    [req.userId]
  );
  res.json(rows.map((r) => toApi(r)));
});

// GET /api/styleguides/:id — full record including content
styleGuidesRouter.get('/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Style guide not found' });
  const { rows } = await pool.query('SELECT * FROM style_guides WHERE id = $1', [req.params.id]);
  res.json(toApi({ ...rows[0], role }, true));
});

// GET /api/styleguides/:id/theme — structured, applyable design tokens (brand palette,
// fonts, type scale) extracted from the guide. Used by the Design editor's "Apply".
styleGuidesRouter.get('/:id/theme', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Style guide not found' });
  const { rows } = await pool.query('SELECT name, content FROM style_guides WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Style guide not found' });
  const theme = themeFromContent(rows[0].content);
  theme.name = rows[0].name || '';
  res.json(theme);
});

// POST /api/styleguides/activecollab/verify  { acProjectId } — verify an EXISTING Active
// Collab project by id and return its id + name. Does not persist. PM-only.
styleGuidesRouter.post('/activecollab/verify', async (req: AuthedRequest, res: Response) => {
  if ((await teamRoleOf(req.userId!)).role !== 'pm') return res.status(403).json({ error: 'Only PM can assign an Active Collab project.' });
  const raw = String(req.body?.acProjectId || '').trim();
  if (!raw) return res.json({ acProjectId: '', acProjectName: '' });
  const acToken = await userAcToken(req.userId!);
  try {
    const info = await fetchAcProject(acToken, raw);
    res.json({ acProjectId: info.id, acProjectName: info.name });
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

// POST /api/styleguides — create (owned by the requester). Seeds the design-system template
// unless explicit content is provided. Accepts an optional verified Active Collab link.
styleGuidesRouter.post('/', async (req: AuthedRequest, res: Response) => {
  const {
    name = 'Untitled style guide',
    content,
    settings = {},
    acProjectId = '',
    acProjectName = '',
  } = req.body || {};
  const html = typeof content === 'string' && content.length ? content : defaultStyleGuideHtml();
  const { rows } = await pool.query(
    `INSERT INTO style_guides (user_id, name, content, settings, ac_project_id, ac_project_name)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.userId, name, html, JSON.stringify(settings), String(acProjectId || ''), String(acProjectName || '')]
  );
  await pool.query('INSERT INTO style_guide_versions (style_guide_id, label, content) VALUES ($1, $2, $3)', [rows[0].id, 'v1', html]);
  res.status(201).json(toApi(rows[0], true));
});

// PATCH /api/styleguides/:id — owner or editor. Updates name/content/settings/status.
styleGuidesRouter.patch('/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Style guide not found' });
  if (role === 'viewer') return res.status(403).json({ error: 'You have view-only access to this style guide' });

  const allowed = ['name', 'content', 'settings', 'archived', 'completed'];
  const jsonCols = ['settings'];
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const key of allowed) {
    if (key in (req.body || {})) {
      sets.push(`${key} = $${i}`);
      vals.push(jsonCols.includes(key) ? JSON.stringify(req.body[key]) : req.body[key]);
      i++;
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  sets.push('updated_at = now()');
  vals.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE style_guides SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  res.json(toApi({ ...rows[0], role }, true));
});

// GET /api/styleguides/:id/export — download the design-system HTML document
styleGuidesRouter.get('/:id/export', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Style guide not found' });
  const { rows } = await pool.query('SELECT name, content FROM style_guides WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Style guide not found' });
  const safe = String(rows[0].name || 'style-guide').replace(/[^a-z0-9_\- ]/gi, '').trim() || 'style-guide';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}.html"`);
  res.send(rows[0].content || '');
});

// POST /api/styleguides/:id/activecollab  { acProjectId } — verify against Active Collab and
// save id + name. Empty acProjectId clears the link. PM-only.
styleGuidesRouter.post('/:id/activecollab', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Style guide not found' });
  if ((await teamRoleOf(req.userId!)).role !== 'pm') return res.status(403).json({ error: 'Only PM can assign an Active Collab project.' });
  const raw = String(req.body?.acProjectId || '').trim();
  if (!raw) {
    const { rows } = await pool.query(
      `UPDATE style_guides SET ac_project_id = '', ac_project_name = '', updated_at = now() WHERE id = $1 RETURNING *`, [req.params.id]);
    return res.json(toApi({ ...rows[0], role }, true));
  }
  const acToken = await userAcToken(req.userId!);
  let info;
  try { info = await fetchAcProject(acToken, raw); }
  catch (e) { return res.status(400).json({ error: (e as Error).message }); }
  const { rows } = await pool.query(
    `UPDATE style_guides SET ac_project_id = $1, ac_project_name = $2, updated_at = now() WHERE id = $3 RETURNING *`,
    [info.id, info.name, req.params.id]);
  res.json(toApi({ ...rows[0], role }, true));
});

// POST /api/styleguides/:id/duplicate — anyone with access; copy is owned by the requester
styleGuidesRouter.post('/:id/duplicate', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Style guide not found' });
  const { rows: src } = await pool.query('SELECT * FROM style_guides WHERE id = $1', [req.params.id]);
  const s = src[0];
  const { rows } = await pool.query(
    `INSERT INTO style_guides (user_id, name, content, settings)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.userId, `${s.name} copy`, s.content, JSON.stringify(s.settings)]
  );
  await pool.query('INSERT INTO style_guide_versions (style_guide_id, label, content) VALUES ($1, $2, $3)', [rows[0].id, 'v1', s.content]);
  res.status(201).json(toApi(rows[0], true));
});

// DELETE /api/styleguides/:id — owner deletes; members just leave
styleGuidesRouter.delete('/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Style guide not found' });
  if (role === 'owner') {
    await pool.query('DELETE FROM style_guides WHERE id = $1', [req.params.id]);
  } else {
    await pool.query('DELETE FROM style_guide_members WHERE style_guide_id = $1 AND user_id = $2', [req.params.id, req.userId]);
  }
  res.status(204).end();
});

/* ----------------------------- versions ----------------------------- */

const versionToApi = (r: any, withContent = false) => ({
  id: r.id, label: r.label,
  ...(withContent ? { content: r.content || '' } : {}),
  createdAt: new Date(r.created_at).getTime(),
});

// next "vN" label for a guide (max existing numeric + 1)
async function nextVersionLabel(styleGuideId: string): Promise<string> {
  const { rows } = await pool.query('SELECT label FROM style_guide_versions WHERE style_guide_id = $1', [styleGuideId]);
  let max = 0;
  for (const r of rows) { const m = String(r.label || '').match(/(\d+)/); if (m) max = Math.max(max, parseInt(m[1], 10)); }
  return 'v' + (max + 1);
}

// resolve the parent guide id for a version
async function guideOfVersion(vid: string): Promise<string | null> {
  const { rows } = await pool.query('SELECT style_guide_id FROM style_guide_versions WHERE id = $1', [vid]);
  return rows[0]?.style_guide_id || null;
}

// GET /api/styleguides/:id/versions — list (no content), oldest first
styleGuidesRouter.get('/:id/versions', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Style guide not found' });
  const { rows } = await pool.query('SELECT id, label, created_at FROM style_guide_versions WHERE style_guide_id = $1 ORDER BY created_at ASC', [req.params.id]);
  res.json(rows.map((r) => versionToApi(r)));
});

// POST /api/styleguides/:id/versions { content? } — create a new version (copy current if omitted)
styleGuidesRouter.post('/:id/versions', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Style guide not found' });
  if (role === 'viewer') return res.status(403).json({ error: 'You have view-only access to this style guide' });
  let content = typeof req.body?.content === 'string' ? req.body.content : null;
  if (content == null) {
    const { rows } = await pool.query('SELECT content FROM style_guide_versions WHERE style_guide_id = $1 ORDER BY created_at DESC LIMIT 1', [req.params.id]);
    content = rows[0]?.content || '';
  }
  const label = await nextVersionLabel(req.params.id);
  const { rows } = await pool.query(
    'INSERT INTO style_guide_versions (style_guide_id, label, content) VALUES ($1, $2, $3) RETURNING *',
    [req.params.id, label, content]
  );
  await pool.query('UPDATE style_guides SET content = $1, updated_at = now() WHERE id = $2', [content, req.params.id]);
  res.status(201).json(versionToApi(rows[0], true));
});

// GET /api/styleguides/versions/:vid — one version with content
styleGuidesRouter.get('/versions/:vid', async (req: AuthedRequest, res: Response) => {
  const gid = await guideOfVersion(req.params.vid);
  if (!gid || !(await accessRole(gid, req.userId!))) return res.status(404).json({ error: 'Version not found' });
  const { rows } = await pool.query('SELECT * FROM style_guide_versions WHERE id = $1', [req.params.vid]);
  res.json(versionToApi(rows[0], true));
});

// PATCH /api/styleguides/versions/:vid { content } — save into a version
styleGuidesRouter.patch('/versions/:vid', async (req: AuthedRequest, res: Response) => {
  const gid = await guideOfVersion(req.params.vid);
  if (!gid) return res.status(404).json({ error: 'Version not found' });
  const role = await accessRole(gid, req.userId!);
  if (!role) return res.status(404).json({ error: 'Version not found' });
  if (role === 'viewer') return res.status(403).json({ error: 'You have view-only access to this style guide' });
  const content = String(req.body?.content ?? '');
  const { rows } = await pool.query('UPDATE style_guide_versions SET content = $1 WHERE id = $2 RETURNING *', [content, req.params.vid]);
  // mirror into the guide so dashboard preview reflects the latest edit
  await pool.query('UPDATE style_guides SET content = $1, updated_at = now() WHERE id = $2', [content, gid]);
  res.json(versionToApi(rows[0], true));
});

// DELETE /api/styleguides/versions/:vid — delete a version (never the last one)
styleGuidesRouter.delete('/versions/:vid', async (req: AuthedRequest, res: Response) => {
  const gid = await guideOfVersion(req.params.vid);
  if (!gid) return res.status(404).json({ error: 'Version not found' });
  const role = await accessRole(gid, req.userId!);
  if (!role) return res.status(404).json({ error: 'Version not found' });
  if (role === 'viewer') return res.status(403).json({ error: 'You have view-only access to this style guide' });
  const { rows: cnt } = await pool.query('SELECT COUNT(*)::int AS n FROM style_guide_versions WHERE style_guide_id = $1', [gid]);
  if ((cnt[0]?.n || 0) <= 1) return res.status(400).json({ error: 'A style guide must keep at least one version.' });
  await pool.query('DELETE FROM style_guide_versions WHERE id = $1', [req.params.vid]);
  // keep the guide's mirrored content pointing at the latest remaining version
  const { rows: latest } = await pool.query('SELECT content FROM style_guide_versions WHERE style_guide_id = $1 ORDER BY created_at DESC LIMIT 1', [gid]);
  if (latest[0]) await pool.query('UPDATE style_guides SET content = $1, updated_at = now() WHERE id = $2', [latest[0].content, gid]);
  res.status(204).end();
});

/* ----------------------------- sharing ----------------------------- */

// GET /api/styleguides/:id/members — owner + shared users + pending invites
styleGuidesRouter.get('/:id/members', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Style guide not found' });
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email, 'owner' AS role, false AS pending
       FROM style_guides s JOIN users u ON u.id = s.user_id WHERE s.id = $1
     UNION ALL
     SELECT u.id AS user_id, u.name, u.email, m.role, false AS pending
       FROM style_guide_members m JOIN users u ON u.id = m.user_id WHERE m.style_guide_id = $1
     UNION ALL
     SELECT NULL AS user_id, i.email AS name, i.email, i.role, true AS pending
       FROM style_guide_invites i WHERE i.style_guide_id = $1`,
    [req.params.id]
  );
  res.json(rows.map((r) => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role, pending: r.pending })));
});

// POST /api/styleguides/:id/members  { email, role } — owner only
styleGuidesRouter.post('/:id/members', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can share this style guide' });
  const { email, role: memberRole = 'editor' } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const r = ['editor', 'viewer'].includes(memberRole) ? memberRole : 'editor';

  const cleanEmail = String(email).toLowerCase().trim();
  const { rows: users } = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
  const target = users[0];

  if (!target) {
    await pool.query(
      `INSERT INTO style_guide_invites (style_guide_id, email, role) VALUES ($1, $2, $3)
       ON CONFLICT (style_guide_id, email) DO UPDATE SET role = EXCLUDED.role`,
      [req.params.id, cleanEmail, r]
    );
    return res.status(201).json({ userId: null, name: cleanEmail, email: cleanEmail, role: r, pending: true });
  }

  const { rows: owner } = await pool.query('SELECT user_id FROM style_guides WHERE id = $1', [req.params.id]);
  if (owner[0].user_id === target.id) return res.status(400).json({ error: 'That user already owns this style guide' });

  await pool.query(
    `INSERT INTO style_guide_members (style_guide_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (style_guide_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [req.params.id, target.id, r]
  );
  res.status(201).json({ userId: target.id, name: target.name, email: target.email, role: r, pending: false });
});

// DELETE /api/styleguides/:id/members/:userId — owner only
styleGuidesRouter.delete('/:id/members/:userId', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can manage sharing' });
  await pool.query('DELETE FROM style_guide_members WHERE style_guide_id = $1 AND user_id = $2', [req.params.id, req.params.userId]);
  res.status(204).end();
});

// DELETE /api/styleguides/:id/invites/:email — cancel a pending invite (owner only)
styleGuidesRouter.delete('/:id/invites/:email', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can manage sharing' });
  await pool.query('DELETE FROM style_guide_invites WHERE style_guide_id = $1 AND email = $2',
    [req.params.id, decodeURIComponent(req.params.email).toLowerCase()]);
  res.status(204).end();
});
