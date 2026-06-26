/* Design module shared constants & pure helpers (used by editor + inspector). */
import {
  Monitor, Tablet, Smartphone, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Image as ImageIcon, Video, LayoutGrid, Square,
} from 'lucide-react';

export const DEVICES = { desktop: { w: '100%', icon: Monitor, label: 'Desktop' }, tablet: { w: '820px', icon: Tablet, label: 'Tablet' }, mobile: { w: '390px', icon: Smartphone, label: 'Mobile' } };
export const ALIGNS = ['left', 'center', 'right', 'justify'];
export const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify };
export const EDIT_STYLE_ID = '__dz_style';
export const USER_STYLE_ID = '__dz_user_styles';
export const INPUT = 'w-full bg-gray-100 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#473AE0]/40 placeholder-gray-400';

// inline gray placeholder used by inserted <img> elements
export const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='300'%3E%3Crect width='480' height='300' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' fill='%239ca3af' font-family='sans-serif' font-size='20' text-anchor='middle' dominant-baseline='middle'%3EImage%3C/text%3E%3C/svg%3E";
// Insert-menu items: [type, label, icon]. Order matches the Framer "Adding Elements" doc.
export const INSERT_ITEMS = [
  ['frame', 'Frame', Square],
  ['stack', 'Stack', LayoutGrid],
  ['grid', 'Grid', LayoutGrid],
  ['masonry', 'Masonry', LayoutGrid],
  ['image', 'Image', ImageIcon],
  ['video', 'Video', Video],
];
// Build a fresh element of the requested kind. Inserted elements are kept "bare": no cosmetic
// inline styling (no background, radius, padding, min-height, etc.) so the inspector starts clean
// with no pre-filled rows. Only the single property that makes a type *function* is set —
// display for Stack/Grid, columns for Masonry. Frame is a plain, unstyled <div>.
export const makeInsertEl = (d, type) => {
  if (type === 'text') { const e = d.createElement('p'); e.textContent = 'Text'; return e; }
  if (type === 'image') { const e = d.createElement('img'); e.setAttribute('src', PLACEHOLDER_IMG); e.setAttribute('alt', ''); return e; }
  if (type === 'video') { const e = d.createElement('video'); e.setAttribute('controls', ''); return e; }
  const e = d.createElement('div');
  if (type === 'stack') e.style.setProperty('display', 'flex');
  else if (type === 'grid') e.style.setProperty('display', 'grid');
  else if (type === 'masonry') e.style.setProperty('columns', '3');
  // frame → bare <div>, no inline styles
  return e;
};

export const uid = () => Math.random().toString(36).slice(2, 9);
export const MODAL_INPUT = 'w-full bg-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#473AE0]/40 placeholder-gray-400';
export const cssNum = (v) => (v === '' || v == null ? '' : String(v));
export const rgbToHex = (rgb) => {
  if (!rgb) return '';
  if (rgb.startsWith('#')) return rgb;
  const m = rgb.match(/rgba?\(([^)]+)\)/); if (!m) return '';
  const [r, g, b] = m[1].split(',').map((x) => parseInt(x, 10));
  if ([r, g, b].some((n) => Number.isNaN(n))) return '';
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
};
// add a px unit only for bare numbers
export const withUnit = (v) => (v === '' ? '' : (/[a-z%)]/i.test(v) ? v : v + 'px'));
// nudge the numeric part of a value (e.g. "16px" → "17px") for ↑/↓ arrow keys, keeping its unit
export const bumpValue = (str, delta) => {
  const m = String(str || '').match(/^\s*(-?\d*\.?\d+)\s*([a-z%]*)\s*$/i);
  const n = m ? parseFloat(m[1]) : 0;
  const unit = m ? (m[2] || '') : '';
  const next = Math.round((n + delta) * 1000) / 1000;
  return next + unit;
};

/* CSS filter() helpers (multiple functions live in one `filter` string) */
export const FILTER_FNS = [
  { fn: 'blur', label: 'Blur', unit: 'px', max: 30 },
  { fn: 'brightness', label: 'Brightness', unit: '%', max: 200 },
  { fn: 'contrast', label: 'Contrast', unit: '%', max: 200 },
  { fn: 'grayscale', label: 'Grayscale', unit: '%', max: 100 },
  { fn: 'hue-rotate', label: 'Hue', unit: 'deg', max: 360 },
  { fn: 'invert', label: 'Invert', unit: '%', max: 100 },
  { fn: 'saturate', label: 'Saturate', unit: '%', max: 300 },
  { fn: 'sepia', label: 'Sepia', unit: '%', max: 100 },
];
export const parseFilter = (s) => { const m = {}; String(s || '').replace(/([\w-]+)\(([^)]*)\)/g, (_, k, v) => { m[k] = v.trim(); return ''; }); return m; };
export const buildFilter = (m) => Object.entries(m).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}(${v})`).join(' ');

/* ---- transform (Scale / Skew / Rotate / Depth / Perspective) ---- */
// Rebuild in a fixed order so perspective() stays first (required for 3D) and functions don't
// reshuffle as the user edits one axis at a time.
export const TRANSFORM_ORDER = ['perspective', 'translateZ', 'rotate', 'rotateX', 'rotateY', 'skewX', 'skewY', 'scale'];
export const parseTransform = (s) => { const m = {}; String(s || '').replace(/([\w-]+)\(([^)]*)\)/g, (_, k, v) => { m[k] = v.trim(); return ''; }); return m; };
export const buildTransform = (m) => TRANSFORM_ORDER.filter((k) => m[k] !== '' && m[k] != null).map((k) => `${k}(${m[k]})`).join(' ');

/* ---- scroll animation (reveal on view) ---- */
export const ANIM_DEFAULT = { opacity: 0, y: 30, scale: 1, rotate: 0, skew: 0, duration: 0.6, delay: 0, ease: 'ease-in-out', replay: false, threshold: 0.2 };
export const parseAnim = (s) => { try { const o = JSON.parse(s); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } };
export const ANIM_RUNTIME_ID = '__dz_anim_runtime';
// Self-contained reveal-on-scroll runtime embedded into saved pages (and used for in-editor preview).
export const ANIM_RUNTIME = `(function(){function p(s){try{return JSON.parse(s)}catch(e){return null}}function from(a){var t=[];if(a.y)t.push('translateY('+a.y+'px)');if(a.scale&&a.scale!=1)t.push('scale('+a.scale+')');if(a.rotate)t.push('rotate('+a.rotate+'deg)');if(a.skew)t.push('skew('+a.skew+'deg)');return t.join(' ')}var els=[].slice.call(document.querySelectorAll('[data-dz-anim]'));els.forEach(function(el){var a=p(el.getAttribute('data-dz-anim'));if(!a)return;var d=a.duration||0.6,dl=a.delay||0,e=a.ease||'ease-in-out';el.style.transition='opacity '+d+'s '+e+' '+dl+'s, transform '+d+'s '+e+' '+dl+'s';el.style.opacity=(a.opacity!=null?a.opacity:0);el.style.transform=from(a);el.style.willChange='opacity, transform'});if(!('IntersectionObserver' in window)){els.forEach(function(el){el.style.opacity=1;el.style.transform='none'});return}var io=new IntersectionObserver(function(en){en.forEach(function(x){var el=x.target,a=p(el.getAttribute('data-dz-anim'));if(!a)return;if(x.isIntersecting){el.style.opacity=1;el.style.transform='none';if(!a.replay)io.unobserve(el)}else if(a.replay){el.style.opacity=(a.opacity!=null?a.opacity:0);el.style.transform=from(a)}})},{threshold:0.15});els.forEach(function(el){io.observe(el)});window.__dzAnimStop=function(){try{io.disconnect()}catch(e){}};})();`;
