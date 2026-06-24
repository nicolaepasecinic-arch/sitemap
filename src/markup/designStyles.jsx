/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, X, Type as TypeIcon, ChevronDown, ChevronRight, ArrowLeft, Search, Link2, Palette, Box, LayoutTemplate,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Circle, CheckCircle2, MoreHorizontal, Trash2, Copy,
} from 'lucide-react';
import { GOOGLE_FONTS, loadGoogleFont, firstFamily } from './googleFonts';
import { FillControl, ColorPicker } from './fillControl';

/* ------------------------------------------------------------------ *
 *  Design styles — a project-wide design system used by the Design
 *  editor. Each style becomes a CSS class (e.g. .dz-text-<id>) that is
 *  generated into the page and applied to elements. This milestone
 *  ships the TEXT styles (with L/M/S/XS breakpoints); colors & links
 *  follow. The library lives in the Assets tab of the left sidebar.
 * ------------------------------------------------------------------ */

const INPUT = 'w-full bg-gray-100 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#473AE0]/40 placeholder-gray-400';

const uid = () => Math.random().toString(36).slice(2, 9);
const numUnit = (v, unit) => (v === '' || v == null ? '' : (/[a-z%]/i.test(String(v)) ? String(v) : `${v}${unit || ''}`));

const TAG_OPTS = [['', '— none —'], ['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'], ['h4', 'H4'], ['h5', 'H5'], ['h6', 'H6'], ['p', 'Paragraph'], ['a', 'Link'], ['span', 'Span'], ['div', 'Div'], ['button', 'Button'], ['li', 'List item'], ['blockquote', 'Quote'], ['label', 'Label']];
const WEIGHTS = [['', 'Default'], ['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extrabold'], ['900', 'Black']];
const TRANSFORMS = [['', 'None'], ['uppercase', 'UPPER'], ['lowercase', 'lower'], ['capitalize', 'Capitalize']];
const DECORATIONS = [['', 'None'], ['underline', 'Underline'], ['line-through', 'Line-through']];
const ALIGNS = [['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight], ['justify', AlignJustify]];
const SIZE_UNITS = ['px', 'rem', 'em', '%'];
const EM_UNITS = ['em', 'px', 'rem', '%'];
const BP_KEYS = ['L', 'M', 'S', 'XS'];
const BP_DEFAULT_MINW = { L: 1280, M: 1024, S: 768, XS: 0 };

/* ---------------- model ---------------- */
export function newTextStyle(name, tag = '', applyToTag = false) {
  return {
    id: uid(), name: name || 'New Text Style', tag, applyToTag,
    font: '', weight: '', bold: false, italic: false,
    color: '', fill: '', radius: '', padding: '', transform: '', decoration: '', align: '', balance: false,
    bp: BP_KEYS.reduce((m, k) => { m[k] = { minWidth: BP_DEFAULT_MINW[k], size: '', sizeUnit: 'px', letter: '', letterUnit: 'em', line: '', lineUnit: 'em', paragraph: '' }; return m; }, {}),
  };
}

export function newColor(name) {
  return { id: uid(), name: name || 'New Color', light: '#000000', dark: '' };
}
export function newLinkStyle(name) {
  return {
    id: uid(), name: name || 'New Link', tag: 'a', applyToTag: false,
    font: '', weight: '', color: '', fill: '', decoration: '', radius: '', padding: '', hoverColor: '', currentColor: '',
  };
}

export function normalizeStyles(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const text = Array.isArray(s.text) ? s.text.map((t) => ({ ...newTextStyle(t.name), ...t, bp: { ...newTextStyle().bp, ...(t.bp || {}) } })) : [];
  const link = Array.isArray(s.link) ? s.link.map((l) => ({ ...newLinkStyle(l.name), ...l })) : [];
  const colors = Array.isArray(s.colors) ? s.colors.map((c) => ({ ...newColor(c.name), ...c })) : [];
  const components = Array.isArray(s.components) ? s.components : [];
  // styleguideId: the linked style guide this design's theme was applied from (re-applyable).
  return { colors, text, link, components, seeded: !!s.seeded, styleguideId: s.styleguideId || '' };
}

/* Merge a style guide's theme (from /api/styleguides/:id/theme) into the design's styles,
   idempotently — upsert by canonical name so re-applying updates the same tokens instead
   of duplicating. Brand palette → colors; type scale + fonts → tag-bound H1–H6/Body/Button
   text styles; brand/accent → link style. Pure: returns the next styles object. */
export function applyStyleGuideTheme(theme, rawStyles) {
  const s = normalizeStyles(rawStyles);
  const c = (theme && theme.colors) || {};
  const ty = (theme && theme.type) || {};
  const headFont = (theme && theme.fonts && theme.fonts.heading) || '';
  const bodyFont = (theme && theme.fonts && theme.fonts.body) || '';
  const primary = c.brand || '';
  const onAccent = c.surfacePage || '#FFFFFF';

  // ---- colors: upsert by canonical name ----
  const colors = s.colors.map((x) => ({ ...x }));
  const upColor = (name, hex) => {
    if (!hex) return;
    const i = colors.findIndex((x) => x.name === name);
    if (i >= 0) colors[i] = { ...colors[i], light: hex };
    else colors.push({ ...newColor(name), light: hex });
  };
  upColor('Brand', c.brand); upColor('Accent', c.accent); upColor('Surface Alt', c.surfaceAlt);
  upColor('Surface Card', c.surfaceCard); upColor('Surface Page', c.surfacePage); upColor('Muted', c.muted);

  // ---- text styles: tag-bound H1–H6 + Body + Button ----
  const text = s.text.map((x) => ({ ...x }));
  const sizeL = (st, size) => ({ bp: { ...st.bp, L: { ...st.bp.L, size: size || st.bp.L.size, sizeUnit: 'px' } } });
  const upText = (name, build) => {
    const i = text.findIndex((x) => x.name === name);
    if (i >= 0) text[i] = { ...text[i], ...build(text[i]) };
    else { const st = newTextStyle(name); text.push({ ...st, ...build(st) }); }
  };
  [['Heading 1', 'h1', ty.h1], ['Heading 2', 'h2', ty.h2], ['Heading 3', 'h3', ty.h3],
   ['Heading 4', 'h4', ty.h4], ['Heading 5', 'h5', ty.h5], ['Heading 6', 'h6', ty.h6]]
    .forEach(([name, tag, size]) => upText(name, (st) => ({ tag, applyToTag: true, font: headFont, color: primary, ...sizeL(st, size) })));
  upText('Body', (st) => ({ tag: 'p', applyToTag: true, font: bodyFont, color: primary, ...sizeL(st, ty.bodyLg) }));
  upText('Button', (st) => ({ tag: 'button', applyToTag: true, font: bodyFont, weight: '600', color: onAccent, fill: c.accent || c.brand || '', radius: st.radius || 8, padding: st.padding || 14 }));

  // ---- link style ----
  const link = s.link.map((x) => ({ ...x }));
  const li = link.findIndex((x) => x.name === 'Link');
  const linkBuild = (st) => ({ ...st, tag: 'a', applyToTag: true, font: bodyFont, color: c.brand || '', hoverColor: c.accent || '' });
  if (li >= 0) link[li] = linkBuild(link[li]); else link.push(linkBuild(newLinkStyle('Link')));

  return { ...s, colors, text, link };
}

/* Seed one base text style per standard tag found on the page, reading its real
   (computed) styles so the library mirrors the page — opening it changes nothing
   visually, but every tag is now editable centrally. */
const rgbToHex = (rgb) => {
  if (!rgb) return '';
  if (rgb.startsWith('#')) return rgb;
  const m = rgb.match(/rgba?\(([^)]+)\)/); if (!m) return '';
  const [r, g, b] = m[1].split(',').map((x) => parseInt(x, 10));
  if ([r, g, b].some((n) => Number.isNaN(n))) return '';
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
};
const SEED_TAGS = [
  ['h1', 'Heading 1'], ['h2', 'Heading 2'], ['h3', 'Heading 3'], ['h4', 'Heading 4'], ['h5', 'Heading 5'], ['h6', 'Heading 6'],
  ['p', 'Paragraph'], ['a', 'Link Text'], ['blockquote', 'Quote'], ['li', 'List Item'], ['button', 'Button Text'], ['label', 'Label'],
];
export function seedTextStylesFromDoc(win, doc) {
  if (!win || !doc || !doc.body || !win.getComputedStyle) return [];
  const out = [];
  SEED_TAGS.forEach(([tag, name]) => {
    const el = doc.body.querySelector(tag);
    if (!el) return;
    const cs = win.getComputedStyle(el);
    const st = newTextStyle(name, tag, true);
    st.font = cs.fontFamily || '';
    st.weight = String(parseInt(cs.fontWeight, 10) || '') || '';
    st.italic = cs.fontStyle === 'italic';
    st.color = rgbToHex(cs.color) || '';
    const tt = cs.textTransform; if (tt && tt !== 'none') st.transform = tt;
    const td = cs.textDecorationLine || cs.textDecoration || ''; if (/line-through/.test(td)) st.decoration = 'line-through'; else if (/underline/.test(td)) st.decoration = 'underline';
    const ta = cs.textAlign; if (['center', 'right', 'justify'].includes(ta)) st.align = ta;
    const fsPx = parseFloat(cs.fontSize);
    const lhPx = parseFloat(cs.lineHeight);
    if (!Number.isNaN(fsPx)) { st.bp.L.size = Math.round(fsPx * 100) / 100; st.bp.L.sizeUnit = 'px'; }
    if (!Number.isNaN(fsPx) && !Number.isNaN(lhPx)) { st.bp.L.line = Math.round((lhPx / fsPx) * 100) / 100; st.bp.L.lineUnit = ''; }
    const ls = cs.letterSpacing; const lsv = parseFloat(ls);
    if (ls && ls !== 'normal' && !Number.isNaN(lsv)) { st.bp.L.letter = Math.round(lsv * 1000) / 1000; st.bp.L.letterUnit = 'px'; }
    out.push(st);
  });
  return out;
}

/* ---------------- CSS generation ---------------- */
function textBaseDecls(s) {
  const d = [];
  if (s.font) d.push(`font-family:${s.font}`);
  if (s.weight) d.push(`font-weight:${s.weight}`); else if (s.bold) d.push('font-weight:700');
  if (s.italic) d.push('font-style:italic');
  if (s.color) d.push(`color:${s.color}`);
  if (s.fill) d.push(`background:${s.fill}`);
  if (s.radius !== '' && s.radius != null) d.push(`border-radius:${numUnit(s.radius, 'px')}`);
  if (s.padding !== '' && s.padding != null) d.push(`padding:${numUnit(s.padding, 'px')}`);
  if (s.transform) d.push(`text-transform:${s.transform}`);
  if (s.decoration) d.push(`text-decoration-line:${s.decoration}`);
  if (s.align) d.push(`text-align:${s.align}`);
  if (s.balance) d.push('text-wrap:balance');
  return d;
}
function bpDecls(b) {
  if (!b) return [];
  const d = [];
  if (b.size !== '' && b.size != null) d.push(`font-size:${numUnit(b.size, b.sizeUnit || 'px')}`);
  if (b.letter !== '' && b.letter != null) d.push(`letter-spacing:${numUnit(b.letter, b.letterUnit || 'em')}`);
  if (b.line !== '' && b.line != null) d.push(`line-height:${numUnit(b.line, b.lineUnit || '')}`);
  if (b.paragraph !== '' && b.paragraph != null) d.push(`margin-bottom:${numUnit(b.paragraph, 'px')}`);
  return d;
}
// When a style applies to a whole tag, its rules must win over the imported site's own
// (often class-based) CSS — so tag-bound declarations are emitted !important. Per-element
// edits set inline styles with !important too, so they still override the tag rule.
const bang = (decls, on) => (on ? decls.map((d) => `${d} !important`) : decls);
export function genStylesCss(styles) {
  const out = [];
  (styles.text || []).forEach((s) => {
    const tagBound = !!(s.applyToTag && s.tag);
    const sel = tagBound ? `${s.tag}, .dz-text-${s.id}` : `.dz-text-${s.id}`;
    const order = BP_KEYS.slice().sort((a, b) => (s.bp[b]?.minWidth || 0) - (s.bp[a]?.minWidth || 0)); // desc
    const largest = order[0];
    const base = bang([...textBaseDecls(s), ...bpDecls(s.bp[largest])], tagBound);
    if (base.length) out.push(`${sel}{${base.join(';')}}`);
    for (let k = 1; k < order.length; k++) {
      const key = order[k];
      const decls = bang(bpDecls(s.bp[key]), tagBound);
      if (!decls.length) continue;
      const upper = (s.bp[order[k - 1]]?.minWidth || 0) - 1;
      out.push(`@media (max-width:${Math.max(0, upper)}px){${sel}{${decls.join(';')}}}`);
    }
  });
  (styles.link || []).forEach((s) => {
    const tagBound = !!(s.applyToTag && s.tag);
    const sel = tagBound ? `${s.tag}, .dz-link-${s.id}` : `.dz-link-${s.id}`;
    const d = [];
    if (s.font) d.push(`font-family:${s.font}`);
    if (s.weight) d.push(`font-weight:${s.weight}`);
    if (s.color) d.push(`color:${s.color}`);
    if (s.fill) d.push(`background:${s.fill}`);
    if (s.decoration) d.push(`text-decoration-line:${s.decoration}`);
    if (s.radius !== '' && s.radius != null) d.push(`border-radius:${numUnit(s.radius, 'px')}`);
    if (s.padding !== '' && s.padding != null) d.push(`padding:${numUnit(s.padding, 'px')}`);
    if (d.length) out.push(`${sel}{${bang(d, tagBound).join(';')}}`);
    if (s.hoverColor) out.push(`${sel}:hover{${bang([`color:${s.hoverColor}`], tagBound).join(';')}}`);
    if (s.currentColor) out.push(`${sel}[aria-current],${sel}.is-current{${bang([`color:${s.currentColor}`], tagBound).join(';')}}`);
  });
  return out.join('\n');
}

export const textStyleSummary = (s) => {
  const b = s.bp?.L || {};
  const size = b.size !== '' && b.size != null ? `${b.size}${b.sizeUnit || 'px'}` : '—';
  const line = b.line !== '' && b.line != null ? ` / ${b.line}` : '';
  return `${size}${line}`;
};

/* ============================ Styles panel (Assets tab) ============================ */
export function StylesPanel({ styles, onChange, selectedEl, appliedTextId, appliedLinkId, onApplyText, onRemoveText, onApplyLink, onRemoveLink }) {
  const [open, setOpen] = useState({ text: true, link: true, color: true });
  const [addMenu, setAddMenu] = useState(false);
  const [edit, setEdit] = useState(null); // { type:'text'|'link'|'color', id }
  const text = styles.text || [];
  const link = styles.link || [];
  const colors = styles.colors || [];
  const arrFor = (t) => (t === 'color' ? colors : t === 'link' ? link : text);
  const keyFor = (t) => (t === 'color' ? 'colors' : t);

  const set = (patch) => onChange({ ...styles, ...patch });
  const addText = () => { const s = newTextStyle(`Text ${text.length + 1}`); set({ text: [...text, s] }); setEdit({ type: 'text', id: s.id }); };
  const addLink = () => { const s = newLinkStyle(`Link ${link.length + 1}`); set({ link: [...link, s] }); setEdit({ type: 'link', id: s.id }); };
  const addColor = () => { const c = newColor(`Color ${colors.length + 1}`); set({ colors: [...colors, c] }); setEdit({ type: 'color', id: c.id }); };
  const updItem = (t, id, patch) => set({ [keyFor(t)]: arrFor(t).map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const delItem = (t, id) => { set({ [keyFor(t)]: arrFor(t).filter((x) => x.id !== id) }); if (edit && edit.id === id) setEdit(null); };
  const dupItem = (t, id) => { const s = arrFor(t).find((x) => x.id === id); if (!s) return; const c = { ...JSON.parse(JSON.stringify(s)), id: uid(), name: `${s.name} copy` }; set({ [keyFor(t)]: [...arrFor(t), c] }); };
  const addColorFromHex = (hex) => { const c = { ...newColor('Color ' + (colors.length + 1)), light: hex || '#000000' }; set({ colors: [...colors, c] }); };
  const editing = edit ? arrFor(edit.type).find((x) => x.id === edit.id) : null;
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="px-1.5 pt-1">
      <div className="relative flex items-center justify-between px-1.5 pb-1">
        <span className="text-[13px] font-bold text-gray-900">Styles</span>
        <button onClick={() => setAddMenu((v) => !v)} title="Add style" className="w-6 h-6 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-700"><Plus size={16} /></button>
        {addMenu && (<>
          <div className="fixed inset-0 z-30" onClick={() => setAddMenu(false)} />
          <div className="absolute right-1 top-8 z-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-44 text-sm">
            <button onClick={() => { setAddMenu(false); addText(); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><TypeIcon size={14} className="text-[#473AE0]" /> New text style</button>
            <button onClick={() => { setAddMenu(false); addLink(); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><Link2 size={14} className="text-[#473AE0]" /> New link style</button>
            <button onClick={() => { setAddMenu(false); addColor(); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><Palette size={14} className="text-[#473AE0]" /> New color</button>
          </div>
        </>)}
      </div>

      <Folder open={open.text} onToggle={() => toggle('text')} icon={TypeIcon} label="Text" count={text.length}>
        {text.length === 0 && <div className="text-[12px] text-gray-400 px-2 py-1.5">No text styles yet.</div>}
        {text.map((s) => (
          <StyleRow key={s.id} badge={s.tag ? s.tag.toUpperCase() : 'A'} name={s.name} summary={textStyleSummary(s)}
            selectedEl={selectedEl} applied={appliedTextId === s.id}
            onEdit={() => setEdit({ type: 'text', id: s.id })} onApply={() => onApplyText(s.id)} onRemove={onRemoveText}
            onDelete={() => delItem('text', s.id)} onDuplicate={() => dupItem('text', s.id)} />
        ))}
      </Folder>

      <Folder open={open.link} onToggle={() => toggle('link')} icon={Link2} label="Link" count={link.length}>
        {link.length === 0 && <div className="text-[12px] text-gray-400 px-2 py-1.5">No link styles yet.</div>}
        {link.map((s) => (
          <StyleRow key={s.id} badge="A" badgeColor="#3b82f6" name={s.name} summary=""
            selectedEl={selectedEl} applied={appliedLinkId === s.id}
            onEdit={() => setEdit({ type: 'link', id: s.id })} onApply={() => onApplyLink(s.id)} onRemove={onRemoveLink}
            onDelete={() => delItem('link', s.id)} onDuplicate={() => dupItem('link', s.id)} />
        ))}
      </Folder>

      <Folder open={open.color} onToggle={() => toggle('color')} icon={Palette} label="Color" count={colors.length}>
        {colors.length === 0 && <div className="text-[12px] text-gray-400 px-2 py-1.5">No colors yet.</div>}
        {colors.map((c) => (
          <StyleRow key={c.id} swatch={c.light} name={c.name} summary={(c.light || '').toUpperCase()}
            onEdit={() => setEdit({ type: 'color', id: c.id })}
            onDelete={() => delItem('color', c.id)} onDuplicate={() => dupItem('color', c.id)} />
        ))}
      </Folder>

      {editing && edit.type === 'text' && <TextStyleEditor style={editing} colors={colors} onNewColor={addColorFromHex} onChange={(p) => updItem('text', edit.id, p)} onClose={() => setEdit(null)} onDelete={() => delItem('text', edit.id)} />}
      {editing && edit.type === 'link' && <LinkStyleEditor style={editing} colors={colors} onNewColor={addColorFromHex} onChange={(p) => updItem('link', edit.id, p)} onClose={() => setEdit(null)} onDelete={() => delItem('link', edit.id)} />}
      {editing && edit.type === 'color' && <ColorEditor color={editing} onChange={(p) => updItem('color', edit.id, p)} onClose={() => setEdit(null)} onDelete={() => delItem('color', edit.id)} />}
    </div>
  );
}

function Folder({ open, onToggle, icon: Icon, label, count, children }) {
  return (
    <>
      <button onClick={onToggle} className="w-full flex items-center gap-1.5 px-1.5 h-7 text-[13px] text-gray-700">
        {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
        <Icon size={13} className="text-[#473AE0]" />
        <span className="font-medium">{label}</span>
        <span className="ml-auto text-[11px] text-gray-400">{count}</span>
      </button>
      {open && <div className="pb-2">{children}</div>}
    </>
  );
}

function StyleRow({ badge, badgeColor, swatch, name, summary, selectedEl, applied, onEdit, onApply, onRemove, onDelete, onDuplicate }) {
  const [menu, setMenu] = useState(false);
  const stop = (fn) => (e) => { e.stopPropagation(); if (fn) fn(); };
  return (
    // The whole row is the edit target — a single click opens the editor. The apply
    // and "…" controls stop propagation so clicking a row never changes the page.
    <div onClick={onEdit} title="Click to edit this style" className="group relative flex items-center gap-2.5 h-9 px-2 rounded-lg cursor-pointer hover:bg-gray-100/70">
      {swatch !== undefined
        ? <span className="w-4 h-4 rounded shrink-0 border border-gray-200" style={{ background: swatch || '#fff' }} />
        : <span className="shrink-0 text-center text-[12px] font-bold tabular-nums" style={{ color: badgeColor || '#374151', minWidth: 22 }}>{badge}</span>}
      <span className="flex-1 min-w-0 text-[14px] text-gray-800 truncate">{name}</span>
      {summary ? <span className="text-[12px] text-gray-400 shrink-0 tabular-nums">{summary}</span> : null}
      {selectedEl && onApply && (applied
        ? <button onClick={stop(onRemove)} title="Remove from selected element" className="shrink-0 text-[#473AE0]"><CheckCircle2 size={16} /></button>
        : <button onClick={stop(onApply)} title="Apply to selected element" className="shrink-0 text-gray-300 hover:text-[#473AE0] opacity-0 group-hover:opacity-100"><Circle size={16} /></button>)}
      <button onClick={stop(() => setMenu((v) => !v))} className="shrink-0 w-5 h-5 rounded text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 flex items-center justify-center"><MoreHorizontal size={15} /></button>
      {menu && (<>
        <div className="fixed inset-0 z-30" onClick={stop(() => setMenu(false))} />
        <div className="absolute right-1 top-8 z-40 bg-white rounded-lg shadow-xl border border-gray-100 py-1 w-36 text-sm" onClick={(e) => e.stopPropagation()}>
          <button onClick={stop(() => { setMenu(false); onEdit(); })} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">Edit</button>
          <button onClick={stop(() => { setMenu(false); onDuplicate(); })} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><Copy size={13} /> Duplicate</button>
          <button onClick={stop(() => { setMenu(false); onDelete(); })} className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-500 flex items-center gap-2"><Trash2 size={13} /> Delete</button>
        </div>
      </>)}
    </div>
  );
}

/* ============================ Components & Layout Templates (Assets) ============================ */
export const compFolder = (c) => (c.folder && String(c.folder).trim()) || 'Project';
export function ComponentsPanel({ components, styles, onChange, onInsert, askName, askFolder }) {
  const [open, setOpen] = useState({});
  const comps = (components || []).filter((c) => c.kind !== 'template');
  const tpls = (components || []).filter((c) => c.kind === 'template');
  const folders = Array.from(new Set(comps.map(compFolder)));
  const isOpen = (k) => (k in open ? open[k] : true);
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !isOpen(k) }));
  const upd = (id, patch) => onChange({ ...styles, components: components.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const del = (id) => onChange({ ...styles, components: components.filter((c) => c.id !== id) });
  const moveToFolder = async (id) => {
    const cur = compFolder(components.find((c) => c.id === id) || {});
    const f = askFolder ? await askFolder(cur) : (askName ? await askName('Move to folder', '', 'Folder name') : window.prompt('Folder'));
    if (f != null) upd(id, { folder: (f || '').trim() || 'Project' });
  };
  const row = (c, Icon) => <CompRow key={c.id} c={c} icon={Icon} askName={askName} onInsert={() => onInsert(c.html)} onRename={(n) => upd(c.id, { name: n })} onMove={() => moveToFolder(c.id)} onDelete={() => del(c.id)} />;
  return (
    <div className="px-1.5 pt-2 mt-1 border-t border-gray-100">
      <div className="px-1.5 pb-1 text-[13px] font-bold text-gray-900">Components</div>
      {comps.length === 0 && <div className="text-[12px] text-gray-400 px-2 py-1.5">Right-click an element → Create Component.</div>}
      {folders.map((f) => (
        <Folder key={f} open={isOpen('c:' + f)} onToggle={() => toggle('c:' + f)} icon={Box} label={f} count={comps.filter((c) => compFolder(c) === f).length}>
          {comps.filter((c) => compFolder(c) === f).map((c) => row(c, Box))}
        </Folder>
      ))}
      {tpls.length > 0 && (
        <Folder open={isOpen('tpl')} onToggle={() => toggle('tpl')} icon={LayoutTemplate} label="Layout Templates" count={tpls.length}>
          {tpls.map((c) => row(c, LayoutTemplate))}
        </Folder>
      )}
    </div>
  );
}
function CompRow({ c, icon: Icon, onInsert, onRename, onMove, onDelete, askName }) {
  const [menu, setMenu] = useState(false);
  const stop = (fn) => (e) => { e.stopPropagation(); if (fn) fn(); };
  const doRename = async () => { setMenu(false); const n = askName ? await askName('Rename', c.name, 'Name') : window.prompt('Rename', c.name); if (n != null && n.trim()) onRename(n.trim()); };
  return (
    <div onClick={onInsert} title="Click to insert into the selected container" className="group relative flex items-center gap-2.5 h-9 px-2 rounded-lg cursor-pointer hover:bg-gray-100/70">
      <Icon size={14} className="text-[#7c3aed] shrink-0" />
      <span className="flex-1 min-w-0 text-[14px] text-gray-800 truncate">{c.name}</span>
      <button onClick={stop(() => setMenu((v) => !v))} className="shrink-0 w-5 h-5 rounded text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 flex items-center justify-center"><MoreHorizontal size={15} /></button>
      {menu && (<>
        <div className="fixed inset-0 z-30" onClick={stop(() => setMenu(false))} />
        <div className="absolute right-1 top-8 z-40 bg-white rounded-lg shadow-xl border border-gray-100 py-1 w-36 text-sm" onClick={(e) => e.stopPropagation()}>
          <button onClick={stop(() => { setMenu(false); onInsert(); })} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">Insert</button>
          <button onClick={stop(doRename)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">Rename</button>
          {onMove && <button onClick={stop(() => { setMenu(false); onMove(); })} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">Move to folder…</button>}
          <button onClick={stop(() => { setMenu(false); onDelete(); })} className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-500 flex items-center gap-2"><Trash2 size={13} /> Delete</button>
        </div>
      </>)}
    </div>
  );
}

/* ============================ Text style editor (popover) ============================ */
function TextStyleEditor({ style, onChange, onClose, onDelete, colors, onNewColor }) {
  const [bp, setBp] = useState('L');
  const b = style.bp[bp] || {};
  const setBpField = (k, v) => onChange({ bp: { ...style.bp, [bp]: { ...style.bp[bp], [k]: v } } });

  return (
    <div className="fixed top-16 left-[268px] z-50 w-[300px] max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100">
      <div className="sticky top-0 bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <input value={style.name} onChange={(e) => onChange({ name: e.target.value })} className="font-semibold text-gray-800 text-[15px] bg-transparent outline-none w-full mr-2" />
        <button onClick={onClose} className="w-6 h-6 rounded hover:bg-gray-100 text-gray-400 flex items-center justify-center shrink-0"><X size={15} /></button>
      </div>

      <div className="p-4 space-y-2.5">
        <Row label="Tag"><Sel value={style.tag} options={TAG_OPTS} onChange={(v) => onChange({ tag: v })} /></Row>
        {style.tag && (
          <Row label="Apply to tag">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {[['y', 'Yes', true], ['n', 'No', false]].map(([k, l, val]) => (
                <button key={k} onClick={() => onChange({ applyToTag: val })} className={`flex-1 py-1 text-sm rounded-md ${style.applyToTag === val ? 'bg-white shadow-sm border border-gray-200 text-[#473AE0] font-semibold' : 'text-gray-500'}`}>{l}</button>
              ))}
            </div>
          </Row>
        )}
        <Row label="Font"><FontPicker value={style.font} onChange={(v) => onChange({ font: v })} /></Row>
        <Row label="Weight"><Sel value={style.weight} options={WEIGHTS} onChange={(v) => onChange({ weight: v })} /></Row>
        <Row label="Styles">
          <div className="flex gap-1">
            <Toggle on={style.bold} onClick={() => onChange({ bold: !style.bold })} label="B" bold />
            <Toggle on={style.italic} onClick={() => onChange({ italic: !style.italic })} label="I" italic />
          </div>
        </Row>
        <Row label="Color"><Color value={style.color} colors={colors} onNewColor={onNewColor} onChange={(v) => onChange({ color: v })} /></Row>
        <Row label="Fill"><FillControl value={style.fill} colors={colors} onNewColor={onNewColor} onChange={(v) => onChange({ fill: v })} /></Row>
        <Row label="Radius"><Num value={style.radius} onChange={(v) => onChange({ radius: v })} /></Row>
        <Row label="Padding"><Num value={style.padding} onChange={(v) => onChange({ padding: v })} /></Row>
        <Row label="Transform"><Sel value={style.transform} options={TRANSFORMS} onChange={(v) => onChange({ transform: v })} /></Row>
        <Row label="Decoration"><Sel value={style.decoration} options={DECORATIONS} onChange={(v) => onChange({ decoration: v })} /></Row>
        <Row label="Align">
          <div className="flex gap-1">
            {ALIGNS.map(([a, Icon]) => (
              <button key={a} onClick={() => onChange({ align: style.align === a ? '' : a })} className={`flex-1 py-1.5 rounded-md flex items-center justify-center ${style.align === a ? 'bg-indigo-50 text-[#473AE0]' : 'bg-gray-100 text-gray-500 hover:text-gray-700'}`}><Icon size={15} /></button>
            ))}
          </div>
        </Row>
        <Row label="Balance">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {[['y', 'Yes', true], ['n', 'No', false]].map(([k, l, val]) => (
              <button key={k} onClick={() => onChange({ balance: val })} className={`flex-1 py-1 text-sm rounded-md ${style.balance === val ? 'bg-white shadow-sm border border-gray-200 text-[#473AE0] font-semibold' : 'text-gray-500'}`}>{l}</button>
            ))}
          </div>
        </Row>
      </div>

      {/* Breakpoints */}
      <div className="px-4 pb-4">
        <div className="text-[15px] font-bold text-gray-900 mb-2 border-t border-gray-100 -mx-4 px-4 pt-3">Breakpoints</div>
        <Row label="Type">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {BP_KEYS.map((k) => (
              <button key={k} onClick={() => setBp(k)} className={`flex-1 py-1 text-sm rounded-md ${bp === k ? 'bg-white shadow-sm border border-gray-200 text-[#473AE0] font-semibold' : 'text-gray-500'}`}>{k}</button>
            ))}
          </div>
        </Row>
        <div className="space-y-2.5 mt-2.5">
          <Row label="Min Width"><Num value={b.minWidth} bare onChange={(v) => setBpField('minWidth', v === '' ? '' : Number(v))} /></Row>
          <Row label="Size"><UnitNum value={b.size} unit={b.sizeUnit} units={SIZE_UNITS} onValue={(v) => setBpField('size', v)} onUnit={(u) => setBpField('sizeUnit', u)} /></Row>
          <Row label="Letter"><UnitNum value={b.letter} unit={b.letterUnit} units={EM_UNITS} onValue={(v) => setBpField('letter', v)} onUnit={(u) => setBpField('letterUnit', u)} /></Row>
          <Row label="Line"><UnitNum value={b.line} unit={b.lineUnit} units={['', 'em', 'px', '%']} onValue={(v) => setBpField('line', v)} onUnit={(u) => setBpField('lineUnit', u)} /></Row>
          <Row label="Paragraph"><Num value={b.paragraph} onChange={(v) => setBpField('paragraph', v)} /></Row>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-100">
        <button onClick={onDelete} className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1.5"><Trash2 size={14} /> Delete style</button>
      </div>
    </div>
  );
}

/* ============================ Color token editor ============================ */
function ColorEditor({ color, onChange, onClose, onDelete }) {
  return (
    <div className="fixed top-16 left-[268px] z-50 w-[300px] bg-white rounded-2xl shadow-2xl border border-gray-100">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <input value={color.name} onChange={(e) => onChange({ name: e.target.value })} className="font-semibold text-gray-800 text-[15px] bg-transparent outline-none w-full mr-2" />
        <button onClick={onClose} className="w-6 h-6 rounded hover:bg-gray-100 text-gray-400 flex items-center justify-center shrink-0"><X size={15} /></button>
      </div>
      <div className="p-4 space-y-2.5">
        <Row label="Light"><Color value={color.light} onChange={(v) => onChange({ light: v })} /></Row>
        <Row label="Dark"><Color value={color.dark} onChange={(v) => onChange({ dark: v })} /></Row>
      </div>
      <div className="px-4 py-3 border-t border-gray-100">
        <button onClick={onDelete} className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1.5"><Trash2 size={14} /> Delete color</button>
      </div>
    </div>
  );
}

/* ============================ Link style editor ============================ */
function LinkStyleEditor({ style, onChange, onClose, onDelete, colors, onNewColor }) {
  return (
    <div className="fixed top-16 left-[268px] z-50 w-[300px] max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100">
      <div className="sticky top-0 bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <input value={style.name} onChange={(e) => onChange({ name: e.target.value })} className="font-semibold text-gray-800 text-[15px] bg-transparent outline-none w-full mr-2" />
        <button onClick={onClose} className="w-6 h-6 rounded hover:bg-gray-100 text-gray-400 flex items-center justify-center shrink-0"><X size={15} /></button>
      </div>
      <div className="p-4 space-y-2.5">
        <Row label="Tag"><Sel value={style.tag} options={TAG_OPTS} onChange={(v) => onChange({ tag: v })} /></Row>
        {style.tag && (
          <Row label="Apply to tag">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {[['y', 'Yes', true], ['n', 'No', false]].map(([k, l, val]) => (
                <button key={k} onClick={() => onChange({ applyToTag: val })} className={`flex-1 py-1 text-sm rounded-md ${style.applyToTag === val ? 'bg-white shadow-sm border border-gray-200 text-[#473AE0] font-semibold' : 'text-gray-500'}`}>{l}</button>
              ))}
            </div>
          </Row>
        )}
        <Row label="Font"><FontPicker value={style.font} onChange={(v) => onChange({ font: v })} /></Row>
        <Row label="Weight"><Sel value={style.weight} options={WEIGHTS} onChange={(v) => onChange({ weight: v })} /></Row>
        <Row label="Color"><Color value={style.color} colors={colors} onNewColor={onNewColor} onChange={(v) => onChange({ color: v })} /></Row>
        <Row label="Decoration"><Sel value={style.decoration} options={DECORATIONS} onChange={(v) => onChange({ decoration: v })} /></Row>
        <Row label="Fill"><FillControl value={style.fill} colors={colors} onNewColor={onNewColor} onChange={(v) => onChange({ fill: v })} /></Row>
        <Row label="Radius"><Num value={style.radius} onChange={(v) => onChange({ radius: v })} /></Row>
        <Row label="Padding"><Num value={style.padding} onChange={(v) => onChange({ padding: v })} /></Row>
      </div>
      <div className="px-4 pb-3">
        <div className="text-[15px] font-bold text-gray-900 mb-2 border-t border-gray-100 -mx-4 px-4 pt-3">Hover</div>
        <Row label="Color"><Color value={style.hoverColor} colors={colors} onNewColor={onNewColor} onChange={(v) => onChange({ hoverColor: v })} /></Row>
        <div className="text-[15px] font-bold text-gray-900 mb-2 mt-3 border-t border-gray-100 -mx-4 px-4 pt-3">Current</div>
        <Row label="Color"><Color value={style.currentColor} colors={colors} onNewColor={onNewColor} onChange={(v) => onChange({ currentColor: v })} /></Row>
      </div>
      <div className="px-4 py-3 border-t border-gray-100">
        <button onClick={onDelete} className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1.5"><Trash2 size={14} /> Delete style</button>
      </div>
    </div>
  );
}

/* ============================ Font picker (Google Fonts) ============================ */
function FontPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const label = firstFamily(value) || 'Default';
  useEffect(() => { loadGoogleFont(value, document); }, [value]);
  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full flex items-center justify-between bg-gray-100 rounded-lg px-2.5 py-1.5 text-sm text-gray-700">
        <span className="truncate" style={{ fontFamily: value || undefined }}>{label}</span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>
      {open && <FontModal value={value} onClose={() => setOpen(false)} onPick={(f) => { onChange(f); setOpen(false); }} />}
    </>
  );
}

function FontModal({ value, onClose, onPick }) {
  const [q, setQ] = useState('');
  const cur = firstFamily(value);
  const list = GOOGLE_FONTS.filter((f) => !q || f.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed top-16 left-[268px] z-[60] w-[300px] max-h-[80vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100">
      <div className="px-3 py-3 flex items-center gap-2 border-b border-gray-100">
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><ArrowLeft size={16} /></button>
        <span className="flex-1 text-center font-semibold text-gray-800 text-[15px]">Fonts</span>
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><X size={16} /></button>
      </div>
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2.5"><Search size={14} className="text-gray-400" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="flex-1 bg-transparent py-2 text-sm outline-none" /></div>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 mt-1">
        {list.length === 0 && <div className="text-xs text-gray-400 px-2 py-2">No fonts match “{q}”.</div>}
        {list.map((f) => <FontRow key={f} name={f} selected={f === cur} onPick={() => onPick(f)} />)}
      </div>
    </div>
  );
}

// One row in the font list — lazily loads its own webfont when scrolled into view so
// the name renders in that typeface (like Framer's picker).
function FontRow({ name, selected, onPick }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || seen) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { loadGoogleFont(name, document); setSeen(true); io.disconnect(); } }, { root: null, rootMargin: '120px' });
    io.observe(el); return () => io.disconnect();
  }, [name, seen]);
  return (
    <button ref={ref} onClick={onPick} style={{ fontFamily: name }}
      className={`w-full text-left px-3 py-2 rounded-lg text-[15px] truncate ${selected ? 'bg-[#2f80ff] text-white' : 'text-gray-800 hover:bg-gray-50'}`}>
      {name}
    </button>
  );
}

/* ---------------- editor primitives ---------------- */
function Row({ label, children }) {
  return (<div className="flex items-center gap-2"><label className="text-sm text-gray-500 w-[78px] shrink-0">{label}</label><div className="flex-1 min-w-0">{children}</div></div>);
}
function Num({ value, onChange, bare }) {
  const [v, setV] = useState(value ?? ''); const f = useRef(false);
  useEffect(() => { if (!f.current) setV(value ?? ''); }, [value]);
  const commit = (x) => onChange(String(x).trim());
  return <input value={v} onFocus={() => { f.current = true; }} onChange={(e) => setV(e.target.value)} onBlur={() => { f.current = false; commit(v); }}
    onKeyDown={(e) => { if (e.key === 'Enter') { commit(v); e.target.blur(); return; } if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const n = (parseFloat(v) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1); setV(String(n)); commit(String(n)); } }}
    className={INPUT} placeholder={bare ? '0' : '—'} />;
}
function UnitNum({ value, unit, units, onValue, onUnit }) {
  const [v, setV] = useState(value ?? ''); const f = useRef(false);
  useEffect(() => { if (!f.current) setV(value ?? ''); }, [value]);
  const commit = (x) => onValue(String(x).trim());
  return (
    <div className="flex gap-1.5">
      <input value={v} onFocus={() => { f.current = true; }} onChange={(e) => setV(e.target.value)} onBlur={() => { f.current = false; commit(v); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { commit(v); e.target.blur(); return; } if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const n = Math.round(((parseFloat(v) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 0.01)) * 1000) / 1000; setV(String(n)); commit(String(n)); } }}
        className="flex-1 min-w-0 bg-gray-100 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#473AE0]/40" />
      <div className="relative w-[68px] shrink-0">
        <select value={unit || ''} onChange={(e) => onUnit(e.target.value)} className="w-full appearance-none bg-gray-100 rounded-lg pl-2.5 pr-6 py-1.5 text-sm text-gray-700 outline-none">
          {units.map((u) => <option key={u} value={u}>{u === '' ? '—' : u}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}
function Sel({ value, options, onChange }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} appearance-none pr-7`}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}
// Rich colour picker (HSV + hex + alpha + eyedropper + colour tokens).
function Color({ value, onChange, colors, onNewColor }) {
  return <ColorPicker value={value} onChange={onChange} colors={colors} onNewColor={onNewColor} />;
}
function Toggle({ on, onClick, label, bold, italic }) {
  return <button onClick={onClick} className={`w-9 h-8 rounded-md text-sm ${on ? 'bg-[#473AE0] text-white' : 'bg-gray-100 text-gray-500'} ${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''}`}>{label}</button>;
}
