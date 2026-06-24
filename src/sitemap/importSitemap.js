/* ------------------------------------------------------------------ */
/*  Import sitemaps from external sources into our node model.          */
/*   - Octopus.do CSV export  (pages + sections/blocks + content)       */
/*   - sitemap.xml (urlset)   (pages from URL paths)                    */
/* ------------------------------------------------------------------ */
import { uid } from '../projectStore';

/* tiny CSV parser supporting quoted fields and a custom delimiter */
function parseCSV(text, delim) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* ignore */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (s) => (s == null ? '' : String(s).trim());
const isNull = (s) => clean(s) === '' || clean(s).toLowerCase() === 'null';

// strip Octopus template/arrow markers from a page title (e.g. "Home T1", "Wedding DJ T3 →")
function cleanLabel(t) {
  return clean(t).replace(/\s*→\s*$/, '').replace(/\s+T\d+\s*$/i, '').trim() || 'Page';
}

// Octopus CSV has no color column — reconstruct Octopus-like colors from the block role.
function colorFor(name, idx) {
  const n = (name || '').toLowerCase();
  if (/header|nav|menu/.test(n)) return 'teal';
  if (/footer/.test(n)) return 'purple';
  if (/hero|overview|service|approach|what we|key |program overview/.test(n)) return 'teal';
  if (/benefit|feature|advantage|why /.test(n)) return 'teal';
  if (/use case|gallery|example|moment|sample|statistic|microbar|outcome|step/.test(n)) return 'lime';
  if (/program|process|journey|timeline|included|eligib/.test(n)) return 'green';
  if (/review|testimonial|proof|audience/.test(n)) return 'purple';
  if (/location|contact|map|address/.test(n)) return 'orange';
  if (/book|cta|inquiry|reserve|get started|consult|sign|pricing|package|membership|plan|offer/.test(n)) return 'pink';
  if (/faq|question/.test(n)) return 'blue';
  return ['teal', 'green', 'purple', 'orange', 'pink', 'blue'][(idx || 0) % 6];
}
// CSV has no wireframe data either — infer a sensible glyph from the block name.
function frameFor(name) {
  const n = (name || '').toLowerCase();
  if (/hero|banner/.test(n)) return 'banner';
  if (/video|film|reel/.test(n)) return 'video';
  if (/use case|gallery|moment|example|sample|card|categor|grid|photo/.test(n)) return 'cards3';
  if (/service overview|overview|tier|plan|package|option|pricing/.test(n)) return 'cols3';
  if (/benefit|feature|advantage|stat|microbar/.test(n)) return 'cols3';
  if (/faq|question|step|process|journey|timeline|checklist/.test(n)) return 'list';
  if (/map|location|contact/.test(n)) return 'media-text';
  return 'text';
}
const mkBlock = (name, content, idx) => ({
  id: uid(), name: name || 'Section', color: colorFor(name, idx), frame: frameFor(name),
  done: false, arrowTargets: [], description: isNull(content) ? '' : clean(content),
});

// Octopus native XML stores the real wireframe in <form>. Definitive map built from
// Octopus's full block library (the "all blocks" export) → our matching glyph keys.
const FORM_TO_FRAME = {
  // single bar / buttons / inputs
  wide: 'bar', button: 'bar', buttons: 'bar', cta: 'bar', cta_2: 'bar', inputs: 'bar',
  search: 'bar', newsletter: 'bar', subscribe: 'bar', store_buttons: 'cols2', store_buttons_2: 'cols2',
  // text variants
  text: 'text', title_and_paragraph: 'text', paragraph: 'text', quote: 'text',
  text_double: 'text2', text_triple: 'text3', text_quarter: 'text4', post_thread: 'list',
  // column boxes
  double: 'cols2', features_double: 'cols2', columns: 'cols2', two_columns: 'cols2',
  triple: 'cols3', features: 'cols3', features_triple: 'cols3', features_triple_center: 'cols3', pricing: 'cols3', three_columns: 'cols3',
  quarter: 'cols4', features_quarter: 'cols4', logos: 'cols4', icons: 'cols4', stats: 'cols4', statistics: 'cols4', numbers: 'cols4', four_columns: 'cols4',
  // hero / banner
  text_on_image: 'banner', hero: 'banner', banner: 'banner',
  // sliders / carousels
  hero_with_arrows: 'carousel', carousel: 'carousel', slider: 'dots',
  two_column_slider: 'carousel2', carousel_2: 'carousel2',
  // tables / rows
  table: 'table', table_2: 'table', compare: 'table', pricing_table: 'table', table_row: 'list2',
  // cards / catalog / gallery / articles
  cards: 'cards3', team: 'cards3', cards_left: 'media-text', cards_right: 'text-media',
  catalog: 'cards-grid', catalog_2: 'cards-grid', gallery: 'cards-grid', portfolio: 'cards-grid', images: 'cards-grid',
  articles: 'cards3', articles_2: 'cards2', articles_3: 'cards3',
  // image + text
  image: 'media-text', image_left: 'media-text', image_text: 'media-text', contact_form: 'media-text',
  image_right: 'text-media', text_image: 'text-media',
  map: 'media-split', map_2: 'media-split',
  // lists / faq / steps
  faq: 'list', accordeon: 'list', accordion: 'list', list: 'list', form: 'list',
  tabs: 'list2', timeline: 'list', timeline_2: 'list', steps: 'dots',
  // testimonials / reviews
  testimonials: 'carousel3', reviews: 'cards3',
  // video
  video: 'video', text_and_video: 'video-center', text_and_video_2: 'video-center', video_center: 'video-center',
  dots: 'dots', dashes: 'dashes', icon_row: 'iconrow',
};
function formToFrame(forms, name) {
  for (const f of forms) { const k = String(f).toLowerCase().trim().replace(/-/g, '_'); if (FORM_TO_FRAME[k]) return FORM_TO_FRAME[k]; }
  return frameFor(name);
}

// Split nodes into the MAIN tree (largest) + SECTION zone (other top-level pages, flattened).
function finalizeZones(nodes) {
  const ids = new Set(nodes.map((n) => n.id));
  nodes.forEach((n) => { if (n.parentId && !ids.has(n.parentId)) n.parentId = null; });
  const kids = {};
  nodes.forEach((n) => { if (n.parentId) (kids[n.parentId] || (kids[n.parentId] = [])).push(n.id); });
  const descCount = (id) => { let c = 0; const st = [...(kids[id] || [])]; while (st.length) { c++; (kids[st.pop()] || []).forEach((k) => st.push(k)); } return c; };
  const roots = nodes.filter((n) => !n.parentId);
  if (!roots.length) return;
  let mainRoot = roots[0];
  roots.forEach((r) => { if (descCount(r.id) > descCount(mainRoot.id)) mainRoot = r; });
  const mainSet = new Set(); const st = [mainRoot.id];
  while (st.length) { const id = st.pop(); mainSet.add(id); (kids[id] || []).forEach((k) => st.push(k)); }
  nodes.forEach((n) => { if (mainSet.has(n.id)) n.group = 'main'; else { n.group = 'section'; n.parentId = null; } });
}

// Octopus encodes cross-page links only as "→ PageName" hints in block names/content.
// Rebuild arrow targets from those hints by matching page labels.
function rebuildArrows(nodes) {
  const labelMap = {};
  nodes.forEach((n) => { labelMap[n.label.toLowerCase().trim()] = n.id; });
  const keys = Object.keys(labelMap);
  nodes.forEach((n) => n.blocks.forEach((b) => {
    const text = `${b.name} ${b.description || ''}`;
    let m;
    const re = /→\s*([A-Za-z][A-Za-z0-9 &/'-]{1,40})/g;
    while ((m = re.exec(text))) {
      const want = m[1].trim().replace(/\b(page|pages|section)\b.*$/i, '').replace(/[).,]+$/, '').trim().toLowerCase();
      if (!want) continue;
      let id = labelMap[want] || (keys.find((k) => k === want) && labelMap[keys.find((k) => k === want)]);
      if (!id) { const k = keys.find((kk) => kk.includes(want) || want.includes(kk)); if (k) id = labelMap[k]; }
      if (id && id !== n.id && !b.arrowTargets.includes(id)) b.arrowTargets.push(id);
    }
  }));
}

/* ---- Octopus.do CSV → nodes (pages + blocks) ---- */
function parseOctopusCsv(text) {
  // Octopus exports with ',' or ';' depending on locale — pick whichever the header uses
  const firstLine = text.slice(0, (text.indexOf('\n') + 1) || text.length);
  const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
  const rows = parseCSV(text, delim).filter((r) => r.length > 1);
  if (!rows.length) return null;
  const header = rows[0].map((h) => clean(h).toLowerCase());
  const col = (name) => header.findIndex((h) => h === name);
  const iParent = col('parent page id'), iId = col('page id'),
        iPage = col('page title'), iBlock = col('block title'), iContent = col('block content'),
        iLink = col('page link');
  if (iId < 0 || iPage < 0) return null; // not an Octopus CSV

  const nodes = [];
  const blocksByPage = {};

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const parent = isNull(row[iParent]) ? null : clean(row[iParent]);
    const pid = clean(row[iId]);
    const pageTitle = clean(row[iPage]);
    const blockTitle = clean(row[iBlock]);
    if (pageTitle) {
      const link = iLink >= 0 && !isNull(row[iLink]) ? clean(row[iLink]) : '';
      nodes.push({ id: pid || uid(), label: cleanLabel(pageTitle), parentId: parent, group: 'main',
                   color: 'blue', link, pageFrame: 'window', blocks: [] });
    } else if (blockTitle && parent) {
      const arr = (blocksByPage[parent] || (blocksByPage[parent] = []));
      arr.push(mkBlock(blockTitle, row[iContent], arr.length));
    }
  }
  if (!nodes.length) return null;

  nodes.forEach((n) => { n.blocks = blocksByPage[n.id] || []; });
  finalizeZones(nodes);
  rebuildArrows(nodes);
  return nodes;
}

/* ---- Octopus native XML (<octopus scheme>) → nodes (pages + blocks + real wireframes) ---- */
function parseOctopusXml(text) {
  if (!/<octopus/i.test(text) || typeof DOMParser === 'undefined') return null;
  let doc;
  try { doc = new DOMParser().parseFromString(text, 'application/xml'); } catch (e) { return null; }
  const tree = doc.getElementsByTagName('tree')[0];
  if (!tree) return null;
  const kids = (el, tag) => [...(el.children || [])].filter((c) => c.tagName && c.tagName.toLowerCase() === tag);
  const kid = (el, tag) => kids(el, tag)[0] || null;
  const txt = (el, tag) => { const c = kid(el, tag); return c ? clean(c.textContent) : ''; };
  const nodes = [];
  const walk = (nodeEl, parentId) => {
    const id = uid();
    const blocksEl = kid(nodeEl, 'blocks');
    const blocks = blocksEl ? kids(blocksEl, 'block').map((b, idx) => {
      const name = txt(b, 'title');
      const forms = kids(b, 'form').map((f) => f.textContent.trim());
      const note = txt(b, 'note');
      return { id: uid(), name: name || 'Section', color: colorFor(name, idx), frame: formToFrame(forms, name),
               done: false, arrowTargets: [], description: isNull(note) ? '' : note };
    }) : [];
    nodes.push({ id, label: cleanLabel(txt(nodeEl, 'text')), parentId, group: 'main', color: 'blue', link: '', pageFrame: 'window', blocks });
    const childrenEl = kid(nodeEl, 'children');
    if (childrenEl) kids(childrenEl, 'node').forEach((child) => walk(child, id));
  };
  const topChildren = kid(tree, 'children');
  kids(topChildren || tree, 'node').forEach((r) => walk(r, null));
  if (!nodes.length) return null;
  finalizeZones(nodes);
  rebuildArrows(nodes);
  return nodes;
}

/* ---- sitemap.xml (urlset) → nodes (pages from paths) ---- */
export function parseSitemapXml(text) {
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(text))) locs.push(m[1].trim());
  if (!locs.length) return null;

  // build a path tree
  const root = { id: uid(), label: 'Home', parentId: null, group: 'main', color: 'blue', link: locs[0] || '', pageFrame: 'window', blocks: [] };
  const nodes = [root];
  const pathToId = { '': root.id };

  const titleFromSeg = (seg) => decodeURIComponent(seg).replace(/[-_]+/g, ' ').replace(/\.(html?|php|aspx?)$/i, '').replace(/\b\w/g, (c) => c.toUpperCase()).trim() || 'Page';

  locs.forEach((url) => {
    let path;
    try { path = new URL(url).pathname; } catch (e) { path = url.replace(/^https?:\/\/[^/]+/i, ''); }
    const segs = path.split('/').filter(Boolean);
    let parentKey = '';
    let acc = '';
    segs.forEach((seg, idx) => {
      acc = acc + '/' + seg;
      const key = acc;
      if (!pathToId[key]) {
        const node = { id: uid(), label: titleFromSeg(seg), parentId: pathToId[parentKey], group: 'main',
                       color: 'blue', link: url, pageFrame: 'window', blocks: [] };
        pathToId[key] = node.id;
        nodes.push(node);
      }
      parentKey = key;
    });
  });
  return nodes.length > 1 || locs.length ? nodes : null;
}

/* ---- derive a project name from the uploaded file ---- */
// Octopus XML carries no project-name field, so we name the project after the
// downloaded file (Octopus names the export after the project). We strip the
// browser's " (2)" dedup suffix; for generic filenames we fall back to the
// home page label from the parsed tree.
const GENERIC_NAME = /^(untitled\s*project|untitled|sitemap(_index)?|export|document|new\s*project|project)$/i;
export function cleanProjectName(filename, nodes) {
  let name = clean(filename).replace(/\.(csv|xml)$/i, '');
  name = name.replace(/\s*\(\d+\)\s*$/, '').trim();           // strip browser " (4)" dedup suffix
  if (name && !GENERIC_NAME.test(name)) return name;
  // generic/empty → use the main home page label if it's meaningful
  if (Array.isArray(nodes) && nodes.length) {
    const main = nodes.find((n) => n.group === 'main' && !n.parentId) || nodes[0];
    const label = main && clean(main.label);
    if (label && !/^(home|page|untitled)$/i.test(label)) return label;
  }
  return name || 'Imported sitemap';
}

/* ---- detect format from text/filename and parse ---- */
export function parseImport(text, filename = '') {
  const t = text.trimStart();
  // Octopus native XML — richest (pages + sections + real wireframes)
  if (/<octopus/i.test(t.slice(0, 500))) { const x = parseOctopusXml(text); if (x) return x; }
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.csv') || /parent page id/i.test(t.slice(0, 300))) {
    const csv = parseOctopusCsv(text);
    if (csv) return csv;
  }
  if (/<urlset|<loc>/i.test(t.slice(0, 300))) {
    const xml = parseSitemapXml(text);
    if (xml) return xml;
  }
  // last resort: try everything
  return parseOctopusXml(text) || parseOctopusCsv(text) || parseSitemapXml(text);
}
