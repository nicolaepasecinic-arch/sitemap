/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Pipette, Plus, Search, Trash2, Upload, Loader2 } from 'lucide-react';
import { uploadMarkupAttachment } from '../markup/markupApi';

/* ------------------------------------------------------------------ *
 *  Fill control — produces a CSS `background` value with 5 fill types:
 *  Color, Linear / Radial / Conic gradient, and Image. Integrates the
 *  project's colour tokens (click to apply, "New Style" to create one).
 * ------------------------------------------------------------------ */

const INPUT = 'w-full bg-gray-100 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#473AE0]/40 placeholder-gray-400';
const ACCENT = '#473AE0';
const uid = () => Math.random().toString(36).slice(2, 9);
const isHex = (s) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s || '');

/* split a comma list at top level (ignore commas inside parens, e.g. rgba()) */
function splitTop(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function parseStops(grad) {
  const inner = grad.slice(grad.indexOf('(') + 1, grad.lastIndexOf(')'));
  let parts = splitTop(inner);
  // drop the leading angle / "from Ndeg" / "circle at .." token if it isn't a colour stop
  if (parts.length && /deg|to\s|circle|ellipse|closest|farthest|at\s/i.test(parts[0]) && !/^#|rgb|hsl|[a-z]+\s+\d/i.test(parts[0].replace(/.*\)/, ''))) {
    if (!/%/.test(parts[0]) && !isHex(parts[0])) parts = parts.slice(1);
  }
  const stops = parts.map((p) => { const m = p.match(/(.*?)(?:\s+([\d.]+)%)?$/); const color = (m && m[1] ? m[1] : p).trim(); const pos = m && m[2] != null ? parseFloat(m[2]) : null; return { id: uid(), color, pos }; }).filter((s) => s.color);
  // fill missing positions evenly
  stops.forEach((s, i) => { if (s.pos == null) s.pos = Math.round((i / Math.max(1, stops.length - 1)) * 100); });
  return stops.length ? stops : DEFAULT_STOPS();
}
const DEFAULT_STOPS = () => [{ id: uid(), color: '#4F46E5', pos: 0 }, { id: uid(), color: '#000000', pos: 100 }];

export function parseFill(v) {
  const s = String(v || '').trim();
  const base = { type: 'color', color: '', stops: DEFAULT_STOPS(), angle: 90, size: 'cover', position: 'center', url: '' };
  if (!s) return base;
  if (/^url\(/i.test(s)) { const m = s.match(/url\(["']?([^"')]+)["']?\)/i); return { ...base, type: 'image', url: m ? m[1] : '', size: /contain/.test(s) ? 'contain' : /auto/.test(s) ? 'auto' : 'cover' }; }
  if (/^linear-gradient/i.test(s)) { const a = s.match(/(-?[\d.]+)deg/); return { ...base, type: 'linear', angle: a ? parseFloat(a[1]) : 90, stops: parseStops(s) }; }
  if (/^radial-gradient/i.test(s)) return { ...base, type: 'radial', stops: parseStops(s) };
  if (/^conic-gradient/i.test(s)) { const a = s.match(/from\s+(-?[\d.]+)deg/); return { ...base, type: 'conic', angle: a ? parseFloat(a[1]) : 0, stops: parseStops(s) }; }
  return { ...base, type: 'color', color: s };
}
export function buildFill(m) {
  if (m.type === 'color') return m.color || '';
  if (m.type === 'image') return m.url ? `url("${m.url}") ${m.position || 'center'} / ${m.size || 'cover'} no-repeat` : '';
  const stops = (m.stops || []).slice().sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${s.pos}%`).join(', ');
  if (m.type === 'linear') return `linear-gradient(${m.angle == null ? 90 : m.angle}deg, ${stops})`;
  if (m.type === 'radial') return `radial-gradient(circle at ${m.position || 'center'}, ${stops})`;
  if (m.type === 'conic') return `conic-gradient(from ${m.angle == null ? 0 : m.angle}deg at ${m.position || 'center'}, ${stops})`;
  return '';
}
const previewCss = (v) => { const m = parseFill(v); if (m.type === 'color') return m.color || 'transparent'; if (m.type === 'image') return m.url ? `center/cover no-repeat url("${m.url}")` : '#e5e7eb'; return buildFill(m); };

const TYPES = [['color', 'Color'], ['linear', 'Linear'], ['radial', 'Radial'], ['conic', 'Conic'], ['image', 'Image']];

/* ---- colour math for the inline HSV picker ---- */
function hexToRgb(hex) { let h = String(hex).replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
function parseColor(v) { v = String(v || '').trim(); if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return { ...hexToRgb(v), a: 1 }; const m = v.match(/rgba?\(([^)]+)\)/i); if (m) { const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0, a: p[3] == null ? 1 : p[3] }; } return { r: 255, g: 255, b: 255, a: 1 }; }
function rgbToHsv(r, g, b) { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; let h = 0; if (d) { if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return { h, s: max ? d / max : 0, v: max }; }
function hsvToRgb(h, s, v) { const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c; let r = 0, g = 0, b = 0; if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; } return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }; }
const colorToHsva = (v) => { const { r, g, b, a } = parseColor(v); return { ...rgbToHsv(r, g, b), a: a == null ? 1 : a }; };
const hsvaToHex = (c) => { const { r, g, b } = hsvToRgb(c.h, c.s, c.v); return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join(''); };
const hsvaToCss = (c) => { const { r, g, b } = hsvToRgb(c.h, c.s, c.v); return c.a >= 1 ? hsvaToHex(c) : `rgba(${r}, ${g}, ${b}, ${Math.round(c.a * 100) / 100})`; };

function HsvPicker({ value, onChange }) {
  const [c, setC] = useState(() => colorToHsva(value));
  const drag = useRef(false);
  useEffect(() => { if (!drag.current) setC(colorToHsva(value)); }, [value]);
  const emit = (nc) => { setC(nc); onChange(hsvaToCss(nc)); };
  const sq = useRef(null);
  const move = (e) => { const r = sq.current.getBoundingClientRect(); const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)); emit({ ...c, s: x, v: 1 - y }); };
  const down = (e) => { drag.current = true; move(e); const mv = (ev) => move(ev); const up = () => { drag.current = false; document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }; document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up); };
  const [hexV, setHexV] = useState(''); const hf = useRef(false);
  useEffect(() => { if (!hf.current) setHexV(hsvaToHex(c)); }, [c]);
  return (
    <div>
      <div ref={sq} onMouseDown={down} className="relative h-32 rounded-lg cursor-crosshair select-none" style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${c.h},100%,50%)` }}>
        <span className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${c.s * 100}%`, top: `${(1 - c.v) * 100}%`, background: hsvaToHex(c) }} />
      </div>
      <input type="range" min={0} max={360} value={c.h} onChange={(e) => emit({ ...c, h: Number(e.target.value) })} className="w-full mt-2 h-2" style={{ accentColor: `hsl(${c.h},100%,50%)` }} />
      <input type="range" min={0} max={1} step={0.01} value={c.a} onChange={(e) => emit({ ...c, a: Number(e.target.value) })} className="w-full accent-gray-600" />
      <div className="flex gap-2 mt-1">
        <input value={hexV} onFocus={() => { hf.current = true; }} onChange={(e) => setHexV(e.target.value)} onBlur={() => { hf.current = false; if (isHex(hexV)) emit({ ...colorToHsva(hexV), a: c.a }); else setHexV(hsvaToHex(c)); }} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} className={`${INPUT} flex-1`} />
        <input value={Math.round(c.a * 100) + '%'} onChange={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n)) emit({ ...c, a: Math.min(1, Math.max(0, n / 100)) }); }} className="w-16 bg-gray-100 rounded-lg px-2 py-1.5 text-sm text-gray-700 outline-none" />
      </div>
    </div>
  );
}

export function FillControl({ value, onChange, colors = [], onNewColor }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const openAt = () => { const r = ref.current && ref.current.getBoundingClientRect(); if (r) setPos({ left: Math.min(r.left, (window.innerWidth || 1200) - 300), top: Math.min(r.bottom + 6, (window.innerHeight || 800) - 460) }); setOpen(true); };
  const m = parseFill(value);
  const label = value ? (m.type === 'color' ? (m.color || 'Color') : m.type[0].toUpperCase() + m.type.slice(1)) : 'Add…';
  return (
    <>
      <button ref={ref} onClick={openAt} className="w-full flex items-center gap-1.5 bg-gray-100 rounded-lg pl-1.5 pr-2 py-1">
        <span className="w-6 h-6 rounded border border-gray-200 shrink-0" style={{ background: previewCss(value) || '#fff' }} />
        <span className="flex-1 min-w-0 truncate text-left text-sm text-gray-600">{label}</span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>
      {open && pos && <FillPopover model={m} onModel={(nm) => onChange(buildFill(nm))} onClear={() => { onChange(''); setOpen(false); }} onClose={() => setOpen(false)} style={{ left: pos.left, top: pos.top }} colors={colors} onNewColor={onNewColor} />}
    </>
  );
}

function FillPopover({ model, onModel, onClose, onClear, style, colors, onNewColor }) {
  const [m, setM] = useState(model);
  const upd = (patch) => { const nm = { ...m, ...patch }; setM(nm); onModel(nm); };
  useEffect(() => { const onKey = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [onClose]);
  return (
    <>
      <div className="fixed inset-0 z-[78]" onMouseDown={onClose} />
      <div style={{ position: 'fixed', ...style, width: 288 }} className="z-[79] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 max-h-[80vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[15px] font-semibold text-gray-900">Fill</span>
          <button onClick={onClose} className="w-6 h-6 rounded hover:bg-gray-100 text-gray-400 flex items-center justify-center"><X size={15} /></button>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5 mb-3">
          {TYPES.map(([t, lbl]) => (
            <button key={t} title={lbl} onClick={() => upd({ type: t })} className={`flex-1 py-1.5 text-[11px] rounded-md ${m.type === t ? 'bg-white shadow-sm text-[#473AE0] font-semibold' : 'text-gray-500'}`}>{lbl}</button>
          ))}
        </div>

        {m.type === 'color' && <ColorPane value={m.color} onChange={(c) => upd({ color: c })} colors={colors} onNewColor={onNewColor} />}
        {(m.type === 'linear' || m.type === 'radial' || m.type === 'conic') && (
          <GradientPane m={m} upd={upd} colors={colors} onNewColor={onNewColor} />
        )}
        {m.type === 'image' && <ImagePane m={m} upd={upd} />}

        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClear} className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1.5"><Trash2 size={13} /> Remove fill</button>
        </div>
      </div>
    </>
  );
}

/* ---------------- Color pane (swatch + hex + alpha + tokens) ---------------- */
function ColorPane({ value, onChange, colors, onNewColor }) {
  const eyedrop = async () => { try { const ed = new window.EyeDropper(); const r = await ed.open(); onChange(r.sRGBHex); } catch (e) { /* cancelled */ } };
  return (
    <div>
      <HsvPicker value={value} onChange={onChange} />
      {window.EyeDropper && <button onClick={eyedrop} className="w-full mt-2 flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg py-1.5 text-sm text-gray-600"><Pipette size={14} /> Pick from screen</button>}
      <TokenList colors={colors} onPick={(hex) => onChange(hex)} onNewColor={onNewColor ? () => onNewColor(isHex(value) ? value : '#000000') : null} />
    </div>
  );
}

// Reusable color picker = a swatch trigger that opens the rich picker (HSV + hex + alpha +
// eyedropper + colour-token list). Use this everywhere a single colour is chosen.
export function ColorPicker({ value, onChange, colors, onNewColor, placeholder }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const openMenu = () => { const r = ref.current && ref.current.getBoundingClientRect(); if (r) setPos({ left: Math.min(r.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 300), top: Math.min(r.bottom + 6, (typeof window !== 'undefined' ? window.innerHeight : 800) - 470) }); setOpen(true); };
  const label = value || placeholder || 'Add…';
  return (
    <>
      <button ref={ref} onClick={openMenu} className="w-full flex items-center gap-1.5 bg-gray-100 rounded-lg pl-1.5 pr-2 py-1 hover:bg-gray-200/70">
        <span className="w-6 h-6 rounded border border-gray-200 shrink-0" style={{ background: value || (placeholder || 'transparent') }} />
        <span className="flex-1 min-w-0 truncate text-left text-sm text-gray-600">{label}</span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>
      {open && pos && (<>
        <div className="fixed inset-0 z-[78]" onMouseDown={() => setOpen(false)} />
        <div style={{ position: 'fixed', left: pos.left, top: pos.top, width: 288 }} className="z-[79] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 max-h-[80vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
          <ColorPane value={value} onChange={onChange} colors={colors} onNewColor={onNewColor} />
        </div>
      </>)}
    </>
  );
}

function TokenList({ colors, onPick, onNewColor }) {
  const [q, setQ] = useState('');
  const list = (colors || []).filter((c) => !q || (c.name || '').toLowerCase().includes(q.toLowerCase()));
  if (!colors) return null;
  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 mb-1"><Search size={13} className="text-gray-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="flex-1 bg-transparent py-1.5 text-sm outline-none" /></div>
      <div className="max-h-40 overflow-y-auto">
        {list.length === 0 && <div className="text-xs text-gray-400 px-1 py-1.5">No colour styles.</div>}
        {list.map((c) => (
          <button key={c.id} onClick={() => onPick(c.light || '#000000')} className="w-full flex items-center gap-2.5 px-1 py-1.5 rounded-lg hover:bg-gray-50 text-sm text-gray-700 text-left">
            <span className="w-4 h-4 rounded-full border border-gray-200 shrink-0" style={{ background: c.light || '#fff' }} /> <span className="truncate">{c.name}</span>
          </button>
        ))}
      </div>
      {onNewColor && <button onClick={onNewColor} className="w-full mt-1 flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg py-2 text-sm text-gray-700"><Plus size={14} /> New Style</button>}
    </div>
  );
}

/* ---------------- Gradient pane ---------------- */
function GradientPane({ m, upd, colors, onNewColor }) {
  const [active, setActive] = useState(0);
  const stops = m.stops || [];
  const setStops = (next) => upd({ stops: next });
  const updStop = (i, patch) => setStops(stops.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const addStop = () => { const next = [...stops, { id: uid(), color: '#888888', pos: 100 }]; setStops(next); setActive(next.length - 1); };
  const delStop = (i) => { if (stops.length <= 2) return; const next = stops.filter((_, k) => k !== i); setStops(next); setActive(Math.max(0, i - 1)); };
  const cur = stops[active] || stops[0] || { color: '#000', pos: 0 };
  const barCss = buildFill({ ...m, type: 'linear', angle: 90 });
  return (
    <div>
      <div className="h-7 rounded-lg border border-gray-200 mb-2" style={{ background: barCss }} />
      {(m.type === 'linear' || m.type === 'conic') && (
        <Row label="Angle"><div className="flex items-center gap-2"><input type="range" min={0} max={360} value={m.angle || 0} onChange={(e) => upd({ angle: Number(e.target.value) })} className="flex-1 accent-[#473AE0]" /><input value={m.angle || 0} onChange={(e) => upd({ angle: Number(e.target.value) || 0 })} className="w-14 bg-gray-100 rounded-lg px-2 py-1 text-sm text-gray-700 outline-none" /></div></Row>
      )}
      <HsvPicker value={cur.color} onChange={(col) => updStop(active, { color: col })} />
      <div className="flex items-center justify-between mt-2 mb-1">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Stops</span>
        <button onClick={addStop} className="text-[12px] text-[#473AE0] flex items-center gap-1"><Plus size={13} /> Add</button>
      </div>
      <div className="space-y-1 mb-2">
        {stops.map((s, i) => (
          <div key={s.id} onMouseDown={() => setActive(i)} className={`flex items-center gap-2 rounded-lg px-1.5 py-1 cursor-pointer ${i === active ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
            <span className="w-5 h-5 rounded border border-gray-200 shrink-0" style={{ background: s.color }} />
            <span className="flex-1 min-w-0 truncate text-sm text-gray-600">{s.color}</span>
            <input type="number" value={s.pos} onMouseDown={(e) => e.stopPropagation()} onChange={(e) => updStop(i, { pos: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className="w-14 bg-gray-100 rounded-lg px-2 py-1 text-sm text-gray-700 outline-none" />
            <button onClick={(e) => { e.stopPropagation(); delStop(i); }} disabled={stops.length <= 2} className="w-6 h-6 rounded text-gray-300 hover:text-red-500 disabled:opacity-30 flex items-center justify-center shrink-0"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <TokenList colors={colors} onPick={(hex) => updStop(active, { color: hex })} onNewColor={onNewColor ? () => onNewColor(isHex(cur.color) ? cur.color : '#000000') : null} />
    </div>
  );
}

/* ---------------- Image pane ---------------- */
function ImagePane({ m, upd }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const onFile = (file) => {
    if (!file) return;
    setBusy(true); setErr('');
    const reader = new FileReader();
    reader.onload = async () => {
      try { const res = await uploadMarkupAttachment(file.name, reader.result); upd({ url: res.url }); }
      catch (e) { setErr(e.message || 'Upload failed'); }
      finally { setBusy(false); }
    };
    reader.onerror = () => { setErr('Could not read the file.'); setBusy(false); };
    reader.readAsDataURL(file);
  };
  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files[0])} />
      <button onClick={() => fileRef.current && fileRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
        className="w-full h-28 rounded-lg border-2 border-dashed border-gray-200 mb-2 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-[#473AE0]/40 hover:text-[#473AE0] relative overflow-hidden"
        style={m.url ? { backgroundImage: `url("${m.url}")`, backgroundSize: 'cover', backgroundPosition: 'center', borderStyle: 'solid' } : {}}>
        {!m.url && (busy ? <Loader2 size={20} className="animate-spin" /> : <><Upload size={20} /><span className="text-xs">Click or drop an image</span></>)}
        {m.url && busy && <div className="absolute inset-0 bg-black/30 flex items-center justify-center"><Loader2 size={22} className="animate-spin text-white" /></div>}
      </button>
      {err && <div className="text-xs text-red-500 mb-2">{err}</div>}
      <Row label="Image URL"><input value={m.url || ''} onChange={(e) => upd({ url: e.target.value })} placeholder="Upload above, or paste a URL…" className={INPUT} /></Row>
      <Row label="Type"><Sel value={m.size} onChange={(v) => upd({ size: v })} options={[['cover', 'Fill'], ['contain', 'Fit'], ['auto', 'Auto'], ['100% 100%', 'Stretch']]} /></Row>
      <Row label="Position"><Sel value={m.position} onChange={(v) => upd({ position: v })} options={[['center', 'Center'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right'], ['top left', 'Top left'], ['top right', 'Top right'], ['bottom left', 'Bottom left'], ['bottom right', 'Bottom right']]} /></Row>
    </div>
  );
}

function Row({ label, children }) { return (<div className="flex items-center gap-2 mb-2"><label className="text-sm text-gray-500 w-[72px] shrink-0">{label}</label><div className="flex-1 min-w-0">{children}</div></div>); }
function Sel({ value, onChange, options }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} appearance-none pr-7`}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" style={{ color: undefined }} />
    </div>
  );
}
export { ACCENT };
