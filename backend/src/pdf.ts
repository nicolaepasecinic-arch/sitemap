import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/* ------------------------------------------------------------------ */
/*  Board → PDF (backend, no browser). Renders the *information* of the */
/*  canvas: each Page's rich content + images, links, files and notes,  */
/*  ordered top-to-bottom, separated by a rule. Uses an embedded Inter  */
/*  TTF so Unicode (incl. Romanian diacritics) renders correctly.       */
/* ------------------------------------------------------------------ */

const COLOR: Record<string, string> = {
  default: '#37352F', gray: '#787774', brown: '#976D57', red: '#D44C47',
  orange: '#CC772F', yellow: '#C29243', green: '#448361', blue: '#337EA9',
  purple: '#9065B0', pink: '#C14C8A',
};
const colorOf = (c?: string) => (!c || c === 'default' ? COLOR.default : (c[0] === '#' ? c : (COLOR[c] || COLOR.default)));

// font keys — set to embedded Inter when available, else the WinAnsi built-ins
let FONTS = { r: 'Helvetica', b: 'Helvetica-Bold', i: 'Helvetica-Oblique', bi: 'Helvetica-BoldOblique' };
let FONTS_EMBEDDED = false;
function registerFonts(doc: any) {
  try {
    doc.registerFont('F', require.resolve('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'));
    doc.registerFont('FB', require.resolve('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'));
    doc.registerFont('FI', require.resolve('@expo-google-fonts/inter/400Regular_Italic/Inter_400Regular_Italic.ttf'));
    doc.registerFont('FBI', require.resolve('@expo-google-fonts/inter/700Bold_Italic/Inter_700Bold_Italic.ttf'));
    FONTS = { r: 'F', b: 'FB', i: 'FI', bi: 'FBI' };
    FONTS_EMBEDDED = true;
  } catch (e) {
    FONTS = { r: 'Helvetica', b: 'Helvetica-Bold', i: 'Helvetica-Oblique', bi: 'Helvetica-BoldOblique' };
    FONTS_EMBEDDED = false;
  }
}

const fontFor = (s: any = {}) => (s.bold && s.italic ? FONTS.bi : s.bold ? FONTS.b : s.italic ? FONTS.i : FONTS.r);

// strip emoji / pictographs / shapes that no text font renders (would show as boxes/garbage)
const EMOJI_RE = /[\u{1F000}-\u{1FFFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{2500}-\u{25FF}\u{FE00}-\u{FE0F}\u{200D}]/gu;
function clean(t: any): string {
  let s = typeof t === 'string' ? t : '';
  s = s.replace(EMOJI_RE, '');
  if (!FONTS_EMBEDDED) {
    // built-in fonts are WinAnsi only: transliterate the common non-Latin1 letters
    s = s.replace(/[ăâ]/g, 'a').replace(/[ĂÂ]/g, 'A').replace(/[șş]/g, 's').replace(/[ȘŞ]/g, 'S')
      .replace(/[țţ]/g, 't').replace(/[ȚŢ]/g, 'T').replace(/î/g, 'i').replace(/Î/g, 'I');
  }
  return s;
}
const prettySize = (n?: number) => {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

type Run = { text: string; font: string; color: string; size?: number; link?: string; underline?: boolean };

function inlineRuns(content: any, base: { font?: string; color?: string } = {}): Run[] {
  const runs: Run[] = [];
  const items: any[] = Array.isArray(content) ? content : [];
  for (const it of items) {
    if (!it) continue;
    if (it.type === 'link') {
      const inner = Array.isArray(it.content) ? it.content : [{ text: it.href }];
      for (const t of inner) runs.push({ text: clean(t.text || ''), font: fontFor(t.styles), color: '#337EA9', link: it.href, underline: true });
    } else {
      const st = it.styles || {};
      runs.push({ text: clean(it.text), font: base.font || fontFor(st), color: base.color || colorOf(st.textColor), underline: !!st.underline });
    }
  }
  return runs;
}
const plainText = (content: any): string => inlineRuns(content).map((r) => r.text).join('');

function collectImageUrls(blocks: any[], out: Set<string>) {
  for (const b of blocks || []) {
    if (b && b.type === 'image' && b.props && b.props.url) out.add(String(b.props.url));
    if (b && Array.isArray(b.children)) collectImageUrls(b.children, out);
  }
}

async function loadImage(url: string, markupDir: string): Promise<Buffer | null> {
  try {
    if (/^data:/.test(url)) return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (url.startsWith('/markup-files/')) {
      const p = path.join(markupDir, url.replace(/^\/markup-files\//, ''));
      return fs.existsSync(p) ? fs.readFileSync(p) : null;
    }
    if (/^https?:\/\//.test(url)) {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
  } catch (e) { /* ignore */ }
  return null;
}

type Ctx = { doc: any; left: number; width: number; images: Map<string, Buffer> };

function renderRuns(ctx: Ctx, runs: Run[], x: number, w: number, size: number) {
  const { doc } = ctx;
  if (!runs.length) { doc.font(FONTS.r).fontSize(size).fillColor(COLOR.default).text(' ', x, doc.y, { width: w }); return; }
  runs.forEach((r, i) => {
    doc.font(r.font).fontSize(r.size || size).fillColor(r.color);
    const o: any = { width: w, continued: i < runs.length - 1 };
    if (r.link) { o.link = r.link; o.underline = true; }
    else if (r.underline) o.underline = true;
    if (i === 0) doc.text(r.text || ' ', x, doc.y, o); else doc.text(r.text || ' ', o);
  });
}

function hr(ctx: Ctx, color = '#E3E2E0') {
  const { doc, left, width } = ctx;
  const y = doc.y + 1;
  doc.moveTo(left, y).lineTo(left + width, y).lineWidth(1).strokeColor(color).stroke();
  doc.y = y + 4;
}

function renderBlocks(ctx: Ctx, blocks: any[], depth = 0, counters: Record<number, number> = {}) {
  const { doc, left, width } = ctx;
  const indent = depth * 18;
  const x = left + indent;
  const w = width - indent;

  for (const b of blocks || []) {
    if (!b) continue;
    if (b.__sep) { doc.moveDown(0.5); hr(ctx, '#D0CFCC'); doc.moveDown(0.5); continue; }
    const type = b.type;
    if (type !== 'numberedListItem') counters[depth] = 0;

    if (type === 'heading') {
      const lvl = (b.props && b.props.level) || 1;
      const size = lvl === 1 ? 21 : lvl === 2 ? 16 : 13.5;
      doc.moveDown(0.45);
      renderRuns(ctx, inlineRuns(b.content, { font: FONTS.b, color: colorOf(b.props && b.props.textColor) }).map((r) => ({ ...r, size })), x, w, size);
      doc.moveDown(0.25);
    } else if (type === 'bulletListItem' || type === 'toggleListItem') {
      const marker: Run = { text: (type === 'toggleListItem' ? '–  ' : '•  '), font: FONTS.r, color: COLOR.default };
      renderRuns(ctx, [marker, ...inlineRuns(b.content)], x, w, 11);
      doc.moveDown(0.12);
    } else if (type === 'numberedListItem') {
      counters[depth] = (counters[depth] || 0) + 1;
      const marker: Run = { text: `${counters[depth]}.  `, font: FONTS.r, color: COLOR.default };
      renderRuns(ctx, [marker, ...inlineRuns(b.content)], x, w, 11);
      doc.moveDown(0.12);
    } else if (type === 'checkListItem') {
      const checked = !!(b.props && b.props.checked);
      const marker: Run = { text: checked ? '[x]  ' : '[ ]  ', font: FONTS.r, color: COLOR.default };
      renderRuns(ctx, [marker, ...inlineRuns(b.content, { color: checked ? COLOR.gray : undefined })], x, w, 11);
      doc.moveDown(0.12);
    } else if (type === 'quote') {
      const top = doc.y;
      renderRuns(ctx, inlineRuns(b.content, { font: FONTS.i, color: COLOR.gray }), x + 12, w - 12, 11);
      doc.moveTo(x + 2, top).lineTo(x + 2, doc.y).lineWidth(3).strokeColor('#D0CFCC').stroke();
      doc.moveDown(0.35);
    } else if (type === 'codeBlock') {
      const txt = clean(plainText(b.content)) || ' ';
      doc.font(FONTS.r).fontSize(10);
      const h = doc.heightOfString(txt, { width: w - 20 });
      const top = doc.y;
      doc.save().rect(x, top, w, h + 16).fill('#F5F5F4').restore();
      doc.font(FONTS.r).fontSize(10).fillColor('#37352F').text(txt, x + 10, top + 8, { width: w - 20 });
      doc.y = top + h + 16;
      doc.moveDown(0.3);
    } else if (type === 'callout') {
      const innerX = x + 14, innerW = w - 28;
      const txt = plainText(b.content) || ' ';
      doc.font(FONTS.r).fontSize(11);
      const h = Math.max(18, doc.heightOfString(txt, { width: innerW }));
      const top = doc.y;
      doc.save().roundedRect(x, top, w, h + 16, 6).fill('#F1F0EF').restore();
      doc.y = top + 8;
      renderRuns(ctx, inlineRuns(b.content), innerX, innerW, 11);
      doc.y = Math.max(doc.y, top + h + 16);
      doc.moveDown(0.3);
    } else if (type === '__note') {
      const txt = clean(b.text) || '';
      doc.font(FONTS.r).fontSize(11);
      const innerW = w - 28;
      const h = Math.max(20, txt ? doc.heightOfString(txt, { width: innerW }) : 16);
      const top = doc.y;
      doc.save().roundedRect(x, top, w, h + 16, 6).fillAndStroke('#FEF3C7', '#FCE9A6').restore();
      doc.font(FONTS.r).fontSize(11).fillColor('#7C5E10').text(txt || 'Note', x + 14, top + 8, { width: innerW });
      doc.y = Math.max(doc.y, top + h + 16);
      doc.moveDown(0.3);
    } else if (type === 'divider') {
      doc.moveDown(0.2); hr(ctx); doc.moveDown(0.2);
    } else if (type === 'bookmark') {
      const url = (b.props && b.props.url) || '';
      const title = clean((b.props && b.props.title) || url);
      const host = clean((b.props && b.props.host) || url);
      const top = doc.y; const boxH = 42;
      doc.save().roundedRect(x, top, w, boxH, 6).lineWidth(1).strokeColor('#E3E2E0').stroke().restore();
      doc.font(FONTS.b).fontSize(11).fillColor('#37352F').text(title || ' ', x + 12, top + 9, { width: w - 24, link: url || undefined, lineBreak: false });
      doc.font(FONTS.r).fontSize(9).fillColor('#9B9A97').text(host || ' ', x + 12, top + 24, { width: w - 24, lineBreak: false });
      doc.y = top + boxH + 6;
    } else if (type === 'image') {
      const url = b.props && b.props.url;
      const buf = url ? ctx.images.get(String(url)) : null;
      if (buf) {
        try {
          const img = doc.openImage(buf);
          let dw = w, dh = (img.height / img.width) * w;
          const maxH = 480;
          if (dh > maxH) { dh = maxH; dw = (img.width / img.height) * maxH; }
          const bottom = doc.page.height - doc.page.margins.bottom;
          if (doc.y + dh > bottom && doc.y > doc.page.margins.top + 4) doc.addPage();
          doc.moveDown(0.2);
          doc.image(img, x, doc.y, { width: dw, height: dh });
          doc.y = doc.y + dh + 6; // advance past the image so nothing overlaps
        } catch (e) { /* unsupported image */ }
        const cap = clean(b.props && b.props.caption);
        if (cap) { doc.font(FONTS.i).fontSize(9).fillColor(COLOR.gray).text(cap, x, doc.y, { width: w }); doc.moveDown(0.3); }
      }
    } else if (type === 'table') {
      const rows = (b.content && b.content.rows) || [];
      const cellInline = (cell: any) => (Array.isArray(cell) ? cell : (cell && cell.content) || []);
      const nCols = rows.reduce((mx: number, r: any) => Math.max(mx, ((r && r.cells) || []).length), 1) || 1;
      const colW = w / nCols;
      const pad = 6;
      let ty = doc.y + 2;
      rows.forEach((row: any, ri: number) => {
        const cells = (row && row.cells) || [];
        const texts: string[] = [];
        let rowH = 22;
        doc.font(FONTS.r).fontSize(10);
        for (let ci = 0; ci < nCols; ci++) {
          const t = clean(plainText(cellInline(cells[ci])));
          texts.push(t);
          rowH = Math.max(rowH, doc.heightOfString(t || ' ', { width: colW - pad * 2 }) + pad * 2);
        }
        const bottom = doc.page.height - doc.page.margins.bottom;
        if (ty + rowH > bottom) { doc.addPage(); ty = doc.page.margins.top; }
        for (let ci = 0; ci < nCols; ci++) {
          const cx = x + ci * colW;
          if (ri === 0) { doc.save().rect(cx, ty, colW, rowH).fill('#F7F7F5').restore(); }
          doc.save().rect(cx, ty, colW, rowH).lineWidth(0.7).strokeColor('#D0CFCC').stroke().restore();
          if (texts[ci]) doc.font(ri === 0 ? FONTS.b : FONTS.r).fontSize(10).fillColor(COLOR.default).text(texts[ci], cx + pad, ty + pad, { width: colW - pad * 2 });
        }
        ty += rowH;
      });
      doc.y = ty;
      doc.moveDown(0.4);
    } else {
      if (b.content && b.content.length === 0) doc.moveDown(0.5);
      else { renderRuns(ctx, inlineRuns(b.content), x, w, 11); doc.moveDown(0.3); }
    }

    if (Array.isArray(b.children) && b.children.length) renderBlocks(ctx, b.children, depth + 1, counters);
  }
}

function elementToBlocks(el: any): any[] {
  if (!el) return [];
  if (el.type === 'text') return Array.isArray(el.doc) ? el.doc : [];
  if (el.type === 'image') return [{ type: 'image', props: { url: el.url, caption: '' } }];
  if (el.type === 'link') return [{ type: 'bookmark', props: { url: el.url || '', title: el.title || el.url || '', host: el.host || el.url || '' } }];
  if (el.type === 'note') return [{ type: '__note', text: el.text || '' }];
  if (el.type === 'file') return (el.files || []).map((f: any) => ({ type: 'bookmark', props: { url: f.url || '', title: f.name || 'File', host: prettySize(f.size) } }));
  return [];
}

// Normalize stored items into the page model: [{ name, doc }]. Handles both the new
// page format and the legacy free-canvas format (text elements → pages, media appended).
function normalizePages(items: any[]): { name: string; doc: any[] }[] {
  const arr = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!arr.length) return [];
  if (arr.every((p) => p && typeof p === 'object' && !('type' in p) && ('doc' in p || 'name' in p))) {
    return arr.map((p, i) => ({ name: p.name || `Page ${i + 1}`, doc: Array.isArray(p.doc) ? p.doc : [] }));
  }
  const texts = arr.filter((e) => e.type === 'text').sort((a, b) => (a.y || 0) - (b.y || 0));
  const media = arr.filter((e) => e.type && e.type !== 'text').sort((a, b) => (a.y || 0) - (b.y || 0));
  const pages = texts.map((t, i) => ({ name: `Page ${i + 1}`, doc: Array.isArray(t.doc) ? t.doc : [] }));
  if (!pages.length) pages.push({ name: 'Page 1', doc: [] });
  const extra: any[] = [];
  for (const m of media) extra.push(...elementToBlocks(m));
  if (extra.length) pages[0].doc = [...pages[0].doc, ...extra];
  return pages;
}

export async function generateBoardPdf(items: any[], opts: { markupDir: string; title?: string }): Promise<Buffer> {
  const pages = normalizePages(items);

  // preload every image referenced across all pages
  const urls = new Set<string>();
  for (const p of pages) collectImageUrls(p.doc, urls);
  const images = new Map<string, Buffer>();
  await Promise.all([...urls].map(async (u) => { const b = await loadImage(u, opts.markupDir); if (b) images.set(u, b); }));

  const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 64, left: 56, right: 56 }, info: { Title: opts.title || 'Project' } });
  registerFonts(doc);
  const chunks: Buffer[] = [];
  const out = new Promise<Buffer>((resolve) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const ctx: Ctx = { doc, left, width, images };

  if (!pages.length) {
    doc.font(FONTS.b).fontSize(22).fillColor('#111827').text(clean(opts.title) || 'Project', left, doc.y, { width });
    doc.moveDown(0.5);
    doc.font(FONTS.r).fontSize(11).fillColor(COLOR.gray).text('This project has no content yet.', left, doc.y, { width });
    doc.end();
    return out;
  }

  // each project page starts on a new PDF page, titled with the page name
  pages.forEach((p, i) => {
    if (i > 0) doc.addPage();
    doc.font(FONTS.b).fontSize(18).fillColor('#111827').text(clean(p.name) || `Page ${i + 1}`, left, doc.y, { width });
    doc.moveDown(0.3);
    hr(ctx, '#E3E2E0');
    doc.moveDown(0.5);
    renderBlocks(ctx, p.doc || [], 0, {});
  });

  doc.end();
  return out;
}
