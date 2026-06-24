/* ------------------------------------------------------------------ */
/*  MarkupEditor helpers: comment/element utilities, palettes, and the  */
/*  Add-version modal. Split out of MarkupEditor.                       */
/* ------------------------------------------------------------------ */
import React, { useState, useRef } from 'react';
import { Square, Circle, Minus, ArrowUpRight, Pencil, Highlighter, X, Globe, Upload } from 'lucide-react';
import { markupListMembers, markupAddMember, markupRemoveMember, markupRemoveInvite, addMarkupVersionUrl, addMarkupVersionZip } from './markupApi';

export const ATTACH_ACCEPT = '.jpg,.jpeg,.png,.svg,.bmp,.gif,.pdf,.psd,.ai,.eps,.tiff,.tif,.rtf,.txt,.docx,.doc,.pages,.odt,.pptx,.ppt,.odp,.key,.xlsx,.xls,.csv,.mp4,.mov,.webm,.xml,.json,.zip';
export const fileToDataUrl = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
export const isImageAtt = (f) => /^image\//.test(f.type || '') || /\.(jpe?g|png|gif|svg|bmp|webp)$/i.test(f.name || '');
export const prettySize = (n) => { if (!n) return ''; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; };

export const MEMBER_API = { listMembers: markupListMembers, addMember: markupAddMember, removeMember: markupRemoveMember, removeInvite: markupRemoveInvite };
export const PRIO = { none: { label: 'None', color: '#473AE0' }, low: { label: 'Low', color: '#16A34A' }, medium: { label: 'Medium', color: '#F59E0B' }, high: { label: 'High', color: '#EF4444' } };
export const DRAW_TOOLS = [['rect', Square], ['ellipse', Circle], ['line', Minus], ['arrow', ArrowUpRight], ['pen', Pencil], ['highlight', Highlighter]];
export const DRAW_COLORS = ['#2C2CE0', '#473AE0', '#0EA5E9', '#10B981', '#16A34A', '#84CC16', '#F59E0B', '#EF4444', '#EC4899', '#D946EF', '#8B5CF6', '#111827'];
export const relTime = (ts) => { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return 'just now'; const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`; };
export const shortPage = (p) => { if (!p) return ''; try { return new URL(p).pathname || '/'; } catch (e) { return p; } };
export const pinBg = (c) => (c.resolved ? '#22C55E' : (PRIO[c.priority] || PRIO.none).color);
export const EMOJIS = ['👍', '👎', '❤️', '🔥', '🎉', '✅', '❌', '⚠️', '🙂', '😍', '🤔', '👀', '🚀', '💡', '🐛', '✨'];
// Structured comment intent (mirrors backend enums) — makes short comments unambiguous for the AI.
export const C_TYPES = ['spacing', 'color', 'copy', 'typography', 'layout', 'remove', 'add', 'animation', 'bug', 'other'];
export const C_SCOPES = [['element', 'This element'], ['all-similar', 'All similar'], ['section', 'Whole section'], ['global', 'Site-wide']];
export const SCOPE_LABEL = Object.fromEntries(C_SCOPES);

// Build a reasonably-unique CSS selector path for an element (so an AI can find it later).
export function cssSelector(el, doc) {
  try {
    if (!el || el.nodeType !== 1) return '';
    const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&'));
    if (el.id) return '#' + esc(el.id);
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== doc.body && node !== doc.documentElement && parts.length < 6) {
      const cur = node;
      if (cur.id) { parts.unshift('#' + esc(cur.id)); break; }
      let part = cur.tagName.toLowerCase();
      const parent = cur.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
        if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      node = cur.parentElement;
    }
    return parts.join(' > ');
  } catch (e) { return ''; }
}
// Small chip under a comment showing which element it points at (helps humans + mirrors the AI data).
export function anchorChip(a) {
  if (!a || (!a.tag && !a.selector && !a.text)) return null;
  const label = (a.tag || 'element') + (a.classes ? '.' + String(a.classes).split(' ').filter(Boolean)[0] : '');
  return (
    <div className="mt-1.5 flex items-start gap-1 text-[11px] text-gray-400" title={a.selector || ''}>
      <span className="font-mono bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 shrink-0">{label}</span>
      {a.text ? <span className="truncate">“{String(a.text).slice(0, 60)}”</span> : null}
    </div>
  );
}
export const elLabel = (el) => {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? '#' + el.id : '';
  const cls = (typeof el.className === 'string' && el.className.trim()) ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
  return tag + id + cls;
};
export const STYLE_PROPS = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-bottom', 'gap', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'background-color', 'width', 'height', 'display', 'text-align'];
// Compact meta under a comment: type · scope chips, desired value, and the element it points at.
export function commentMeta(c) {
  if (!c) return null;
  const a = c.anchor || {};
  const showType = c.type && c.type !== 'other';
  const showScope = c.scope && c.scope !== 'element';
  if (!showType && !showScope && !c.desiredValue && !(a.tag || a.selector || a.text)) return null;
  return (
    <div className="mt-1.5 space-y-1">
      {(showType || showScope) && (
        <div className="flex flex-wrap gap-1">
          {showType && <span className="text-[10px] font-medium bg-indigo-50 text-[#473AE0] rounded px-1.5 py-0.5 capitalize">{c.type}</span>}
          {showScope && <span className="text-[10px] font-medium bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{SCOPE_LABEL[c.scope] || c.scope}</span>}
        </div>
      )}
      {c.desiredValue ? <div className="text-[11px] text-gray-500">Target: <span className="font-mono text-gray-700">{c.desiredValue}</span></div> : null}
      {anchorChip(a)}
    </div>
  );
}
// Capture where a pin sits + current styles, so an AI knows exactly what element to fix and its values.
export function describeElement(el, doc) {
  try {
    if (!el || el.nodeType !== 1) return {};
    const win = doc.defaultView || window;
    const tag = el.tagName.toLowerCase();
    const cls = typeof el.className === 'string' ? el.className.trim() : '';
    const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 400);
    let html = ''; try { html = String(el.outerHTML || '').slice(0, 2000); } catch (e) {}
    const parents = [];
    let p = el.parentElement;
    while (p && p !== doc.body && p !== doc.documentElement && parents.length < 3) { parents.push(elLabel(p)); p = p.parentElement; }
    let sectionId = '', sectionHeading = '';
    const sec = el.closest('section') || el.closest('[id]');
    if (sec) { sectionId = sec.id || ''; const h = sec.querySelector('h1,h2,h3,h4,h5,h6'); if (h) sectionHeading = (h.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 200); }
    const computedStyles = {};
    try { const cs = win.getComputedStyle(el); STYLE_PROPS.forEach((k) => { const v = cs.getPropertyValue(k); if (v) computedStyles[k] = v; }); } catch (e) {}
    return { mkId: el.getAttribute('data-mk-id') || '', selector: cssSelector(el, doc), tag, id: el.id || '', classes: cls.slice(0, 300), text, html, parents, sectionId, sectionHeading, computedStyles };
  } catch (e) { return {}; }
}
// Give every element a stable data-mk-id (so fixes can target it across reloads). Returns count added.
export function stampMkIds(doc) {
  let n = 0;
  const all = doc.body ? doc.body.querySelectorAll('*') : [];
  all.forEach((el) => {
    if (['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'BR'].includes(el.tagName)) return;
    if (!el.getAttribute('data-mk-id')) { el.setAttribute('data-mk-id', 'mk-' + Math.random().toString(36).slice(2, 8) + n.toString(36)); n += 1; }
  });
  return n;
}
// Lazy-load html2canvas inside the iframe so we can rasterize a comment's element region.
export function ensureH2C(doc) {
  try { if (doc.getElementById('__h2c')) return; const s = doc.createElement('script'); s.id = '__h2c'; s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; doc.head && doc.head.appendChild(s); } catch (e) {}
}
export async function captureShot(win, el) {
  try {
    if (!win || !win.html2canvas || !el) return '';
    const canvas = await win.html2canvas(el, { backgroundColor: null, scale: 1, logging: false, useCORS: true });
    let out = canvas; const maxW = 800;
    if (canvas.width > maxW) { const r = maxW / canvas.width; const c2 = document.createElement('canvas'); c2.width = maxW; c2.height = Math.round(canvas.height * r); c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height); out = c2; }
    return out.toDataURL('image/jpeg', 0.7);
  } catch (e) { return ''; }
}


export function AddVersionModal({ projectId, onClose, onAdded, setBusy }) {
  const [tab, setTab] = useState('url');
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState('new'); // 'new' = create a version; 'current' = replace the latest version
  const fileRef = useRef(null);
  const tabCls = (t) => `pb-2 text-base ${tab === t ? 'text-gray-800 border-b-2 border-[#10B981] font-medium' : 'text-gray-500'}`;

  const addUrl = async () => {
    const u = url.trim(); if (!u) return;
    setBusy(mode === 'current' ? 'Replacing current version…' : 'Adding version…'); setErr('');
    try { await addMarkupVersionUrl(projectId, u, mode); onAdded(); } catch (e) { setErr(e.message || 'Failed'); } finally { setBusy(''); }
  };
  const onFile = (file) => {
    if (!file) return;
    setBusy(mode === 'current' ? 'Replacing current version…' : 'Uploading & unpacking…'); setErr('');
    const reader = new FileReader();
    reader.onload = async () => { try { await addMarkupVersionZip(projectId, reader.result, mode); onAdded(); } catch (e) { setErr(e.message || 'Upload failed'); } finally { setBusy(''); } };
    reader.onerror = () => { setErr('Could not read the file.'); setBusy(''); };
    reader.readAsDataURL(file);
  };
  const modeBtn = (k, label) => (
    <button onClick={() => setMode(k)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition ${mode === k ? 'border-[#473AE0] bg-indigo-50 text-[#473AE0]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{label}</button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[94vw]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800">Add a new version</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center shrink-0"><X size={16} /></button>
        </div>
        <div className="px-7 pt-5 pb-7">
        <div className="flex items-center gap-6 border-b border-gray-100">
          <button onClick={() => { setTab('url'); setErr(''); }} className={tabCls('url')}>From URL</button>
          <button onClick={() => { setTab('zip'); setErr(''); }} className={tabCls('zip')}>Upload ZIP</button>
        </div>
        <div className="flex items-center gap-2 mt-5">
          {modeBtn('new', 'New version')}
          {modeBtn('current', 'Current version')}
        </div>
        <p className="text-gray-400 text-xs mt-2">{mode === 'new'
          ? 'Creates a new version with its own comments — handy for reviewing changes over time.'
          : 'Replaces the latest version’s page in place, keeping its existing comments.'}</p>
        {tab === 'url' ? (
          <div className="mt-5">
            <p className="text-gray-500 text-sm mb-4">{mode === 'new' ? 'A new version with its own comments — handy for reviewing changes over time.' : 'Swap the current version’s site to this URL (comments are kept).'}</p>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3">
              <Globe size={16} className="text-gray-400" />
              <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addUrl(); }} placeholder="https://example.com" className="flex-1 outline-none text-sm" />
            </div>
            <button onClick={addUrl} disabled={!url.trim()} className="mt-5 bg-[#473AE0] text-white rounded-full px-6 py-2.5 text-sm font-medium hover:bg-[#3a2fc0] disabled:opacity-50">{mode === 'current' ? 'Replace current version' : 'Add version'}</button>
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-gray-500 text-sm mb-4">{mode === 'new' ? <>Upload a static site <b>.zip</b> as a new version.</> : <>Upload a static site <b>.zip</b> to replace the current version (comments are kept).</>}</p>
            <input ref={fileRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => onFile(e.target.files[0])} />
            <button onClick={() => fileRef.current && fileRef.current.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files[0]); }}
                    className={`w-full border-2 border-dashed rounded-xl py-12 flex flex-col items-center gap-2 ${dragOver ? 'border-indigo-400 bg-indigo-50 text-indigo-500' : 'border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-400'}`}>
              <Upload size={22} /><span className="text-sm">{dragOver ? 'Drop the .zip here' : 'Click or drag a .zip here'}</span>
            </button>
          </div>
        )}
        {err && <div className="text-sm text-red-500 mt-3">{err}</div>}
        </div>
      </div>
    </div>
  );
}
