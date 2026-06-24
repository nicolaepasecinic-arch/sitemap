/* ------------------------------------------------------------------ */
/*  Sitemap visual theme: colour system, wireframe glyphs, geometry.  */
/*  Pure/presentational — imported by SitemapBuilder and the Dashboard. */
/* ------------------------------------------------------------------ */
import React from 'react';

/* ------------------------------------------------------------------ */
/*  Color system                                                       */
/* ------------------------------------------------------------------ */
export const COLORS = {
  blue:    { name: 'Blue',    solid: '#473AE0', soft: '#5C4FE8' },
  teal:    { name: 'Teal',    solid: '#10B981', soft: '#13C08A' },
  green:   { name: 'Green',   solid: '#22C55E', soft: '#34D06A' },
  lime:    { name: 'Lime',    solid: '#84CC16', soft: '#97D72E' },
  orange:  { name: 'Orange',  solid: '#F59E0B', soft: '#FBB024' },
  red:     { name: 'Red',     solid: '#EF4444', soft: '#F25C5C' },
  pink:    { name: 'Pink',    solid: '#EC4899', soft: '#F25CAE' },
  fuchsia: { name: 'Fuchsia', solid: '#D946EF', soft: '#E05CF5' },
  purple:  { name: 'Purple',  solid: '#8B5CF6', soft: '#9B6BFA' },
  indigo:  { name: 'Indigo',  solid: '#6366F1', soft: '#7679F4' },
  slate:   { name: 'Slate',   solid: '#64748B', soft: '#76859A' },
  steel:   { name: 'Steel',   solid: '#94A3B8', soft: '#A3B0C2' },
  // backward-compat alias for older saved data
  topaz:   { name: 'Teal',    solid: '#10B981', soft: '#13C08A' },
};
export const COLOR_KEYS = ['blue', 'teal', 'green', 'lime', 'orange', 'red', 'pink', 'fuchsia', 'purple', 'indigo', 'slate', 'steel'];

/* color can be a preset key or a raw hex string */
export const resolveColor = (c) => COLORS[c] || { name: 'Custom', solid: c || '#473AE0', soft: c || '#5C4FE8' };

/* classic sticky-note colors (4) */
export const NOTE_COLORS = {
  yellow: { bg: '#FFF4B8', edge: '#F4E58A' },
  pink:   { bg: '#FFD8E4', edge: '#F4BBCD' },
  blue:   { bg: '#C9E7FF', edge: '#A7D4F5' },
  green:  { bg: '#D7F5D0', edge: '#B6E8AC' },
};
export const NOTE_KEYS = ['yellow', 'pink', 'blue', 'green'];

/* the current user (author of comments) */
export const ME = { name: 'You', initials: 'PU', color: '#EC4899' };

/* canvas themes (project setting) */
export const THEMES = {
  light:     { name: 'Light',     bg: '#FBFCFE', dot: '#E5EAF2' },
  dark:      { name: 'Dark',      bg: '#111827', dot: '#374151' },
  blueprint: { name: 'Blueprint', bg: '#EAF1FB', dot: '#C7D8F0' },
  bold:      { name: 'Bold',      bg: '#DCE6F5', dot: '#BBceED' },
};
export const THEME_KEYS = ['light', 'dark', 'blueprint', 'bold'];
export const FRAME_OPTIONS = [
  { key: 'web', name: 'Web', frame: 'window' },
  { key: 'mobile', name: 'Mobile', frame: 'phone' },
  { key: 'neutral', name: 'Neutral', frame: 'plain' },
];
export const frameDefaultFor = (k) => (FRAME_OPTIONS.find((f) => f.key === k) || FRAME_OPTIONS[0]).frame;

/* relative time for comments */
export function relTime(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/* ------------------------------------------------------------------ */
/*  Wireframe frames — each block can render a different layout glyph   */
/* ------------------------------------------------------------------ */
export const FRAME_KEYS = [
  'bar', 'text', 'carousel',
  'cols2', 'text2', 'dots',
  'cols3', 'text3', 'banner',
  'cols4', 'text4', 'table',
  'carousel2', 'cards2', 'text2b',
  'carousel3', 'cards3', 'dashes',
  'media-text', 'list2', 'text-media',
  'cards-grid', 'media-split', 'video',
  'iconrow', 'video-center', 'list',
];

/* Outline-style wireframe glyph that fills its container (matches reference). */
export function FrameGlyph({ frame }) {
  if (frame === 'none') return null; // clean section — no wireframe glyph
  const st = { stroke: 'currentColor', strokeWidth: 2, fill: 'none', vectorEffect: 'non-scaling-stroke' };
  const B = (x, y, w, h) => <rect key={'b' + x + y + w + h} x={x} y={y} width={w} height={h} rx="3" {...st} />;
  const L = (x, y, w, o = 0.85) => <rect key={'l' + x + y + w + o} x={x} y={y} width={w} height="2.6" rx="1.3" fill="currentColor" opacity={o} />;
  const aL = (x, cy) => <path key={'al' + x} d={`M${x + 5} ${cy - 5} L${x} ${cy} L${x + 5} ${cy + 5}`} {...st} strokeWidth="2" />;
  const aR = (x, cy) => <path key={'ar' + x} d={`M${x - 5} ${cy - 5} L${x} ${cy} L${x - 5} ${cy + 5}`} {...st} strokeWidth="2" />;
  const dot = (cx, cy) => <circle key={'d' + cx + cy} cx={cx} cy={cy} r="2.4" fill="currentColor" />;
  const play = (cx, cy) => <path key={'p' + cx} d={`M${cx - 4} ${cy - 5} l9 5 l-9 5 Z`} fill="currentColor" />;
  let c;
  switch (frame) {
    case 'text':        c = [L(8, 9, 84), L(8, 18, 84), L(8, 27, 52)]; break;
    case 'carousel':    c = [aL(6, 18), B(16, 8, 68, 20), aR(94, 18)]; break;
    case 'cols2':       c = [B(8, 8, 38, 20), B(54, 8, 38, 20)]; break;
    case 'text2':       c = [L(8, 11, 38), L(8, 19, 38, 0.55), L(54, 11, 38), L(54, 19, 38, 0.55)]; break;
    case 'text2b':      c = [L(8, 13, 36), L(50, 11, 42), L(50, 19, 42, 0.55)]; break;
    case 'dots':        c = [B(8, 8, 56, 20), dot(76, 18), dot(84, 18), dot(92, 18)]; break;
    case 'cols3':       c = [B(8, 8, 25, 20), B(37, 8, 26, 20), B(67, 8, 25, 20)]; break;
    case 'text3':       c = [L(8, 11, 25), L(8, 19, 25, 0.55), L(37, 11, 26), L(37, 19, 26, 0.55), L(67, 11, 25), L(67, 19, 25, 0.55)]; break;
    case 'banner':      c = [B(8, 8, 84, 20), L(36, 17, 28)]; break;
    case 'cols4':       c = [B(8, 9, 17, 18), B(29, 9, 17, 18), B(54, 9, 17, 18), B(75, 9, 17, 18)]; break;
    case 'text4':       c = [L(8, 12, 17), L(8, 20, 17, 0.55), L(29, 12, 17), L(29, 20, 17, 0.55), L(54, 12, 17), L(54, 20, 17, 0.55), L(75, 12, 17), L(75, 20, 17, 0.55)]; break;
    case 'table':       c = [B(8, 8, 84, 20), <path key="tg" d="M8 18 H92 M36 8 V28 M64 8 V28" {...st} strokeWidth="1.6" />]; break;
    case 'carousel2':   c = [aL(6, 18), B(18, 9, 28, 18), B(52, 9, 28, 18), aR(94, 18)]; break;
    case 'cards2':      c = [B(8, 6, 38, 14), B(54, 6, 38, 14), L(8, 25, 38), L(54, 25, 38)]; break;
    case 'carousel3':   c = [aL(6, 18), B(16, 10, 22, 16), B(40, 10, 22, 16), B(64, 10, 22, 16), aR(94, 18)]; break;
    case 'cards3':      c = [B(8, 6, 25, 13), B(37, 6, 26, 13), B(67, 6, 25, 13), L(8, 24, 25), L(37, 24, 26), L(67, 24, 25)]; break;
    case 'dashes':      c = [L(10, 18, 16), L(34, 18, 9), L(48, 18, 9)]; break;
    case 'media-text':  c = [B(8, 8, 36, 20), L(50, 10, 42), L(50, 18, 42, 0.6), L(50, 25, 26, 0.6)]; break;
    case 'text-media':  c = [L(8, 10, 42), L(8, 18, 42, 0.6), L(8, 25, 26, 0.6), B(56, 8, 36, 20)]; break;
    case 'list2':       c = [B(8, 8, 14, 14), L(26, 10, 22), L(26, 16, 22, 0.55), B(54, 8, 14, 14), L(72, 10, 22), L(72, 16, 22, 0.55)]; break;
    case 'cards-grid':  c = [B(8, 6, 25, 13), B(37, 6, 26, 13), B(67, 6, 25, 13), L(8, 23, 25, 0.6), L(37, 23, 26, 0.6), L(67, 23, 25, 0.6)]; break;
    case 'media-split': c = [B(8, 8, 50, 20), B(64, 8, 28, 20)]; break;
    case 'video':       c = [B(8, 8, 36, 20), play(24, 18), L(50, 12, 42), L(50, 21, 28, 0.6)]; break;
    case 'video-center':c = [B(8, 8, 84, 20), play(50, 18)]; break;
    case 'iconrow':     c = [dot(12, 18), B(22, 9, 18, 18), B(44, 9, 18, 18), B(66, 9, 18, 18)]; break;
    case 'list':        c = [dot(11, 11), L(18, 10, 74), dot(11, 25), L(18, 24, 74)]; break;
    case 'bar':
    default:            c = [B(8, 9, 84, 18)];
  }
  return <svg viewBox="0 0 100 36" width="100%" height="100%" preserveAspectRatio="none" vectorEffect="non-scaling-stroke">{c}</svg>;
}

/* ------------------------------------------------------------------ */
/*  Page frames — outer card style (the "Frame" page option)           */
/* ------------------------------------------------------------------ */
export const PAGE_FRAMES = ['window', 'brackets', 'pill', 'stacked'];

export function PageFrameGlyph({ frame }) {
  const s = { stroke: 'currentColor', strokeWidth: 1.6, fill: 'none' };
  let c;
  switch (frame) {
    case 'brackets':
      c = [<path key="b" d="M4 7 V4 H7 M21 4 H24 V7 M24 17 V20 H21 M7 20 H4 V17" {...s} />]; break;
    case 'pill':
      c = [<rect key="p" x="4" y="9" width="20" height="6" rx="3" {...s} />]; break;
    case 'phone':
      c = [<rect key="ph" x="8" y="3" width="12" height="18" rx="3.5" {...s} />,
           <rect key="no" x="11.5" y="4.5" width="5" height="1.4" rx="0.7" fill="currentColor" stroke="none" />]; break;
    case 'plain':
      c = [<rect key="pl" x="4" y="5" width="20" height="14" rx="3.5" {...s} />]; break;
    case 'stacked':
      c = [<rect key="s2" x="7" y="7" width="16" height="13" rx="2" {...s} opacity="0.5" />,
           <rect key="s1" x="4" y="4" width="16" height="13" rx="2" {...s} />]; break;
    case 'window':
    default:
      c = [<rect key="w" x="4" y="4" width="20" height="16" rx="2" {...s} />,
           <path key="wl" d="M4 9 H24" {...s} />]; break;
  }
  return <svg viewBox="0 0 28 24" width="26" height="22">{c}</svg>;
}

/* ------------------------------------------------------------------ */
/*  Geometry constants                                                 */
/* ------------------------------------------------------------------ */
export const CARD_W = 224;
export const HEADER_H = 46;
export const BLOCK_H = 60;
export const BLOCK_GAP = 6;
export const BODY_PAD = 10;
export const EMPTY_BODY = 40;
export const ADD_ROW = 26;
export const H_GAP = 46;
export const V_GAP = 78;
export const MARGIN = 80;

export const uid = () => Math.random().toString(36).slice(2, 9);

export const cardHeight = (n) => {
  if (!n.blocks || n.blocks.length === 0) return HEADER_H + EMPTY_BODY;
  return (
    HEADER_H +
    BODY_PAD * 2 +
    n.blocks.length * BLOCK_H +
    (n.blocks.length - 1) * BLOCK_GAP +
    BLOCK_GAP + ADD_ROW
  );
};
