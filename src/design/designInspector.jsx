/* ------------------------------------------------------------------ */
/*  Design module inspector: element controls, field configs, modals.  */
/*  Prop-driven — split out of DesignEditor.                            */
/* ------------------------------------------------------------------ */
import React, { useState, useRef, useEffect } from 'react';
import {
  Trash2, Copy, ChevronUp, ChevronDown, ChevronRight, ChevronDown as Caret, X,
  MousePointer2, Square, Pencil, Plus, Minus, Search, Home, PlusCircle, MinusCircle, MoreHorizontal,
  Check, MoveHorizontal, MoveVertical, Maximize2, AlignLeft, AlignCenter, AlignRight,
  Hand, Pointer, Move, Crosshair, ZoomIn, ZoomOut, Ban, TextCursor, Grab, HelpCircle, Hourglass,
} from 'lucide-react';
import { FillControl, ColorPicker } from './fillControl';
import { textStyleSummary } from './designStyles';
import {
  ALIGNS, ALIGN_ICONS, INPUT, EDIT_STYLE_ID, MODAL_INPUT, cssNum, withUnit,
  bumpValue, FILTER_FNS, parseFilter, buildFilter, ANIM_DEFAULT, parseAnim,
  parseTransform, buildTransform,
} from './designConsts';

export function attrStr(el) { let s = ''; for (const a of Array.from(el.attributes || [])) s += ` ${a.name}="${String(a.value).replace(/"/g, '&quot;')}"`; return s; }

/* ============================ Inspector ============================ */
export function Inspector({ el, win, title, onTitle, pages, colors, onNewColor, textStyles, appliedTextId, onApplyText, onNewTextStyle, onStyle, onText, onAttr, onLink, onLinkTarget, onMoveUp, onMoveDown, onDuplicate, onDelete, onDeselect }) {
  // optional style rows the user has explicitly added this session
  const [extra, setExtra] = useState(() => new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [addQ, setAddQ] = useState('');
  const [stylesMenuPos, setStylesMenuPos] = useState(null);
  const [stylesOpenTick, setStylesOpenTick] = useState(0);
  const openStylesAdd = (rect) => { if (rect) setStylesMenuPos({ left: Math.max(8, rect.right - 240), top: rect.bottom + 6 }); setAddOpen((v) => !v); setAddQ(''); };

  if (!el) {
    return (
      <div className="w-80 shrink-0 bg-white border-l border-gray-200 overflow-y-auto overflow-x-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Page</div>
          <label className="text-xs text-gray-500">Title</label>
          <input value={title} onChange={(e) => onTitle(e.target.value)} className={`mt-1 ${INPUT}`} />
        </div>
        <div className="p-6 text-center text-gray-400">
          <MousePointer2 size={24} className="mx-auto mb-2 text-gray-300" />
          <div className="text-sm">Click any element on the page to edit it.</div>
          <div className="text-xs mt-2 text-gray-400">Double-click to edit text · drag the selected block to reorder.</div>
        </div>
      </div>
    );
  }

  const cs = (win && win.getComputedStyle) ? win.getComputedStyle(el) : {};
  const inline = el.style;
  const getv = (prop) => cssNum(inline.getPropertyValue(prop));
  const comp = (prop) => (cs && cs.getPropertyValue ? cs.getPropertyValue(prop) : '');
  const tag = el.tagName.toLowerCase();
  const isBodyEl = tag === 'body' || tag === 'html'; // page root — show only global style controls
  const isLeaf = el.children.length === 0;
  const isImg = tag === 'img';
  const ctx = { getv, comp, onStyle, onAttr, el, colors, onNewColor, textStyles, appliedTextId, onApplyText, onNewTextStyle };

  // which optional rows are currently shown = explicitly added OR already has a value on the element
  const isActive = (key) => extra.has(key) || OPTIONAL_HAS[key]?.(ctx);
  const addStyle = (key) => { setExtra((s) => new Set(s).add(key)); setAddOpen(false); setAddQ(''); setStylesOpenTick((t) => t + 1); };
  const removeStyle = (key) => { OPTIONAL_CLEAR[key]?.(ctx); setExtra((s) => { const n = new Set(s); n.delete(key); return n; }); };

  const activeKeys = OPTIONAL_ORDER.filter(isActive);

  return (
    <div className="w-80 shrink-0 bg-white border-l border-gray-200 overflow-y-auto overflow-x-hidden">
      {/* header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono bg-indigo-50 text-[#473AE0] rounded px-1.5 py-0.5">{tag}</span>
          {el.className && typeof el.className === 'string' && el.className.trim() && <span className="text-[11px] text-gray-400 truncate">.{el.className.trim().split(/\s+/)[0]}</span>}
        </div>
        <button onClick={onDeselect} className="w-6 h-6 rounded hover:bg-gray-100 text-gray-400 flex items-center justify-center"><X size={14} /></button>
      </div>
      {/* quick actions — hidden for the page root (can't move/duplicate/delete the page) */}
      {!isBodyEl && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100">
          <ActBtn onClick={onMoveUp} title="Move up"><ChevronUp size={16} /></ActBtn>
          <ActBtn onClick={onMoveDown} title="Move down"><ChevronDown size={16} /></ActBtn>
          <ActBtn onClick={onDuplicate} title="Duplicate"><Copy size={15} /></ActBtn>
          <div className="flex-1" />
          <ActBtn onClick={onDelete} title="Delete" danger><Trash2 size={15} /></ActBtn>
        </div>
      )}
      {isBodyEl
        ? <div className="flex items-center gap-1.5 px-4 py-2 text-[11px] text-gray-500 bg-indigo-50/60"><Square size={12} className="text-[#473AE0]" /> Page root — edits here apply globally to the whole page.</div>
        : <div className="flex items-center gap-1.5 px-4 py-2 text-[11px] text-gray-400 bg-gray-50/60"><Pencil size={12} /> Double-click on the page to edit text inline.</div>}

      {/* content — text & image */}
      {(isLeaf || isImg) && (
        <Section title="Content" defaultOpen>
          {isLeaf && !isImg && (
            <RowCol label="Text"><textarea defaultValue={el.textContent} onBlur={(e) => onText(e.target.value)} rows={3} className={`${INPUT} resize-none`} /></RowCol>
          )}
          {isImg && (<>
            <RowCol label="Image URL"><input defaultValue={el.getAttribute('src') || ''} onBlur={(e) => onAttr('src', e.target.value)} className={INPUT} /></RowCol>
            <RowCol label="Alt text"><input defaultValue={el.getAttribute('alt') || ''} onBlur={(e) => onAttr('alt', e.target.value)} className={INPUT} /></RowCol>
          </>)}
        </Section>
      )}

      {/* link — works on any element; wraps non-anchors (e.g. an image) in an <a>. Not for the page root. */}
      {!isBodyEl && <LinkSection el={el} pages={pages} onLink={onLink} onLinkTarget={onLinkTarget} />}

      <EditSection title="Text" fields={FIELDS.Typography} ctx={ctx} />
      <EditSection title="Border" fields={FIELDS.Border} ctx={ctx} />
      <PositionSection ctx={ctx} />
      <EditSection title="Size" fields={FIELDS.Size} ctx={ctx} />
      <EditSection title="Layout" fields={FIELDS.Layout} ctx={ctx} />
      <EditSection title="Effects" fields={FIELDS.Effects} ctx={ctx} />
      <ScrollAnimSection ctx={ctx} />
      <EditSection title="Cursor" fields={FIELDS.Cursor} ctx={ctx} />

      {/* dynamic styles (add / remove) */}
      <Section title="Styles" defaultOpen onAdd={openStylesAdd} openSignal={stylesOpenTick}>
        {activeKeys.length === 0 && <div className="text-sm text-gray-400 py-1">No extra styles yet — tap <Plus size={13} className="inline -mt-0.5" /> to add one.</div>}
        {activeKeys.map((k) => (
          <div key={k} className="flex items-center gap-2 mb-2.5">
            <button onClick={() => removeStyle(k)} title="Remove style" className="shrink-0 text-[#473AE0] hover:text-red-500"><MinusCircle size={17} /></button>
            <label className="text-sm text-gray-500 w-[74px] shrink-0">{OPTIONAL_LABEL[k]}</label>
            <div className="flex-1 min-w-0">{OPTIONAL_RENDER[k](ctx)}</div>
          </div>
        ))}
      </Section>
      {addOpen && stylesMenuPos && (<>
        <div className="fixed inset-0 z-[60]" onMouseDown={() => setAddOpen(false)} />
        <div style={{ position: 'fixed', left: stylesMenuPos.left, top: stylesMenuPos.top, width: 240 }} className="z-[61] bg-white rounded-xl shadow-2xl border border-gray-100 p-2 max-h-80 overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 mb-1.5"><Search size={13} className="text-gray-400" /><input autoFocus value={addQ} onChange={(e) => setAddQ(e.target.value)} placeholder="Type to search…" className="flex-1 bg-transparent py-1.5 text-sm outline-none" /></div>
          {ADD_GROUPS.map(([group, keys]) => {
            const items = keys.filter((k) => OPTIONAL_LABEL[k].toLowerCase().includes(addQ.toLowerCase()));
            if (!items.length) return null;
            return (
              <div key={group}>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 pt-1.5 pb-0.5">{group}</div>
                {items.map((k) => { const on = isActive(k); return (
                  <button key={k} onClick={() => (on ? removeStyle(k) : addStyle(k))} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm text-gray-700 text-left">
                    {on ? <MinusCircle size={15} className="text-[#473AE0] shrink-0" /> : <PlusCircle size={15} className="text-gray-400 shrink-0" />} {OPTIONAL_LABEL[k]}
                  </button>
                ); })}
              </div>
            );
          })}
        </div>
      </>)}

      <EditSection title="Transforms" fields={FIELDS.Transforms} ctx={ctx} />
      <EditSection title="Selection" fields={FIELDS.Selection} ctx={ctx} />
      <EditSection title="Scroll Section" fields={FIELDS.ScrollSelection} ctx={ctx} />
      <EditSection title="Accessibility" fields={FIELDS.Accessibility} ctx={ctx} />
    </div>
  );
}

/* ============================ Link ============================ */
// Link section: pick an internal page or type a URL, plus a "new tab" toggle.
function LinkSection({ el, pages, onLink, onLinkTarget }) {
  const parent = el.parentElement;
  const linkEl = el.tagName === 'A' ? el : (parent && parent.tagName === 'A' ? parent : null);
  const href = linkEl ? (linkEl.getAttribute('href') || '') : '';
  const newTab = linkEl ? (linkEl.getAttribute('target') === '_blank') : false;
  return (
    <Section title="Link" defaultOpen>
      <div className="flex items-center gap-2 mb-2.5">
        {href
          ? <button onClick={() => onLink('')} title="Remove link" className="shrink-0 text-[#473AE0] hover:text-red-500"><MinusCircle size={17} /></button>
          : <span className="w-[17px] shrink-0" />}
        <label className="text-sm text-gray-500 w-[64px] shrink-0">Link To</label>
        <div className="flex-1 min-w-0"><LinkPicker value={href} pages={pages} onChange={onLink} /></div>
      </div>
      {linkEl && (
        <div className="flex items-center gap-2">
          <span className="w-[17px] shrink-0" />
          <label className="text-sm text-gray-500 w-[64px] shrink-0">New Tab</label>
          <div className="flex-1 min-w-0"><Pills value={newTab ? 'y' : 'n'} options={[['y', 'Yes'], ['n', 'No']]} onChange={(v) => onLinkTarget(v === 'y')} /></div>
        </div>
      )}
    </Section>
  );
}

// Combobox: on focus shows every page in the project; pick one or type a custom URL/anchor.
function LinkPicker({ value, pages, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [typing, setTyping] = useState(false);
  const ref = useRef(null);
  const list = (pages || []);
  const matched = list.find((p) => p.path === value);
  const display = typing ? q : (matched ? (matched.title || matched.path) : value);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setTyping(false); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const commit = (v) => { if ((v || '') !== (value || '')) onChange(v); setOpen(false); setTyping(false); };
  const filtered = list.filter((p) => {
    if (!q) return true;
    const s = (p.title || '') + ' ' + p.path;
    return s.toLowerCase().includes(q.toLowerCase());
  });
  return (
    <div className="relative" ref={ref}>
      <input value={display} placeholder="Page or URL…"
        onFocus={() => { setTyping(true); setQ(value || ''); setOpen(true); }}
        onChange={(e) => { setTyping(true); setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { commit(q); e.target.blur(); } else if (e.key === 'Escape') { setOpen(false); setTyping(false); e.target.blur(); } }}
        onBlur={() => { if (typing) commit(q); }}
        className={INPUT} />
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-30 max-h-64 overflow-y-auto">
          {filtered.length === 0 && list.length === 0 && <div className="text-xs text-gray-400 px-2 py-1.5">No other pages — type a URL.</div>}
          {filtered.map((p) => (
            <button key={p.path} onMouseDown={(e) => { e.preventDefault(); commit(p.path); }} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm text-left ${p.path === value ? 'bg-indigo-50' : ''}`}>
              <Square size={11} className="text-blue-300 shrink-0" />
              <span className="truncate flex-1 text-gray-700">{p.title || p.path}</span>
              <span className="text-[11px] text-gray-400 truncate max-w-[90px]">{p.path}</span>
            </button>
          ))}
          {q && !list.some((p) => p.path === q) && (
            <button onMouseDown={(e) => { e.preventDefault(); commit(q); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm text-left text-[#473AE0]">
              Use “{q}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- optional (add/remove) style registry ---------- */
const selOpts = (opts) => opts.map(([v, l]) => [v, l]);
const OVERFLOW_OPTS = selOpts([['', 'default'], ['visible', 'visible'], ['hidden', 'hidden'], ['scroll', 'scroll'], ['auto', 'auto'], ['clip', 'clip']]);
const BLEND_OPTS = selOpts([['', 'normal'], ['multiply', 'multiply'], ['screen', 'screen'], ['overlay', 'overlay'], ['darken', 'darken'], ['lighten', 'lighten'], ['color-dodge', 'color-dodge'], ['difference', 'difference'], ['exclusion', 'exclusion']]);
const SELECT_OPTS = selOpts([['', 'default'], ['auto', 'auto'], ['none', 'none'], ['text', 'text'], ['all', 'all']]);

const OPTIONAL_LABEL = {
  opacity: 'Opacity', 'background-color': 'Fill', 'box-shadow': 'Shadow', 'mix-blend-mode': 'Blending', backdrop: 'BG Blur',
  overflow: 'Overflow', 'overflow-x': 'Overflow X', 'overflow-y': 'Overflow Y',
  visible: 'Visible', draggable: 'Draggable', 'user-select': 'Selection',
};
FILTER_FNS.forEach((f) => { OPTIONAL_LABEL['f-' + f.fn] = f.label; });

const OPTIONAL_ORDER = ['opacity', 'background-color', 'box-shadow', 'mix-blend-mode', 'backdrop', 'overflow', 'overflow-x', 'overflow-y', 'visible', 'draggable', 'user-select', ...FILTER_FNS.map((f) => 'f-' + f.fn)];

const ADD_GROUPS = [
  ['Appearance', ['opacity', 'background-color', 'box-shadow', 'mix-blend-mode', 'backdrop']],
  ['Layout', ['overflow', 'overflow-x', 'overflow-y']],
  ['Behavior', ['visible', 'draggable', 'user-select']],
  ['Filters', FILTER_FNS.map((f) => 'f-' + f.fn)],
];

const hasInline = (ctx, prop) => !!ctx.getv(prop);
const OPTIONAL_HAS = {
  opacity: (c) => hasInline(c, 'opacity'),
  'background-color': (c) => hasInline(c, 'background-color') || hasInline(c, 'background'),
  'box-shadow': (c) => hasInline(c, 'box-shadow'),
  'mix-blend-mode': (c) => hasInline(c, 'mix-blend-mode'),
  backdrop: (c) => hasInline(c, 'backdrop-filter') || hasInline(c, '-webkit-backdrop-filter'),
  overflow: (c) => hasInline(c, 'overflow'),
  'overflow-x': (c) => hasInline(c, 'overflow-x'),
  'overflow-y': (c) => hasInline(c, 'overflow-y'),
  visible: (c) => c.getv('display') === 'none',
  draggable: (c) => c.el.getAttribute('draggable') === 'true' || c.el.getAttribute('draggable') === 'false',
  'user-select': (c) => hasInline(c, 'user-select'),
};
FILTER_FNS.forEach((f) => { OPTIONAL_HAS['f-' + f.fn] = (c) => (f.fn in parseFilter(c.getv('filter'))); });

const OPTIONAL_CLEAR = {
  opacity: (c) => c.onStyle('opacity', ''),
  'background-color': (c) => { c.onStyle('background-color', ''); c.onStyle('background', ''); },
  'box-shadow': (c) => c.onStyle('box-shadow', ''),
  'mix-blend-mode': (c) => c.onStyle('mix-blend-mode', ''),
  backdrop: (c) => { c.onStyle('backdrop-filter', ''); c.onStyle('-webkit-backdrop-filter', ''); },
  overflow: (c) => c.onStyle('overflow', ''),
  'overflow-x': (c) => c.onStyle('overflow-x', ''),
  'overflow-y': (c) => c.onStyle('overflow-y', ''),
  visible: (c) => c.onStyle('display', ''),
  draggable: (c) => c.onAttr('draggable', ''),
  'user-select': (c) => c.onStyle('user-select', ''),
};
FILTER_FNS.forEach((f) => { OPTIONAL_CLEAR['f-' + f.fn] = (c) => { const m = parseFilter(c.getv('filter')); delete m[f.fn]; c.onStyle('filter', buildFilter(m)); }; });

const OPTIONAL_RENDER = {
  opacity: (c) => <SliderNum value={c.getv('opacity') || c.comp('opacity')} min={0} max={1} step={0.01} onChange={(v) => c.onStyle('opacity', v)} />,
  'background-color': (c) => <FillControl value={c.getv('background') || c.getv('background-color')} colors={c.colors} onNewColor={c.onNewColor} onChange={(v) => { c.onStyle('background-color', ''); c.onStyle('background', v); }} />,
  'box-shadow': (c) => <input value={c.getv('box-shadow')} placeholder="0 6px 18px rgba(0,0,0,.12)" onChange={(e) => c.onStyle('box-shadow', e.target.value)} className={INPUT} />,
  'mix-blend-mode': (c) => <Dropdown value={c.getv('mix-blend-mode')} onChange={(v) => c.onStyle('mix-blend-mode', v)} options={BLEND_OPTS} />,
  backdrop: (c) => <SliderNum value={parseInt(c.getv('backdrop-filter'), 10) || 0} min={0} max={30} step={1} onChange={(v) => { const px = `blur(${v}px)`; c.onStyle('backdrop-filter', px); c.onStyle('-webkit-backdrop-filter', px); }} />,
  overflow: (c) => <Dropdown value={c.getv('overflow')} onChange={(v) => c.onStyle('overflow', v)} options={OVERFLOW_OPTS} />,
  'overflow-x': (c) => <Dropdown value={c.getv('overflow-x')} onChange={(v) => c.onStyle('overflow-x', v)} options={OVERFLOW_OPTS} />,
  'overflow-y': (c) => <Dropdown value={c.getv('overflow-y')} onChange={(v) => c.onStyle('overflow-y', v)} options={OVERFLOW_OPTS} />,
  visible: (c) => <Pills value={c.getv('display') === 'none' ? 'no' : 'yes'} options={[['yes', 'Yes'], ['no', 'No']]} onChange={(v) => c.onStyle('display', v === 'no' ? 'none' : '')} />,
  draggable: (c) => <Pills value={c.el.getAttribute('draggable') === 'true' ? 'yes' : 'no'} options={[['yes', 'Yes'], ['no', 'No']]} onChange={(v) => c.onAttr('draggable', v === 'yes' ? 'true' : 'false')} />,
  'user-select': (c) => <Dropdown value={c.getv('user-select')} onChange={(v) => c.onStyle('user-select', v)} options={SELECT_OPTS} />,
};
FILTER_FNS.forEach((f) => {
  OPTIONAL_RENDER['f-' + f.fn] = (c) => {
    const m = parseFilter(c.getv('filter'));
    const cur = parseFloat(m[f.fn]) || 0;
    return <SliderNum value={cur} min={0} max={f.max} step={1} onChange={(v) => { const nm = parseFilter(c.getv('filter')); nm[f.fn] = `${v}${f.unit}`; c.onStyle('filter', buildFilter(nm)); }} />;
  };
});

/* ============================ Layers ============================ */
export function Layers({ getDoc, selectedEl, onSelect, onReorder, onRename, pages, page, onPage, assetsContent, onCtxMenu, onNewPage, pageActions }) {
  const [tab, setTab] = useState('layers');
  const [over, setOver] = useState({});
  const [drop, setDrop] = useState(null);
  const [q, setQ] = useState('');
  const [editEl, setEditEl] = useState(null); // element being renamed inline
  const [editVal, setEditVal] = useState('');
  const dragElRef = useRef(null);
  const selRowRef = useRef(null);
  const doc = getDoc();
  const body = doc && doc.body;
  const okEl = (el) => el && el.nodeType === 1 && !['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'BR'].includes(el.tagName) && el.id !== EDIT_STYLE_ID && el.id !== '__dz_resize';
  // Friendly type name (Frame / Stack / Grid / Heading / Image …) instead of the raw tag.
  const niceName = (el) => {
    const tag = el.tagName.toLowerCase();
    const MAP = { h1: 'Heading', h2: 'Heading', h3: 'Heading', h4: 'Heading', h5: 'Heading', h6: 'Heading', p: 'Text', a: 'Link', button: 'Button', img: 'Image', picture: 'Image', svg: 'Icon', video: 'Video', ul: 'List', ol: 'List', li: 'List Item', input: 'Input', textarea: 'Input', select: 'Input', form: 'Form', header: 'Header', footer: 'Footer', nav: 'Nav', section: 'Section', article: 'Article', aside: 'Aside', main: 'Main', figure: 'Figure', span: 'Text', label: 'Label', table: 'Table' };
    if (MAP[tag]) return MAP[tag];
    if (tag === 'div' || tag === 'a') {
      const win = el.ownerDocument && el.ownerDocument.defaultView;
      const disp = (win ? win.getComputedStyle(el).display : (el.style.display || '')) || '';
      if (/grid/.test(disp)) return 'Grid';
      if (/flex/.test(disp)) return 'Stack';
      return 'Frame';
    }
    return tag.charAt(0).toUpperCase() + tag.slice(1);
  };
  const label = (el) => {
    const nm = el.getAttribute && el.getAttribute('data-dz-name');
    if (nm) return nm;
    const base = niceName(el);
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    const wantsText = /^(Heading|Text|Link|Button|Label|List Item)$/.test(base);
    const hasElKids = Array.from(el.children).some(okEl);
    if (txt && (wantsText || !hasElKids)) return `${base} · ${txt}`;
    return base;
  };
  const startEdit = (el) => { setEditEl(el); setEditVal((el.getAttribute && el.getAttribute('data-dz-name')) || label(el)); };
  const commitEdit = () => { if (editEl && onRename) onRename(editEl, editVal); setEditEl(null); };
  // When an element is selected (e.g. by clicking it on the canvas), expand every ancestor in the
  // tree so the selected row is revealed, then scroll it into view.
  useEffect(() => {
    const d = getDoc(); const b = d && d.body;
    if (!selectedEl || !b) return;
    const ok = (el) => el && el.nodeType === 1 && !['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'BR'].includes(el.tagName) && el.id !== EDIT_STYLE_ID && el.id !== '__dz_resize';
    const chain = []; let cur = selectedEl;
    while (cur && cur !== b && cur.parentElement) { const idx = Array.from(cur.parentElement.children).filter(ok).indexOf(cur); if (idx < 0) { cur = null; break; } chain.unshift(idx); cur = cur.parentElement; }
    if (cur !== b || !chain.length) return;
    let p = 'r' + chain[0]; const paths = [p];
    for (let i = 1; i < chain.length; i++) { p += '/' + chain[i]; paths.push(p); }
    setOver((o) => { const n = { ...o }; paths.forEach((x) => { n[x] = true; }); return n; });
    const t = setTimeout(() => { if (selRowRef.current) { try { selRowRef.current.scrollIntoView({ block: 'nearest' }); } catch (e) {} } }, 40);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEl]);
  const toggle = (p) => setOver((o) => ({ ...o, [p]: !(p in o ? o[p] : false) }));
  const zoneOf = (e, el) => {
    const r = e.currentTarget.getBoundingClientRect(); const y = e.clientY - r.top;
    const kids = Array.from(el.children).filter(okEl);
    if (kids.length) { if (y < r.height * 0.3) return 'before'; if (y > r.height * 0.7) return 'after'; return 'inside'; }
    return y < r.height / 2 ? 'before' : 'after';
  };
  const node = (el, path, depth) => {
    if (!okEl(el)) return null;
    if (q && !label(el).toLowerCase().includes(q.toLowerCase()) && !Array.from(el.querySelectorAll('*')).some((c) => okEl(c) && label(c).toLowerCase().includes(q.toLowerCase()))) return null;
    const kids = Array.from(el.children).filter(okEl);
    const hasKids = kids.length > 0;
    const open = (path in over ? over[path] : depth < 1) || !!q;
    const isSel = el === selectedEl;
    const di = drop && drop.path === path ? drop.pos : null;
    return (
      <div key={path}>
        <div draggable ref={isSel ? selRowRef : undefined}
          onDragStart={(e) => { dragElRef.current = el; e.stopPropagation(); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', path); } catch (er) {} }}
          onDragOver={(e) => { if (!dragElRef.current || dragElRef.current === el || dragElRef.current.contains(el)) return; e.preventDefault(); setDrop({ path, pos: zoneOf(e, el) }); }}
          onDragLeave={() => setDrop((d) => (d && d.path === path ? null : d))}
          onDrop={(e) => { e.preventDefault(); const dragEl = dragElRef.current; const pos = zoneOf(e, el); dragElRef.current = null; setDrop(null); if (dragEl) { onReorder(dragEl, el, pos); if (pos === 'inside') setOver((o) => ({ ...o, [path]: true })); } }}
          onDragEnd={() => { dragElRef.current = null; setDrop(null); }}
          onClick={() => onSelect(el)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(el); onCtxMenu && onCtxMenu(el, e.clientX, e.clientY); }} style={{ paddingLeft: depth * 12 + 6 }}
          className={`relative flex items-center gap-1 h-7 rounded-md cursor-pointer text-[13px] ${isSel ? 'bg-indigo-50 text-[#473AE0] font-medium' : 'text-gray-600 hover:bg-gray-50'} ${di === 'inside' ? 'ring-1 ring-[#473AE0] ring-inset' : ''}`}>
          {di === 'before' && <span className="absolute left-1 right-1 -top-px h-0.5 bg-[#473AE0] rounded" />}
          {di === 'after' && <span className="absolute left-1 right-1 -bottom-px h-0.5 bg-[#473AE0] rounded" />}
          {hasKids ? <button onClick={(e) => { e.stopPropagation(); toggle(path); }} className="w-4 h-4 flex items-center justify-center text-gray-400 shrink-0">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button> : <span className="w-4 shrink-0" />}
          <Square size={11} className={`shrink-0 ${isSel ? 'text-[#473AE0]' : 'text-blue-300'}`} />
          {editEl === el ? (
            <input autoFocus value={editVal}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setEditVal(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(); } else if (e.key === 'Escape') { setEditEl(null); } }}
              className="flex-1 min-w-0 bg-white border border-[#473AE0] rounded px-1 py-0.5 text-[13px] text-gray-800 outline-none" />
          ) : (
            <span className="truncate" onDoubleClick={(e) => { e.stopPropagation(); startEdit(el); }} title="Double-click to rename">{label(el)}</span>
          )}
        </div>
        {hasKids && open && kids.map((k, i) => node(k, path + '/' + i, depth + 1))}
      </div>
    );
  };
  const TAB = (k, l) => <button onClick={() => setTab(k)} className={`px-2 py-1 text-[13px] rounded-md ${tab === k ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-400 hover:text-gray-600'}`}>{l}</button>;
  return (
    <div className="w-64 shrink-0 bg-white border-r border-gray-200 overflow-y-auto flex flex-col">
      <div className="sticky top-0 bg-white z-10">
        <div className="flex items-center gap-1 px-3 pt-3">{TAB('pages', 'Pages')}{TAB('layers', 'Layers')}{TAB('assets', 'Assets')}</div>
        <div className="px-3 pt-2"><div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2.5 py-2 text-gray-500"><Home size={14} /><span className="text-[13px] truncate flex-1">{(pages.find((p) => p.path === page) || {}).title || 'Home'}</span><Caret size={13} /></div></div>
        {tab === 'layers' && <div className="px-3 pt-2 pb-1"><div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2.5"><Search size={13} className="text-gray-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="flex-1 bg-transparent py-1.5 text-[13px] outline-none" /></div></div>}
        <div className="border-b border-gray-100 mt-1" />
      </div>
      <div className="p-1.5 flex-1">
        {tab === 'layers' && (body ? (<>
          {/* Page root — select BODY to edit page-global styles. Children render nested under it. */}
          <div
            onClick={() => onSelect(body)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(body); onCtxMenu && onCtxMenu(body, e.clientX, e.clientY); }}
            style={{ paddingLeft: 6 }}
            className={`flex items-center gap-1 h-7 rounded-md cursor-pointer text-[13px] ${body === selectedEl ? 'bg-indigo-50 text-[#473AE0] font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
            <span className="w-4 shrink-0" />
            <Home size={12} className={`shrink-0 ${body === selectedEl ? 'text-[#473AE0]' : 'text-gray-400'}`} />
            <span className="truncate">Page (Body)</span>
          </div>
          {Array.from(body.children).filter(okEl).map((c, i) => node(c, 'r' + i, 1))}
        </>) : <div className="text-xs text-gray-400 p-3">Loading…</div>)}
        {tab === 'pages' && (<>
          {onNewPage && <button onClick={onNewPage} className="w-full flex items-center gap-2 px-2.5 h-8 rounded-md text-[13px] text-[#473AE0] hover:bg-indigo-50 font-medium mb-1"><Plus size={14} /> New page</button>}
          {pages.length ? pages.map((p) => (
            <PageRow key={p.path} p={p} active={p.path === page} onOpen={() => onPage(p.path)} actions={pageActions} canDelete={pages.length > 1} />
          )) : <div className="text-xs text-gray-400 px-2.5 py-1">No pages yet.</div>}
        </>)}
        {tab === 'assets' && (assetsContent || <div className="text-xs text-gray-400 p-3">Images and files used by this page live in its version. Use Markup to attach files.</div>)}
      </div>
    </div>
  );
}

/* ============ generic add/remove section (every group works like Styles) ============ */
const POSITION_OPTS = [['', 'default'], ['static', 'static'], ['relative', 'relative'], ['absolute', 'absolute'], ['fixed', 'fixed'], ['sticky', 'sticky']];
const JUSTIFY_OPTS = [['', 'default'], ['flex-start', 'Start'], ['center', 'Center'], ['flex-end', 'End'], ['space-between', 'Space Between'], ['space-around', 'Space Around'], ['space-evenly', 'Space Evenly']];
const WEIGHT_OPTS = [['', 'default'], ['300', '300'], ['400', '400'], ['500', '500'], ['600', '600'], ['700', '700'], ['800', '800']];
const TRANSFORM_OPTS = [['', 'default'], ['none', 'none'], ['uppercase', 'UPPER'], ['lowercase', 'lower'], ['capitalize', 'Capitalize']];
const DECOR_OPTS = [['', 'default'], ['none', 'none'], ['underline', 'underline'], ['line-through', 'line-through']];
const BORDERSTYLE_OPTS = [['', 'default'], ['solid', 'solid'], ['dashed', 'dashed'], ['dotted', 'dotted'], ['none', 'none']];
const CURSORS = [
  ['default', 'Default', MousePointer2], ['pointer', 'Pointer', Pointer], ['wait', 'Wait', Hourglass],
  ['progress', 'Progress', Hourglass], ['not-allowed', 'Not allowed', Ban], ['text', 'Text', TextCursor],
  ['grab', 'Grab', Hand], ['grabbing', 'Grabbing', Grab], ['crosshair', 'Crosshair', Crosshair],
  ['cell', 'Cell', Plus], ['copy', 'Copy', Copy], ['move', 'Move', Move],
  ['zoom-in', 'Zoom in', ZoomIn], ['zoom-out', 'Zoom out', ZoomOut], ['help', 'Help', HelpCircle],
  ['context-menu', 'Context', MousePointer2], ['no-drop', 'No drop', Ban], ['all-scroll', 'Scroll', Move],
  ['col-resize', 'Col resize', MoveHorizontal], ['row-resize', 'Row resize', MoveVertical], ['ew-resize', 'EW resize', MoveHorizontal],
  ['ns-resize', 'NS resize', MoveVertical], ['nwse-resize', 'NWSE resize', Maximize2], ['nesw-resize', 'NESW resize', Maximize2],
  ['none', 'None', Ban], ['auto', 'Auto', MousePointer2],
];
function CursorControl({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const popupRef = useRef(null);
  const cur = CURSORS.find((c) => c[0] === value) || CURSORS[0];
  const Cur = cur[2];
  const openMenu = () => { const r = btnRef.current && btnRef.current.getBoundingClientRect(); if (r) setPos({ left: Math.min(r.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 300), top: Math.min(r.bottom + 6, (typeof window !== 'undefined' ? window.innerHeight : 800) - 360) }); setOpen(true); };
  // Close on an outside click — but NOT a click inside the iframe (different document), so you can
  // hover the canvas to preview the cursor while the panel stays open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (popupRef.current && !popupRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  const startDrag = (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    const ox = e.clientX - pos.left, oy = e.clientY - pos.top;
    const mv = (ev) => setPos({ left: ev.clientX - ox, top: ev.clientY - oy });
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  };
  return (
    <>
      <button ref={btnRef} onClick={openMenu} className="w-full flex items-center gap-2 bg-gray-100 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-200/70">
        <Cur size={15} className="text-gray-500 shrink-0" />
        <span className="flex-1 text-left truncate">{cur[1]}</span><Caret size={13} className="text-gray-400 shrink-0" />
      </button>
      {open && pos && (
        <div ref={popupRef} style={{ position: 'fixed', left: pos.left, top: pos.top, width: 288 }} className="z-[61] bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 max-h-[70vh] overflow-y-auto">
          <div onMouseDown={startDrag} className="flex items-center justify-between mb-2 cursor-move select-none">
            <span className="text-[15px] font-semibold text-gray-900">Cursor</span>
            <button onClick={() => setOpen(false)} className="w-6 h-6 rounded hover:bg-gray-100 text-gray-400 flex items-center justify-center"><X size={15} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CURSORS.map(([val, label, Icon]) => (
              <button key={val} onClick={() => { onChange(val); }} title={val} style={{ cursor: val }} className={`flex flex-col items-center justify-center gap-1 h-16 rounded-xl ${val === value ? 'ring-2 ring-[#473AE0] bg-white' : 'bg-gray-100 hover:bg-gray-200/70'}`}>
                <Icon size={18} className="text-gray-700" />
                <span className="text-[10px] text-gray-500 truncate max-w-[72px]">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
const fCursor = { key: 'cursor', label: 'Cursor', core: true, has: (c) => !!c.getv('cursor'), clear: (c) => c.onStyle('cursor', ''), render: (c) => <CursorControl value={c.getv('cursor')} onChange={(v) => c.onStyle('cursor', v)} /> };
const USERSELECT_OPTS = [['', 'default'], ['auto', 'auto'], ['none', 'none'], ['text', 'text'], ['all', 'all']];

const fNum = (prop, label, bare) => ({ key: prop, label, has: (c) => !!c.getv(prop), clear: (c) => c.onStyle(prop, ''), render: (c) => <NumInput value={c.getv(prop)} placeholder={c.comp(prop)} bare={bare} onChange={(v) => c.onStyle(prop, v)} /> });
const fColor = (prop, label) => ({ key: prop, label, has: (c) => !!c.getv(prop), clear: (c) => c.onStyle(prop, ''), render: (c) => <ColorControl value={c.getv(prop)} placeholder={c.comp(prop)} onChange={(v) => c.onStyle(prop, v)} colors={c.colors} onNewColor={c.onNewColor} /> });
// Apply one of the project's text styles to the selected element (adds a dz-text-<id> class).
const fTextStyle = { key: 'text-style', label: 'Styles', core: true, has: () => false, clear: (c) => c.onApplyText && c.onApplyText(''), render: (c) => <TextStylePicker styles={c.textStyles} appliedId={c.appliedTextId} onApply={c.onApplyText} onNew={c.onNewTextStyle} /> };
function TextStylePicker({ styles, appliedId, onApply, onNew }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const list = styles || [];
  const applied = list.find((s) => s.id === appliedId);
  const openMenu = () => { const r = ref.current && ref.current.getBoundingClientRect(); if (r) setPos({ left: Math.min(r.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 320), top: Math.min(r.bottom + 6, (typeof window !== 'undefined' ? window.innerHeight : 800) - 440) }); setOpen(true); setQ(''); };
  const filtered = list.filter((s) => !q || (s.name || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <button ref={ref} onClick={openMenu} className="w-full flex items-center gap-2 bg-gray-100 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-200/70">
        {applied ? (<>
          <span className="text-[11px] font-bold text-gray-700 min-w-[20px] text-center">{applied.tag ? applied.tag.toUpperCase() : 'A'}</span>
          <span className="flex-1 text-left truncate text-gray-700">{applied.name} <span className="text-gray-400">(L)</span></span>
          <span onClick={(e) => { e.stopPropagation(); onApply(''); }} className="text-gray-400 hover:text-red-500"><X size={14} /></span>
        </>) : (<><span className="flex-1 text-left text-gray-400">Choose a style…</span><Caret size={13} className="text-gray-400 shrink-0" /></>)}
      </button>
      {open && pos && (<>
        <div className="fixed inset-0 z-[60]" onMouseDown={() => setOpen(false)} />
        <div style={{ position: 'fixed', left: pos.left, top: pos.top, width: 300 }} className="z-[61] bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[70vh] flex flex-col overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100"><span className="text-[15px] font-semibold text-gray-900">Text Styles</span><button onClick={() => setOpen(false)} className="w-6 h-6 rounded hover:bg-gray-100 text-gray-400 flex items-center justify-center"><X size={15} /></button></div>
          <div className="px-3 pt-2"><div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2.5"><Search size={13} className="text-gray-400" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="flex-1 bg-transparent py-1.5 text-sm outline-none" /></div></div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {filtered.length === 0 && <div className="text-xs text-gray-400 px-2 py-2">No text styles yet.</div>}
            {filtered.map((s) => (
              <button key={s.id} onClick={() => { onApply(s.id); setOpen(false); }} className={`w-full flex items-center gap-2.5 h-9 px-2 rounded-lg ${s.id === appliedId ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                <span className="text-[12px] font-bold text-gray-700 min-w-[22px] text-center">{s.tag ? s.tag.toUpperCase() : 'A'}</span>
                <span className="flex-1 text-left text-[14px] text-gray-800 truncate">{s.name}</span>
                <span className="text-[12px] text-gray-400 tabular-nums">{textStyleSummary(s)}</span>
              </button>
            ))}
          </div>
          {onNew && <button onClick={() => { setOpen(false); onNew(); }} className="m-2 bg-gray-100 hover:bg-gray-200 rounded-lg py-2 text-sm text-gray-700">New Style</button>}
        </div>
      </>)}
    </>
  );
}
const fSel = (prop, label, options) => ({ key: prop, label, has: (c) => !!c.getv(prop), clear: (c) => c.onStyle(prop, ''), render: (c) => <Dropdown value={c.getv(prop)} onChange={(v) => c.onStyle(prop, v)} options={options} /> });
const fTextF = (prop, label, ph) => ({ key: prop, label, has: (c) => !!c.getv(prop), clear: (c) => c.onStyle(prop, ''), render: (c) => <TextField value={c.getv(prop)} placeholder={ph} onCommit={(v) => c.onStyle(prop, v)} /> });
const fPills = (prop, label, on, off) => ({ key: prop, label, has: (c) => !!c.getv(prop), clear: (c) => c.onStyle(prop, ''), render: (c) => <Pills value={c.getv(prop) === on ? 'a' : 'b'} options={[['a', 'Yes'], ['b', 'No']]} onChange={(v) => c.onStyle(prop, v === 'a' ? on : off)} /> });
const fBox = (key, label, sides) => ({ key, label, has: (c) => sides.some((p) => !!c.getv(p)), clear: (c) => sides.forEach((p) => c.onStyle(p, '')), render: (c) => <BoxInput sides={sides} ctx={c} /> });
const fAlign = { key: 'text-align', label: 'Align', has: (c) => !!c.getv('text-align'), clear: (c) => c.onStyle('text-align', ''), render: (c) => (
  <div className="flex gap-1">{ALIGNS.map((a) => { const Icon = ALIGN_ICONS[a]; const on = (c.getv('text-align') || c.comp('text-align')) === a; return <button key={a} onClick={() => c.onStyle('text-align', a)} className={`flex-1 py-1.5 rounded-md flex items-center justify-center ${on ? 'bg-indigo-50 text-[#473AE0]' : 'bg-gray-100 text-gray-500 hover:text-gray-700'}`}><Icon size={15} /></button>; })}</div>
) };
const fTruncate = { key: '-webkit-line-clamp', label: 'Truncate', has: (c) => !!c.getv('-webkit-line-clamp'), clear: (c) => { c.onStyle('-webkit-line-clamp', ''); c.onStyle('-webkit-box-orient', ''); }, render: (c) => <NumInput value={c.getv('-webkit-line-clamp')} placeholder="lines" bare onChange={(v) => { const n = parseInt(v, 10); if (n > 0) { c.onStyle('display', '-webkit-box'); c.onStyle('-webkit-box-orient', 'vertical'); c.onStyle('-webkit-line-clamp', String(n)); c.onStyle('overflow', 'hidden'); } else { c.onStyle('-webkit-line-clamp', ''); } }} /> };

// Size mode (Fixed/Fill/Fit) — sets width/height to ''(auto) / 100% / fit-content. Optional row.
// Layout type (Stack=flex / Grid). Shown by default (core), removable.
const fLayoutType = { key: 'layout-type', label: 'Type', core: true, has: () => false, clear: (c) => c.onStyle('display', ''), render: (c) => {
  const d = c.getv('display') || c.comp('display'); const mode = d === 'grid' ? 'grid' : 'stack';
  return <Pills value={mode} options={[['stack', 'Stack'], ['grid', 'Grid']]} onChange={(m) => c.onStyle('display', m === 'grid' ? 'grid' : 'flex')} />;
} };
// flex/grid sub-controls appear automatically when the element is a Stack/Grid (or already set).
const isStack = (c) => /(flex|grid|inline-flex)/.test(c.getv('display') || c.comp('display') || '');
const stackHas = (prop) => (c) => !!c.getv(prop) || isStack(c);
// flex/grid alignment props only take effect on a flex container — promote static elements first.
const ensureFlex = (c) => { if (!isStack(c)) c.onStyle('display', 'flex'); };
function IconToggle({ value, options, onChange }) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
      {options.map(([v, Icon, title]) => (
        <button key={v} title={title} onClick={() => onChange(v)} className={`flex-1 py-1.5 rounded-md flex items-center justify-center ${value === v ? 'bg-white shadow-sm border border-gray-200 text-[#473AE0]' : 'text-gray-400 hover:text-gray-600'}`}><Icon size={16} /></button>
      ))}
    </div>
  );
}
const fDirection = { key: 'flex-direction', label: 'Direction', has: stackHas('flex-direction'), clear: (c) => c.onStyle('flex-direction', ''), render: (c) => {
  const v = c.getv('flex-direction') || c.comp('flex-direction'); const cur = /column/.test(v) ? 'column' : 'row';
  return <IconToggle value={cur} options={[['row', MoveHorizontal, 'Row (horizontal)'], ['column', MoveVertical, 'Column (vertical)']]} onChange={(m) => { ensureFlex(c); c.onStyle('flex-direction', m); }} />;
} };
const fDistribute = { key: 'justify-content', label: 'Distribute', has: stackHas('justify-content'), clear: (c) => c.onStyle('justify-content', ''), render: (c) => <Dropdown value={c.getv('justify-content')} onChange={(v) => { ensureFlex(c); c.onStyle('justify-content', v); }} options={JUSTIFY_OPTS} /> };
const fAlignItems = { key: 'align-items', label: 'Align', has: stackHas('align-items'), clear: (c) => c.onStyle('align-items', ''), render: (c) => {
  const v = c.getv('align-items') || c.comp('align-items'); const cur = v === 'center' ? 'center' : ((v === 'flex-end' || v === 'end') ? 'flex-end' : 'flex-start');
  return <IconToggle value={cur} options={[['flex-start', AlignLeft, 'Start'], ['center', AlignCenter, 'Center'], ['flex-end', AlignRight, 'End']]} onChange={(m) => { ensureFlex(c); c.onStyle('align-items', m); }} />;
} };
const fWrapToggle = { key: 'flex-wrap', label: 'Wrap', has: stackHas('flex-wrap'), clear: (c) => c.onStyle('flex-wrap', ''), render: (c) => <Pills value={(c.getv('flex-wrap') || c.comp('flex-wrap')) === 'wrap' ? 'a' : 'b'} options={[['a', 'Yes'], ['b', 'No']]} onChange={(m) => { ensureFlex(c); c.onStyle('flex-wrap', m === 'a' ? 'wrap' : 'nowrap'); }} /> };
const fGapSlider = { key: 'gap', label: 'Gap', has: stackHas('gap'), clear: (c) => c.onStyle('gap', ''), render: (c) => <SliderNum value={parseFloat(c.getv('gap')) || parseFloat(c.comp('gap')) || 0} min={0} max={100} step={1} onChange={(v) => { ensureFlex(c); c.onStyle('gap', withUnit(String(v))); }} /> };
const fPadding = { key: 'padding', label: 'Padding', core: true, has: () => false, clear: (c) => ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'].forEach((p) => c.onStyle(p, '')), render: (c) => <PaddingControl ctx={c} /> };
// Size fields for EditSection (so they keep the add "+" / remove "−" behaviour). SizeRowControl/
// GrowControlInner are hoisted function declarations defined further down.
const fSizeCtl = (prop, label, modes, axis, core) => ({ key: prop, label, core: !!core, has: (c) => !!c.getv(prop), clear: (c) => c.onStyle(prop, ''), render: (c) => <SizeRowControl prop={prop} modes={modes} axis={axis} ctx={c} /> });
const fGrowCtl = { key: 'grow', label: 'Grow', core: true, has: (c) => c.getv('width') === '100%' || c.getv('height') === '100%', clear: (c) => { if (c.getv('width') === '100%') c.onStyle('width', ''); if (c.getv('height') === '100%') c.onStyle('height', ''); }, render: (c) => <GrowControlInner ctx={c} /> };

/* ---- Transforms: Scale / Skew / Rotate / Depth / Perspective all share the `transform` prop ---- */
const txParse = (c) => parseTransform(c.getv('transform') || '');
const txStrip = (raw) => (raw == null ? '' : String(raw).replace(/(deg|px|%)\s*$/i, '').trim());
const txWrite = (c, m) => c.onStyle('transform', buildTransform(m));
const txSet = (c, fn, val) => { const m = txParse(c); if (val === '' || val == null) delete m[fn]; else m[fn] = val; txWrite(c, m); };
const txSetU = (c, fn, raw, unit) => txSet(c, fn, raw === '' || raw == null ? '' : txStrip(raw) + unit);
const txDel = (c, fns) => { const m = txParse(c); fns.forEach((fn) => delete m[fn]); txWrite(c, m); };
function TxField({ label, value, suffix, placeholder, onChange }) {
  const [v, setV] = useState(value ?? '');
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setV(value ?? ''); }, [value]);
  const commit = (raw) => onChange(String(raw).trim());
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 flex-1 min-w-0">
      {label && <span className="text-[10px] font-semibold text-gray-400 shrink-0">{label}</span>}
      <input value={v} placeholder={placeholder}
        onFocus={() => { focused.current = true; }}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { focused.current = false; commit(v); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { commit(v); e.target.blur(); return; } if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const nv = String((parseFloat(v) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); setV(nv); commit(nv); } }}
        className="w-full min-w-0 bg-transparent py-1.5 text-sm text-gray-700 outline-none" />
      {suffix && <span className="text-[10px] text-gray-400 shrink-0">{suffix}</span>}
    </div>
  );
}
function TxScale({ ctx }) { const m = txParse(ctx); return <TxField value={txStrip(m.scale)} placeholder="1" onChange={(v) => txSet(ctx, 'scale', v === '' ? '' : txStrip(v))} />; }
function TxSkew({ ctx }) { const m = txParse(ctx); return (
  <div className="flex gap-1.5">
    <TxField label="X" suffix="°" value={txStrip(m.skewX)} placeholder="0" onChange={(v) => txSetU(ctx, 'skewX', v, 'deg')} />
    <TxField label="Y" suffix="°" value={txStrip(m.skewY)} placeholder="0" onChange={(v) => txSetU(ctx, 'skewY', v, 'deg')} />
  </div>
); }
function TxRotate({ ctx }) { const m = txParse(ctx); return (
  <div className="flex gap-1.5">
    <TxField label="X" suffix="°" value={txStrip(m.rotateX)} placeholder="0" onChange={(v) => txSetU(ctx, 'rotateX', v, 'deg')} />
    <TxField label="Y" suffix="°" value={txStrip(m.rotateY)} placeholder="0" onChange={(v) => txSetU(ctx, 'rotateY', v, 'deg')} />
    <TxField label="Z" suffix="°" value={txStrip(m.rotate)} placeholder="0" onChange={(v) => txSetU(ctx, 'rotate', v, 'deg')} />
  </div>
); }
function TxSingle({ ctx, fn, unit, placeholder }) { const m = txParse(ctx); return <TxField suffix={unit} value={txStrip(m[fn])} placeholder={placeholder} onChange={(v) => txSetU(ctx, fn, v, unit)} />; }
const ORIGIN_PTS = ['left top', 'center top', 'right top', 'left center', 'center center', 'right center', 'left bottom', 'center bottom', 'right bottom'];
function normOrigin(v) {
  if (!v) return 'center center';
  const parts = v.trim().toLowerCase().split(/\s+/);
  let x = parts[0] || 'center', y = parts[1] || 'center';
  if (x === 'top' || x === 'bottom') { const t = x; x = y === 'center' ? 'center' : y; y = t; } // "top left" order
  const fx = { '0%': 'left', '0px': 'left', '100%': 'right', '50%': 'center' };
  const fy = { '0%': 'top', '0px': 'top', '100%': 'bottom', '50%': 'center' };
  x = fx[x] || x; y = fy[y] || y;
  if (!['left', 'center', 'right'].includes(x)) x = 'center';
  if (!['top', 'center', 'bottom'].includes(y)) y = 'center';
  return `${x} ${y}`;
}
function OriginPicker({ value, onChange }) {
  const cur = normOrigin(value);
  return (
    <div className="grid grid-cols-3 gap-1 w-[96px]">
      {ORIGIN_PTS.map((pt) => { const on = cur === pt; return (
        <button key={pt} title={pt} onClick={() => onChange(pt)} className={`h-7 rounded-md flex items-center justify-center ${on ? 'bg-indigo-50 ring-1 ring-[#473AE0]' : 'bg-gray-100 hover:bg-gray-200/70'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-[#473AE0]' : 'bg-gray-300'}`} />
        </button>
      ); })}
    </div>
  );
}
const fScale = { key: 'tx-scale', label: 'Scale', has: (c) => txParse(c).scale != null, clear: (c) => txSet(c, 'scale', ''), render: (c) => <TxScale ctx={c} /> };
const fSkew = { key: 'tx-skew', label: 'Skew', has: (c) => { const m = txParse(c); return m.skewX != null || m.skewY != null; }, clear: (c) => txDel(c, ['skewX', 'skewY']), render: (c) => <TxSkew ctx={c} /> };
const fRotate = { key: 'tx-rotate', label: 'Rotate', has: (c) => { const m = txParse(c); return m.rotate != null || m.rotateX != null || m.rotateY != null; }, clear: (c) => txDel(c, ['rotate', 'rotateX', 'rotateY']), render: (c) => <TxRotate ctx={c} /> };
const fDepth = { key: 'tx-depth', label: 'Depth', has: (c) => txParse(c).translateZ != null, clear: (c) => txSet(c, 'translateZ', ''), render: (c) => <TxSingle ctx={c} fn="translateZ" unit="px" placeholder="0" /> };
const fPerspective = { key: 'tx-perspective', label: 'Perspective', has: (c) => txParse(c).perspective != null, clear: (c) => txSet(c, 'perspective', ''), render: (c) => <TxSingle ctx={c} fn="perspective" unit="px" placeholder="1200" /> };
const fOrigin = { key: 'transform-origin', label: 'Origin', has: (c) => !!c.getv('transform-origin'), clear: (c) => c.onStyle('transform-origin', ''), render: (c) => <OriginPicker value={c.getv('transform-origin') || c.comp('transform-origin')} onChange={(v) => c.onStyle('transform-origin', v)} /> };
const fBackface = { key: 'backface-visibility', label: 'Backface', has: (c) => !!c.getv('backface-visibility'), clear: (c) => c.onStyle('backface-visibility', ''), render: (c) => <Pills value={(c.getv('backface-visibility') || c.comp('backface-visibility')) === 'hidden' ? 'b' : 'a'} options={[['a', 'Visible'], ['b', 'Hidden']]} onChange={(v) => c.onStyle('backface-visibility', v === 'b' ? 'hidden' : 'visible')} /> };
const fPreserve3d = { key: 'transform-style', label: 'Preserve 3D', has: (c) => !!c.getv('transform-style'), clear: (c) => c.onStyle('transform-style', ''), render: (c) => <Pills value={(c.getv('transform-style') || c.comp('transform-style')) === 'preserve-3d' ? 'a' : 'b'} options={[['a', 'On'], ['b', 'Off']]} onChange={(v) => c.onStyle('transform-style', v === 'a' ? 'preserve-3d' : 'flat')} /> };

/* ---- Scroll Section: Name → element id (anchor target), Offset Y → scroll-margin-top ---- */
function AttrField({ el, attr, placeholder, onChange }) {
  const cur = (el.getAttribute(attr) || '');
  return <TextField value={cur} placeholder={placeholder} onCommit={onChange} />;
}
function StepperNum({ value, onChange }) {
  const [v, setV] = useState(String(value ?? 0));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setV(String(value ?? 0)); }, [value]);
  const commit = (raw) => { const n = parseFloat(raw); onChange(Number.isFinite(n) ? n : 0); };
  const bump = (d) => { const n = (parseFloat(v) || 0) + d; setV(String(n)); onChange(n); };
  return (
    <div className="flex items-center gap-1.5">
      <input value={v} onFocus={() => { focused.current = true; }} onChange={(e) => setV(e.target.value)} onBlur={() => { focused.current = false; commit(v); }} onKeyDown={(e) => { if (e.key === 'Enter') { commit(v); e.target.blur(); } }} className="flex-1 min-w-0 bg-gray-100 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#473AE0]/40" />
      <div className="flex items-center bg-gray-100 rounded-lg shrink-0">
        <button onClick={() => bump(-1)} title="Decrease" className="px-2.5 py-1.5 text-gray-500 hover:text-gray-800"><Minus size={14} /></button>
        <span className="w-px h-4 bg-gray-300" />
        <button onClick={() => bump(1)} title="Increase" className="px-2.5 py-1.5 text-gray-500 hover:text-gray-800"><Plus size={14} /></button>
      </div>
    </div>
  );
}
const fScrollName = { key: 'scroll-name', label: 'Name', core: true, has: () => false, clear: (c) => c.onAttr('id', ''), render: (c) => <AttrField el={c.el} attr="id" placeholder="# name" onChange={(v) => c.onAttr('id', v.replace(/^#/, '').trim())} /> };
const fOffsetY = { key: 'scroll-margin-top', label: 'Offset Y', core: true, has: (c) => !!c.getv('scroll-margin-top'), clear: (c) => c.onStyle('scroll-margin-top', ''), render: (c) => <StepperNum value={parseFloat(c.getv('scroll-margin-top')) || 0} onChange={(v) => c.onStyle('scroll-margin-top', v ? v + 'px' : '')} /> };

const FIELDS = {
  Typography: [fTextStyle, fNum('font-size', 'Font size'), fSel('font-weight', 'Weight', WEIGHT_OPTS), fNum('line-height', 'Line height', true), fNum('letter-spacing', 'Letter spacing'), fColor('color', 'Text color'), fAlign, fSel('text-transform', 'Transform', TRANSFORM_OPTS), fSel('text-decoration-line', 'Decoration', DECOR_OPTS), fPills('text-wrap', 'Balance', 'balance', ''), fTruncate],
  Position: [fSel('position', 'Type', POSITION_OPTS), fNum('top', 'Top'), fNum('right', 'Right'), fNum('bottom', 'Bottom'), fNum('left', 'Left'), fNum('z-index', 'Z index', true)],
  Size: [fSizeCtl('width', 'Width', ['fixed', 'relative', 'fill', 'fit'], 'w', true), fSizeCtl('height', 'Height', ['fixed', 'relative', 'fill', 'fit', 'viewport'], 'h', true), fGrowCtl, fSizeCtl('max-width', 'Max Width', ['relative', 'fixed'], 'w'), fSizeCtl('min-width', 'Min Width', ['relative', 'fixed'], 'w'), fSizeCtl('max-height', 'Max Height', ['relative', 'fixed', 'viewport'], 'h'), fSizeCtl('min-height', 'Min Height', ['relative', 'fixed', 'viewport'], 'h')],
  Layout: [fLayoutType, fDirection, fDistribute, fAlignItems, fWrapToggle, fGapSlider, fPadding, fBox('margin', 'Margin', ['margin-top', 'margin-right', 'margin-bottom', 'margin-left']), fTextF('grid-template-columns', 'Columns', 'repeat(3, 1fr)')],
  Border: [fNum('border-radius', 'Radius'), fNum('border-width', 'Width'), fSel('border-style', 'Style', BORDERSTYLE_OPTS), fColor('border-color', 'Color')],
  Effects: [fTextF('transition', 'Transition', 'all .3s ease'), fTextF('transform', 'Transform', 'scale(1.05)'), fTextF('box-shadow', 'Box shadow', '0 6px 18px rgba(0,0,0,.12)'), fTextF('filter', 'Filter', 'blur(4px)'), fNum('opacity', 'Opacity', true)],
  Cursor: [fCursor],
  Transforms: [fScale, fSkew, fRotate, fDepth, fPerspective, fOrigin, fBackface, fPreserve3d],
  Selection: [fSel('user-select', 'Selectable', USERSELECT_OPTS), fColor('accent-color', 'Accent'), fColor('caret-color', 'Caret')],
  ScrollSelection: [fScrollName, fOffsetY],
  Accessibility: [],
};

/* Scroll Animation (reveal on view) — stored as data-dz-anim JSON on the element. */
function ScrollAnimSection({ ctx }) {
  const anim = parseAnim(ctx.el.getAttribute('data-dz-anim'));
  const on = !!anim;
  const set = (patch) => { const next = { ...ANIM_DEFAULT, ...(anim || {}), ...patch }; ctx.onAttr('data-dz-anim', JSON.stringify(next)); };
  const enable = (v) => { if (v) ctx.onAttr('data-dz-anim', JSON.stringify(ANIM_DEFAULT)); else ctx.onAttr('data-dz-anim', ''); };
  const a = anim || ANIM_DEFAULT;
  return (
    <Section title="Scroll Animation">
      <div className="flex items-center gap-2 mb-2.5">
        <label className="text-sm text-gray-500 w-[74px] shrink-0">Animate</label>
        <div className="flex-1"><Pills value={on ? 'y' : 'n'} options={[['y', 'Yes'], ['n', 'No']]} onChange={(v) => enable(v === 'y')} /></div>
      </div>
      {on && (<>
        <AnimRow label="Opacity"><SliderNum value={a.opacity} min={0} max={1} step={0.05} onChange={(v) => set({ opacity: Number(v) })} /></AnimRow>
        <AnimRow label="Offset Y"><NumInput value={String(a.y)} bare onChange={(v) => set({ y: Number(v) || 0 })} /></AnimRow>
        <AnimRow label="Scale"><NumInput value={String(a.scale)} bare onChange={(v) => set({ scale: Number(v) || 1 })} /></AnimRow>
        <AnimRow label="Rotate"><NumInput value={String(a.rotate)} bare onChange={(v) => set({ rotate: Number(v) || 0 })} /></AnimRow>
        <AnimRow label="Skew"><NumInput value={String(a.skew)} bare onChange={(v) => set({ skew: Number(v) || 0 })} /></AnimRow>
        <AnimRow label="Duration"><NumInput value={String(a.duration)} bare onChange={(v) => set({ duration: Number(v) || 0.6 })} /></AnimRow>
        <AnimRow label="Delay"><NumInput value={String(a.delay)} bare onChange={(v) => set({ delay: Number(v) || 0 })} /></AnimRow>
        <AnimRow label="Easing"><Dropdown value={a.ease} onChange={(v) => set({ ease: v })} options={[['ease-in-out', 'Ease In Out'], ['ease', 'Ease'], ['ease-in', 'Ease In'], ['ease-out', 'Ease Out'], ['linear', 'Linear']]} /></AnimRow>
        <AnimRow label="Replay"><Pills value={a.replay ? 'y' : 'n'} options={[['y', 'Yes'], ['n', 'No']]} onChange={(v) => set({ replay: v === 'y' })} /></AnimRow>
        <div className="text-[11px] text-gray-400 mt-1">Press the ▶ Preview button in the toolbar to play it on the canvas.</div>
      </>)}
    </Section>
  );
}
function AnimRow({ label, children }) { return (<div className="flex items-center gap-2 mb-2.5"><label className="text-sm text-gray-500 w-[74px] shrink-0">{label}</label><div className="flex-1 min-w-0">{children}</div></div>); }

/* Position — visual pad (T/L/R/B around a centre box) + Type + Z-index. */
function PosField({ letter, prop, ctx }) {
  const cur = ctx.getv(prop);
  const [v, setV] = useState(cur);
  const f = useRef(false);
  useEffect(() => { if (!f.current) setV(cur); }, [cur]);
  const commit = (val) => {
    const out = withUnit(String(val).trim());
    // a top/left/right/bottom offset only has effect on a positioned element — auto-promote static → relative
    if (out) { const posNow = ctx.getv('position') || ctx.comp('position'); if (!posNow || posNow === 'static') ctx.onStyle('position', 'relative'); }
    ctx.onStyle(prop, out);
  };
  const onKey = (e) => {
    if (e.key === 'Enter') { commit(v); e.target.blur(); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const nv = bumpValue(v || ctx.comp(prop) || '0', (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); setV(nv); commit(nv); }
  };
  return (
    <div className="flex items-center bg-gray-100 rounded-lg pl-2.5 pr-2 w-[84px]">
      <input value={v} placeholder={ctx.comp(prop)} onFocus={() => { f.current = true; }} onChange={(e) => setV(e.target.value)} onBlur={() => { f.current = false; commit(v); }} onKeyDown={onKey} className="flex-1 min-w-0 bg-transparent py-1.5 text-sm text-gray-700 outline-none" />
      <span className="text-[11px] text-gray-400 shrink-0 ml-1">{letter}</span>
    </div>
  );
}
function PosPad({ ctx }) {
  const on = (p) => !!ctx.getv(p);
  const dash = (active) => `rounded ${active ? 'bg-[#473AE0]' : 'bg-gray-300'}`;
  return (
    <div className="relative w-[72px] h-[72px] bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
      <span className={`absolute top-2 left-1/2 -translate-x-1/2 w-0.5 h-3.5 ${dash(on('top'))}`} />
      <span className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-0.5 h-3.5 ${dash(on('bottom'))}`} />
      <span className={`absolute left-2 top-1/2 -translate-y-1/2 h-0.5 w-3.5 ${dash(on('left'))}`} />
      <span className={`absolute right-2 top-1/2 -translate-y-1/2 h-0.5 w-3.5 ${dash(on('right'))}`} />
      <span className="w-6 h-6 bg-white rounded-md shadow-sm border border-gray-200" />
    </div>
  );
}
/* Size — Width/Height with mode dropdowns (Fixed/Relative/Fill/Fit/Viewport), Grow, and Max/Min. */
const SIZE_MODE_META = { fixed: { label: 'Fixed', short: 'Fixed' }, relative: { label: 'Relative', short: 'Rel' }, fill: { label: 'Fill', short: 'Fill' }, fit: { label: 'Fit Content', short: 'Fit' }, viewport: { label: 'Viewport', short: 'View' } };
const sizeNumber = (v) => { const m = String(v || '').match(/-?\d*\.?\d+/); return m ? m[0] : ''; };
function sizeMode(v) {
  const s = String(v || '').trim();
  if (!s) return 'fixed';
  if (/^(fit-content|max-content|min-content|auto)$/.test(s)) return 'fit';
  if (/(vh|vw)$/.test(s)) return 'viewport';
  if (s === '100%') return 'fill';
  if (/%$/.test(s)) return 'relative';
  return 'fixed';
}
function sizeValue(mode, num, axis) {
  const n = String(num || '').trim();
  if (mode === 'fit') return 'fit-content';
  if (mode === 'fill') return '100%';
  if (mode === 'relative') return (n || '100') + '%';
  if (mode === 'viewport') return (n || '100') + (axis === 'w' ? 'vw' : 'vh');
  return n === '' ? '' : n + 'px';
}
function ModeSelect({ mode, modes, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const openMenu = () => { const r = btnRef.current && btnRef.current.getBoundingClientRect(); if (r) setPos({ left: Math.min(r.right - 150, (window.innerWidth || 1200) - 158), top: r.bottom + 4 }); setOpen(true); };
  return (
    <div className="w-[84px] shrink-0">
      <button ref={btnRef} onClick={openMenu} className="w-full flex items-center justify-between bg-gray-100 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-200/70">
        <span className="truncate">{SIZE_MODE_META[mode]?.short || mode}</span><Caret size={13} className="text-gray-400 shrink-0" />
      </button>
      {open && pos && (<>
        <div className="fixed inset-0 z-[60]" onMouseDown={() => setOpen(false)} />
        <div style={{ position: 'fixed', left: pos.left, top: pos.top }} className="z-[61] w-[150px] bg-white rounded-xl shadow-2xl border border-gray-100 py-1" onMouseDown={(e) => e.stopPropagation()}>
          {modes.map((mk) => (
            <button key={mk} onClick={() => { onChange(mk); setOpen(false); }} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left ${mk === mode ? 'bg-[#473AE0] text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
              <Check size={14} className={mk === mode ? '' : 'opacity-0'} /> {SIZE_MODE_META[mk].label}
            </button>
          ))}
        </div>
      </>)}
    </div>
  );
}
// input + mode dropdown (label is supplied by EditSection's row)
function SizeRowControl({ prop, modes, axis, ctx }) {
  const raw = ctx.getv(prop);
  const mode = sizeMode(raw);
  const num = sizeNumber(raw);
  const editable = mode === 'fixed' || mode === 'relative' || mode === 'viewport';
  const [v, setV] = useState(num);
  const f = useRef(false);
  useEffect(() => { if (!f.current) setV(num); }, [num, mode]);
  const commit = (n) => ctx.onStyle(prop, sizeValue(mode, n, axis));
  const setMode = (mNew) => { let n = num; if ((mNew === 'fixed' || mNew === 'relative' || mNew === 'viewport') && !n) n = sizeNumber(ctx.comp(prop)); ctx.onStyle(prop, sizeValue(mNew, n, axis)); };
  const onKey = (e) => {
    if (e.key === 'Enter') { commit(v); e.target.blur(); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const n = Math.round(((parseFloat(v || sizeNumber(ctx.comp(prop)) || '0')) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)) * 100) / 100; setV(String(n)); commit(String(n)); }
  };
  return (
    <div className="flex items-center gap-2">
      <input value={editable ? v : ''} disabled={!editable} placeholder={sizeNumber(ctx.comp(prop)) || (SIZE_MODE_META[mode] && SIZE_MODE_META[mode].label)}
        onFocus={() => { f.current = true; }} onChange={(e) => setV(e.target.value)} onBlur={() => { f.current = false; commit(v); }} onKeyDown={onKey}
        className={`flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-sm outline-none ${editable ? 'bg-gray-100 text-gray-700 focus:ring-2 focus:ring-[#473AE0]/40' : 'bg-gray-100 text-gray-400 cursor-default'}`} />
      <ModeSelect mode={mode} modes={modes} onChange={setMode} />
    </div>
  );
}
function GrowControlInner({ ctx }) {
  const w = ctx.getv('width') === '100%';
  const h = ctx.getv('height') === '100%';
  const setW = () => ctx.onStyle('width', w ? '' : '100%');
  const setH = () => ctx.onStyle('height', h ? '' : '100%');
  const setBoth = () => { const on = w && h; ctx.onStyle('width', on ? '' : '100%'); ctx.onStyle('height', on ? '' : '100%'); };
  const btn = (active, onClick, Icon, title) => <button onClick={onClick} title={title} className={`flex-1 py-1.5 rounded-md flex items-center justify-center ${active ? 'bg-white shadow-sm border border-gray-200 text-[#473AE0]' : 'text-gray-400 hover:text-gray-600'}`}><Icon size={16} /></button>;
  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
      {btn(w && !h, setW, MoveHorizontal, 'Fill width')}
      {btn(h && !w, setH, MoveVertical, 'Fill height')}
      {btn(w && h, setBoth, Maximize2, 'Fill both')}
    </div>
  );
}
// Padding control — one value for all sides, or per-side T/R/B/L (toggle).
function SideNum({ letter, value, placeholder, onCommit }) {
  const [v, setV] = useState(value ?? ''); const f = useRef(false);
  useEffect(() => { if (!f.current) setV(value ?? ''); }, [value]);
  const onKey = (e) => {
    if (e.key === 'Enter') { onCommit(v); e.target.blur(); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const nv = bumpValue(v || placeholder || '0', (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); setV(nv); onCommit(nv); }
  };
  return (
    <div className="flex flex-col items-center gap-0.5">
      <input value={v} placeholder={placeholder} onFocus={() => { f.current = true; }} onChange={(e) => setV(e.target.value)} onBlur={() => { f.current = false; onCommit(v); }} onKeyDown={onKey} className="w-full text-center bg-gray-100 rounded-lg px-1.5 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#473AE0]/40" />
      <span className="text-[10px] text-gray-400">{letter}</span>
    </div>
  );
}
function PaddingControl({ ctx }) {
  const sides = [['padding-top', 'T'], ['padding-right', 'R'], ['padding-bottom', 'B'], ['padding-left', 'L']];
  const vals = sides.map(([p]) => ctx.getv(p));
  const allEqual = vals.every((x) => x === vals[0]);
  const [perSide, setPerSide] = useState(!allEqual);
  const setAll = (val) => { const out = withUnit(String(val).trim()); sides.forEach(([p]) => ctx.onStyle(p, out)); };
  const first = vals[0];
  const [v, setV] = useState(allEqual ? first : '');
  const f = useRef(false);
  useEffect(() => { if (!f.current && allEqual) setV(first); }, [first, allEqual]);
  const modeBtn = (on, onClick, Icon, title) => <button onClick={onClick} title={title} className={`w-8 h-7 rounded-md flex items-center justify-center ${on ? 'bg-white shadow-sm border border-gray-200 text-[#473AE0]' : 'text-gray-400'}`}><Icon size={15} /></button>;
  return (
    <div>
      <div className="flex items-center gap-2">
        {!perSide
          ? <input value={v} placeholder={ctx.comp('padding-top')} onFocus={() => { f.current = true; }} onChange={(e) => setV(e.target.value)} onBlur={() => { f.current = false; setAll(v); }} onKeyDown={(e) => { if (e.key === 'Enter') { setAll(v); e.target.blur(); } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const nv = bumpValue(v || ctx.comp('padding-top') || '0', (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); setV(nv); setAll(nv); } }} className="flex-1 min-w-0 bg-gray-100 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#473AE0]/40" />
          : <div className="flex-1 bg-gray-100 rounded-lg px-2.5 py-1.5 text-sm text-gray-300">Mixed</div>}
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 shrink-0">
          {modeBtn(!perSide, () => setPerSide(false), Square, 'All sides')}
          {modeBtn(perSide, () => setPerSide(true), Maximize2, 'Per side')}
        </div>
      </div>
      {perSide && (
        <div className="grid grid-cols-4 gap-1.5 mt-1.5">
          {sides.map(([p, letter]) => <SideNum key={p} letter={letter} value={ctx.getv(p)} placeholder={ctx.comp(p)} onCommit={(val) => ctx.onStyle(p, withUnit(String(val).trim()))} />)}
        </div>
      )}
    </div>
  );
}
function PositionSection({ ctx }) {
  return (
    <Section title="Position" defaultOpen>
      <div className="flex flex-col items-center gap-2 mb-3">
        <PosField letter="T" prop="top" ctx={ctx} />
        <div className="flex items-center gap-2">
          <PosField letter="L" prop="left" ctx={ctx} />
          <PosPad ctx={ctx} />
          <PosField letter="R" prop="right" ctx={ctx} />
        </div>
        <PosField letter="B" prop="bottom" ctx={ctx} />
      </div>
      <div className="flex items-center gap-2 mb-2.5">
        <label className="text-sm text-gray-500 w-[64px] shrink-0">Type</label>
        <div className="flex-1 min-w-0"><Dropdown value={ctx.getv('position')} onChange={(v) => ctx.onStyle('position', v)} options={POSITION_OPTS} /></div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500 w-[64px] shrink-0">Z index</label>
        <div className="flex-1 min-w-0"><NumInput value={ctx.getv('z-index')} placeholder={ctx.comp('z-index')} bare onChange={(v) => ctx.onStyle('z-index', v)} /></div>
      </div>
    </Section>
  );
}

function EditSection({ title, fields, ctx, defaultOpen }) {
  const [extra, setExtra] = useState(() => new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const [q, setQ] = useState('');
  const [openTick, setOpenTick] = useState(0);
  const [removed, setRemoved] = useState(() => new Set());
  // A field shows if not explicitly removed AND (it's a core field OR it was added OR it has a value).
  const active = fields.filter((f) => !removed.has(f.key) && (f.core || extra.has(f.key) || f.has(ctx)));
  const inactive = fields.filter((f) => !active.includes(f));
  const add = (f) => { setExtra((s) => new Set(s).add(f.key)); setRemoved((s) => { const n = new Set(s); n.delete(f.key); return n; }); setAddOpen(false); setQ(''); setOpenTick((t) => t + 1); };
  const remove = (f) => { if (f.clear) f.clear(ctx); setExtra((s) => { const n = new Set(s); n.delete(f.key); return n; }); setRemoved((s) => new Set(s).add(f.key)); };
  // The add-field menu is rendered OUTSIDE the Section (so it shows even when the section is
  // collapsed) as a FIXED popover anchored to the "+" button (never clipped by overflow).
  const openAdd = (rect) => { if (rect) setMenuPos({ left: Math.max(8, rect.right - 240), top: rect.bottom + 6 }); setAddOpen((v) => !v); setQ(''); };
  return (<>
    <Section title={title} defaultOpen={defaultOpen} onAdd={inactive.length ? openAdd : undefined} openSignal={openTick}>
      {active.length === 0 && (fields.length === 0
        ? <div className="text-sm text-gray-400 py-0.5">No controls yet.</div>
        : <div className="text-sm text-gray-400 py-0.5">Nothing set — tap <Plus size={13} className="inline -mt-0.5" /> to add.</div>)}
      {active.map((f) => (
        <div key={f.key} className="group flex items-center gap-2 mb-2.5">
          <button onClick={() => remove(f)} title="Remove" className="shrink-0 text-[#473AE0] hover:text-red-500"><MinusCircle size={17} /></button>
          <label className="text-sm text-gray-500 w-[74px] shrink-0">{f.label}</label>
          <div className="flex-1 min-w-0">{f.render(ctx)}</div>
        </div>
      ))}
    </Section>
    {addOpen && menuPos && (<>
      <div className="fixed inset-0 z-[60]" onMouseDown={() => setAddOpen(false)} />
      <div style={{ position: 'fixed', left: menuPos.left, top: menuPos.top, width: 240 }} className="z-[61] bg-white rounded-xl shadow-2xl border border-gray-100 p-2 max-h-72 overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 mb-1.5"><Search size={13} className="text-gray-400" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search…" className="flex-1 bg-transparent py-1.5 text-sm outline-none" /></div>
        {inactive.filter((f) => f.label.toLowerCase().includes(q.toLowerCase())).map((f) => (
          <button key={f.key} onClick={() => add(f)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm text-gray-700 text-left"><PlusCircle size={15} className="text-gray-400 shrink-0" /> {f.label}</button>
        ))}
        {inactive.length === 0 && <div className="text-xs text-gray-400 px-2 py-1.5">All added.</div>}
      </div>
    </>)}
  </>);
}
function TextField({ value, placeholder, onCommit }) {
  const [v, setV] = useState(value ?? '');
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setV(value ?? ''); }, [value]);
  return <input value={v} placeholder={placeholder} onFocus={() => { focused.current = true; }} onChange={(e) => setV(e.target.value)} onBlur={() => { focused.current = false; onCommit(v); }} onKeyDown={(e) => { if (e.key === 'Enter') { onCommit(v); e.target.blur(); } }} className={INPUT} />;
}

/* ============================ primitives ============================ */
function RowCol({ label, children }) { return (<div className="mb-2.5"><label className="text-xs text-gray-500 block mb-1">{label}</label>{children}</div>); }
// Text/number field that shows raw typing and only commits (adding `px`) on blur / Enter,
// so the cursor never jumps and partial values aren't transformed mid-edit.
function NumInput({ value, placeholder, onChange, bare }) {
  const [v, setV] = useState(value ?? '');
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setV(value ?? ''); }, [value]);
  const commit = (val) => onChange(bare ? String(val).trim() : withUnit(String(val).trim()));
  const arrow = (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const delta = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1);
    const nv = bumpValue(v || placeholder || '0', delta);
    setV(nv); commit(nv);
  };
  return (
    <input value={v} placeholder={placeholder}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { focused.current = false; commit(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { commit(v); e.target.blur(); } else arrow(e); }}
      className={INPUT} />
  );
}
function Dropdown({ value, onChange, options }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} appearance-none pr-7 capitalize`}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Caret size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}
function Pills({ value, options, onChange }) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5">
      {options.map(([v, l]) => <button key={v} onClick={() => onChange(v)} className={`flex-1 py-1 text-sm rounded-md ${value === v ? 'bg-white shadow-sm border border-gray-200 text-[#473AE0] font-semibold' : 'text-gray-500'}`}>{l}</button>)}
    </div>
  );
}
// Rich colour picker (HSV + hex + alpha + eyedropper + colour tokens) used by every colour field.
function ColorControl({ value, placeholder, onChange, colors, onNewColor }) {
  return <ColorPicker value={value} placeholder={placeholder} onChange={onChange} colors={colors} onNewColor={onNewColor} />;
}
function SliderNum({ value, min, max, step, onChange }) {
  const [v, setV] = useState(value ?? '');
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setV(value == null ? '' : String(value)); }, [value]);
  const commit = (val) => onChange(val);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <input value={v}
        onFocus={() => { focused.current = true; }}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { focused.current = false; commit(v.trim()); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { commit(v.trim()); e.target.blur(); return; }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : (step || 1));
            let n = Math.round(((parseFloat(v) || 0) + d) * 1000) / 1000;
            if (min != null) n = Math.max(min, n); if (max != null) n = Math.min(max, n);
            setV(String(n)); commit(String(n));
          }
        }}
        className="w-14 shrink-0 bg-gray-100 rounded-lg px-2 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#473AE0]/40" />
      <input type="range" min={min} max={max} step={step} value={Number(v) || 0} onChange={(e) => { setV(e.target.value); commit(e.target.value); }} className="flex-1 min-w-0 accent-[#473AE0]" />
    </div>
  );
}
function BoxInput({ sides, ctx }) {
  const letters = ['T', 'R', 'B', 'L'];
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {sides.map((prop, i) => <BoxField key={prop} letter={letters[i]} value={ctx.getv(prop)} placeholder={ctx.comp(prop)} onCommit={(val) => ctx.onStyle(prop, withUnit(val.trim()))} />)}
    </div>
  );
}
function BoxField({ letter, value, placeholder, onCommit }) {
  const [v, setV] = useState(value ?? '');
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setV(value ?? ''); }, [value]);
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2">
      <span className="text-[10px] font-semibold text-gray-400 w-3 shrink-0">{letter}</span>
      <input value={v} placeholder={placeholder}
        onFocus={() => { focused.current = true; }}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { focused.current = false; onCommit(v); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onCommit(v); e.target.blur(); return; }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const nv = bumpValue(v || placeholder || '0', (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); setV(nv); onCommit(nv); }
        }}
        className="w-full min-w-0 bg-transparent py-1.5 text-sm text-gray-700 outline-none" />
    </div>
  );
}
function Section({ title, children, defaultOpen = false, onAdd, openSignal }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]); // open the accordion when a field is added
  return (
    <div className="border-b border-gray-100">
      <div className="w-full flex items-center justify-between px-4 py-2.5">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 text-[15px] font-bold text-gray-900">{title}</button>
        <div className="flex items-center gap-0.5">
          {onAdd && <button onClick={(e) => onAdd(e.currentTarget.getBoundingClientRect())} title="Add" className="w-6 h-6 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-700"><Plus size={17} /></button>}
          <button onClick={() => setOpen((v) => !v)} className="w-6 h-6 flex items-center justify-center text-gray-400"><Caret size={14} className={`transition-transform ${open ? '' : '-rotate-90'}`} /></button>
        </div>
      </div>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}
function ActBtn({ children, onClick, title, danger }) {
  return <button onClick={onClick} title={title} className={`w-8 h-8 rounded-lg flex items-center justify-center ${danger ? 'text-gray-500 hover:bg-red-50 hover:text-red-500' : 'text-gray-500 hover:bg-gray-100'}`}>{children}</button>;
}

/* ============================ Right-click context menu ============================ */
export function ContextMenu({ x, y, el, onClose, actions, components = [] }) {
  const [q, setQ] = useState('');
  const locked = el.hasAttribute && el.hasAttribute('data-dz-locked');
  const hidden = el.style && el.style.display === 'none';
  const comps = components.filter((c) => c.kind !== 'template');
  const tpls = components.filter((c) => c.kind === 'template');
  useEffect(() => { const onKey = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [onClose]);
  const run = (fn) => () => { if (fn) fn(); onClose(); };
  const groups = [
    [
      { label: 'Create Component', shortcut: '⌥⌘K', onClick: run(actions.createComponent) },
      { label: 'Create Layout Template', onClick: run(actions.createTemplate) },
      tpls.length
        ? { label: 'Add To Layout Template', submenu: tpls.map((t) => ({ label: t.name, onClick: run(() => actions.addToTemplate(t.id)) })) }
        : { label: 'Add To Layout Template', disabled: true },
    ],
    [{ label: 'Fit Content', shortcut: '⇧A', onClick: run(actions.fitContent) }],
    [
      { label: 'Select', submenu: [
        { label: 'Page (Body)', onClick: run(actions.selectBody) },
        { label: 'Top Parent', onClick: run(actions.selectTopParent) },
        { label: 'Parent', shortcut: 'ESC', onClick: run(actions.selectParent) },
        { label: 'First Child', onClick: run(actions.selectFirstChild) },
        { label: 'Text Layer', onClick: run(actions.selectFirstText) },
      ] },
      comps.length
        ? { label: 'Replace With', submenu: Object.entries(comps.reduce((m, c) => { const f = (c.folder && String(c.folder).trim()) || 'Project'; (m[f] = m[f] || []).push(c); return m; }, {})).map(([f, items]) => ({ label: f, submenu: items.map((c) => ({ label: c.name, onClick: run(() => actions.replaceWith(c.html)) })) })) }
        : { label: 'Replace With', disabled: true },
    ],
    [
      { label: 'Copy', onClick: run(actions.copyEl) },
      { label: 'Paste', onClick: run(actions.pasteEl), disabled: !actions.canPaste },
      { label: 'Duplicate', shortcut: '⌘D', onClick: run(actions.duplicate) },
      { label: 'Delete', shortcut: '⌫', onClick: run(actions.del), danger: true },
    ],
    [
      { label: 'Rename', shortcut: '⌘R', onClick: run(actions.rename) },
      { label: 'Auto Rename', shortcut: '⌥R', onClick: run(actions.autoRename) },
      { label: locked ? 'Unlock' : 'Lock', shortcut: '⌘L', onClick: run(actions.toggleLock) },
      { label: hidden ? 'Show' : 'Hide', shortcut: '⌘;', onClick: run(actions.toggleHide) },
      { label: 'Overflow', submenu: [['Visible', 'visible'], ['Hidden', 'hidden'], ['Scroll', 'scroll'], ['Clip', 'clip'], ['Auto', 'auto'], ['Default', '']].map(([l, v]) => ({ label: l, onClick: run(() => actions.setOverflow(v)) })) },
    ],
    [
      { label: 'Add Frame', shortcut: '⌘↵', onClick: run(actions.addFrame) },
      { label: 'Add Stack', shortcut: '⌥⌘↵', onClick: run(actions.addStack) },
      { label: 'Remove Frame', shortcut: '⌘⌫', onClick: run(actions.removeFrame) },
    ],
    [{ label: 'Set as Default Fill', disabled: true, soon: true }],
  ];
  const filt = q.trim().toLowerCase();
  const match = (it) => !filt || it.label.toLowerCase().includes(filt) || (it.submenu && it.submenu.some((s) => s.label.toLowerCase().includes(filt)));
  const style = { left: Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 260), top: Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 520) };
  return (
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div style={style} className="fixed z-[71] w-[240px] max-h-[80vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-100 py-1 text-sm">
        <div className="px-2 pb-1">
          <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2"><Search size={13} className="text-gray-400" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search…" className="flex-1 bg-transparent py-1.5 text-[13px] outline-none" /></div>
        </div>
        {groups.map((g, gi) => { const items = g.filter(match); if (!items.length) return null; return (
          <div key={gi} className="border-t border-gray-100 first:border-t-0 py-1">{items.map((it) => <MenuRow key={it.label} item={it} />)}</div>
        ); })}
      </div>
    </>
  );
}
/* ============================ Name prompt (pretty modal) ============================ */
export function NamePrompt({ title, initial, placeholder, onSubmit, onCancel }) {
  const [v, setV] = useState(initial || '');
  const inputRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => { if (inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, 30); return () => clearTimeout(t); }, []);
  useEffect(() => { const onKey = (e) => { if (e.key === 'Escape') onCancel(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [onCancel]);
  const submit = () => onSubmit(v.trim());
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30" onMouseDown={onCancel}>
      <div className="w-[360px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-5" onMouseDown={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold text-gray-900 mb-3">{title}</div>
        <input ref={inputRef} value={v} placeholder={placeholder || 'Name'} onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          className="w-full bg-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#473AE0]/40 placeholder-gray-400" />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-4 h-9 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={submit} className="px-4 h-9 rounded-full text-sm font-medium bg-[#473AE0] text-white hover:bg-[#3a2fc0]">Save</button>
        </div>
      </div>
    </div>
  );
}

/* A page row in the Pages tab, with a right-click / "…" menu of page operations. */
function PageRow({ p, active, onOpen, actions, canDelete }) {
  const [menu, setMenu] = useState(false);
  const stop = (fn) => (e) => { e.stopPropagation(); e.preventDefault(); if (fn) fn(); };
  const act = (fn) => stop(() => { setMenu(false); fn && fn(p); });
  return (
    <div className="group relative">
      <div onClick={onOpen} onContextMenu={(e) => { e.preventDefault(); setMenu(true); }}
        className={`w-full flex items-center gap-2 px-2.5 h-8 rounded-md text-[13px] cursor-pointer ${active ? 'bg-indigo-50 text-[#473AE0] font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
        <Square size={11} className="text-blue-300 shrink-0" />
        <span className="truncate flex-1">{p.title || p.path}</span>
        {p.home && <Home size={12} className="text-gray-400 shrink-0" title="Home page" />}
        <button onClick={stop(() => setMenu((v) => !v))} className="shrink-0 w-5 h-5 rounded text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 flex items-center justify-center"><MoreHorizontal size={15} /></button>
      </div>
      {menu && actions && (<>
        <div className="fixed inset-0 z-40" onClick={stop(() => setMenu(false))} onContextMenu={stop(() => setMenu(false))} />
        <div className="absolute left-2 top-8 z-50 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 w-44 text-sm" onClick={(e) => e.stopPropagation()}>
          <button onClick={act(actions.settings)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">Settings</button>
          <button onClick={act(actions.settings)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">Rename</button>
          <button onClick={act(actions.duplicate)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">Duplicate</button>
          <button onClick={act(actions.saveTemplate)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">Save as Template</button>
          <div className="border-t border-gray-100 my-1" />
          <button onClick={canDelete ? act(actions.remove) : undefined} disabled={!canDelete} className={`w-full text-left px-3 py-1.5 ${canDelete ? 'text-red-500 hover:bg-red-50' : 'text-gray-300'}`}>Delete</button>
          <div className="border-t border-gray-100 my-1" />
          <button onClick={act(actions.setHome)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700">{p.home ? <Square size={12} className="text-[#473AE0]" /> : <span className="w-3" />} Set as Home</button>
          <button onClick={act(actions.replace)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">Replace This Page With…</button>
        </div>
      </>)}
    </div>
  );
}

/* Page settings modal — title + slug. */
export function PageSettingsModal({ page, onSubmit, onCancel }) {
  const [title, setTitle] = useState(page.title || '');
  const [slug, setSlug] = useState((page.path || '').replace(/\.html?$/i, ''));
  const firstRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => firstRef.current && firstRef.current.focus(), 30); return () => clearTimeout(t); }, []);
  useEffect(() => { const onKey = (e) => { if (e.key === 'Escape') onCancel(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [onCancel]);
  const submit = () => onSubmit({ title: title.trim() || page.title || 'Page', slug: slug.trim() });
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30" onMouseDown={onCancel}>
      <div className="w-[380px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-5" onMouseDown={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold text-gray-900 mb-3">Page settings</div>
        <div className="mb-3">
          <label className="text-xs text-gray-500 block mb-1">Title</label>
          <input ref={firstRef} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} className={MODAL_INPUT} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Slug (file name)</label>
          <div className="flex items-center gap-1.5">
            <input value={slug} onChange={(e) => setSlug(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} className={MODAL_INPUT} />
            <span className="text-sm text-gray-400 shrink-0">.html</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Renaming the slug changes the file path; existing links won’t auto-update.</div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-4 h-9 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={submit} className="px-4 h-9 rounded-full text-sm font-medium bg-[#473AE0] text-white hover:bg-[#3a2fc0]">Save</button>
        </div>
      </div>
    </div>
  );
}

/* Replace-page modal — choose a template/component (replaces the page body). */
export function ReplacePageModal({ templates, onSubmit, onCancel }) {
  const [tpl, setTpl] = useState('');
  const list = (templates || []);
  useEffect(() => { const onKey = (e) => { if (e.key === 'Escape') onCancel(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30" onMouseDown={onCancel}>
      <div className="w-[380px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-5" onMouseDown={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold text-gray-900 mb-1">Replace this page with…</div>
        <div className="text-[12px] text-gray-400 mb-3">The page content is replaced. This can’t be undone.</div>
        <div className="relative">
          <select value={tpl} onChange={(e) => setTpl(e.target.value)} className={`${MODAL_INPUT} appearance-none pr-8`}>
            <option value="">Blank page</option>
            {list.filter((c) => c.kind === 'template').length > 0 && <optgroup label="Layout templates">{list.filter((c) => c.kind === 'template').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
            {list.filter((c) => c.kind !== 'template').length > 0 && <optgroup label="Components">{list.filter((c) => c.kind !== 'template').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
          </select>
          <Caret size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-4 h-9 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={() => onSubmit(tpl || null)} className="px-4 h-9 rounded-full text-sm font-medium bg-[#473AE0] text-white hover:bg-[#3a2fc0]">Replace</button>
        </div>
      </div>
    </div>
  );
}

/* New page modal — name + start from Blank or a saved component / layout template. */
export function NewPageModal({ templates, onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [tpl, setTpl] = useState('');
  const firstRef = useRef(null);
  const tplList = (templates || []);
  useEffect(() => { const t = setTimeout(() => firstRef.current && firstRef.current.focus(), 30); return () => clearTimeout(t); }, []);
  useEffect(() => { const onKey = (e) => { if (e.key === 'Escape') onCancel(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [onCancel]);
  const submit = () => { if (!name.trim()) return; onSubmit({ name: name.trim(), templateId: tpl || null }); };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30" onMouseDown={onCancel}>
      <div className="w-[380px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-5" onMouseDown={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold text-gray-900 mb-3">New page</div>
        <div className="mb-3">
          <label className="text-xs text-gray-500 block mb-1">Page name</label>
          <input ref={firstRef} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="e.g. About" className={MODAL_INPUT} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Start from</label>
          <div className="relative">
            <select value={tpl} onChange={(e) => setTpl(e.target.value)} className={`${MODAL_INPUT} appearance-none pr-8`}>
              <option value="">Blank page</option>
              {tplList.filter((c) => c.kind === 'template').length > 0 && <optgroup label="Layout templates">{tplList.filter((c) => c.kind === 'template').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
              {tplList.filter((c) => c.kind !== 'template').length > 0 && <optgroup label="Components">{tplList.filter((c) => c.kind !== 'template').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
            </select>
            <Caret size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-4 h-9 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={submit} disabled={!name.trim()} className="px-4 h-9 rounded-full text-sm font-medium bg-[#473AE0] text-white hover:bg-[#3a2fc0] disabled:opacity-50">Create</button>
        </div>
      </div>
    </div>
  );
}

/* Create / move modal — name + folder picker (with "New folder…"). */
export function CreateModal({ mode, title, folders, folder: initFolder, onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [folder, setFolder] = useState(initFolder || folders[0] || 'Project');
  const [newF, setNewF] = useState(false);
  const [newName, setNewName] = useState('');
  const firstRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => firstRef.current && firstRef.current.focus(), 30); return () => clearTimeout(t); }, []);
  useEffect(() => { const onKey = (e) => { if (e.key === 'Escape') onCancel(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [onCancel]);
  const submit = () => { const f = newF ? (newName.trim() || 'Project') : folder; onSubmit(mode === 'create' ? { name, folder: f } : f); };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30" onMouseDown={onCancel}>
      <div className="w-[380px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-5" onMouseDown={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold text-gray-900 mb-3">{title}</div>
        {mode === 'create' && (
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">Name</label>
            <input ref={firstRef} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="Component name" className={MODAL_INPUT} />
          </div>
        )}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Folder</label>
          {!newF ? (
            <div className="relative">
              <select ref={mode === 'folder' ? firstRef : null} value={folder} onChange={(e) => { if (e.target.value === '__new') { setNewF(true); } else setFolder(e.target.value); }} className={`${MODAL_INPUT} appearance-none pr-8`}>
                {folders.map((f) => <option key={f} value={f}>{f}</option>)}
                <option value="__new">＋ New folder…</option>
              </select>
              <Caret size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          ) : (
            <div className="flex gap-2">
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="New folder name" className={MODAL_INPUT} />
              <button onClick={() => { setNewF(false); setNewName(''); }} className="px-3 h-9 rounded-lg text-sm text-gray-500 hover:bg-gray-100 shrink-0">Back</button>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-4 h-9 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={submit} className="px-4 h-9 rounded-full text-sm font-medium bg-[#473AE0] text-white hover:bg-[#3a2fc0]">Save</button>
        </div>
      </div>
    </div>
  );
}

function MenuRow({ item }) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef(null);
  const [pos, setPos] = useState(null);
  if (item.submenu) {
    // Submenu is rendered with position:fixed (anchored to this row) so it ESCAPES the
    // menu's overflow clipping and can be reached without a hover dead-zone.
    const onEnter = () => { const r = rowRef.current && rowRef.current.getBoundingClientRect(); if (r) setPos({ left: r.right - 4, top: r.top - 5 }); setOpen(true); };
    return (
      <div ref={rowRef} onMouseEnter={onEnter} onMouseLeave={() => setOpen(false)}>
        <button className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-gray-50 ${item.disabled ? 'text-gray-300' : 'text-gray-700'}`}><span className="truncate">{item.label}</span><ChevronRight size={14} className="text-gray-400 shrink-0" /></button>
        {open && item.submenu.length > 0 && pos && (
          <div style={{ position: 'fixed', left: pos.left, top: pos.top }} className="w-[204px] max-h-[70vh] overflow-y-auto z-[72]">
            <div className="ml-1 bg-white rounded-xl shadow-2xl border border-gray-100 py-1">
              {item.submenu.map((s) => <MenuRow key={s.label} item={s} />)}
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <button onClick={item.disabled ? undefined : item.onClick} disabled={item.disabled}
      className={`w-full flex items-center justify-between px-3 py-1.5 ${item.disabled ? 'text-gray-300 cursor-default' : item.danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}>
      <span>{item.label}</span>
      {item.soon ? <span className="text-[10px] text-gray-300">soon</span> : item.shortcut ? <span className="text-[11px] text-gray-400">{item.shortcut}</span> : null}
    </button>
  );
}
