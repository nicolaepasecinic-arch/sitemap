import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, LayoutGrid, ArrowLeft, Check, CheckCircle2, PlusSquare, Copy,
  Download, Upload, Save, Sparkles, StickyNote, Share2, ExternalLink, Unlink, MoveUpRight,
  MessageSquare, Paperclip, Search, Play, X, RotateCcw, RotateCw, Pencil, Menu,
  Settings, Sliders, Palette, Bold, Italic, Underline, List, Send
} from 'lucide-react';
import BrandStar from './Brand';

/* ------------------------------------------------------------------ */
/*  Color system                                                       */
/* ------------------------------------------------------------------ */
const COLORS = {
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
const COLOR_KEYS = ['blue', 'teal', 'green', 'lime', 'orange', 'red', 'pink', 'fuchsia', 'purple', 'indigo', 'slate', 'steel'];

/* color can be a preset key or a raw hex string */
const resolveColor = (c) => COLORS[c] || { name: 'Custom', solid: c || '#473AE0', soft: c || '#5C4FE8' };

/* classic sticky-note colors (4) */
const NOTE_COLORS = {
  yellow: { bg: '#FFF4B8', edge: '#F4E58A' },
  pink:   { bg: '#FFD8E4', edge: '#F4BBCD' },
  blue:   { bg: '#C9E7FF', edge: '#A7D4F5' },
  green:  { bg: '#D7F5D0', edge: '#B6E8AC' },
};
const NOTE_KEYS = ['yellow', 'pink', 'blue', 'green'];

/* the current user (author of comments) */
const ME = { name: 'You', initials: 'PU', color: '#EC4899' };

/* canvas themes (project setting) */
const THEMES = {
  light:     { name: 'Light',     bg: '#FBFCFE', dot: '#E5EAF2' },
  dark:      { name: 'Dark',      bg: '#111827', dot: '#374151' },
  blueprint: { name: 'Blueprint', bg: '#EAF1FB', dot: '#C7D8F0' },
  bold:      { name: 'Bold',      bg: '#DCE6F5', dot: '#BBceED' },
};
const THEME_KEYS = ['light', 'dark', 'blueprint', 'bold'];
const FRAME_OPTIONS = [
  { key: 'web', name: 'Web', frame: 'window' },
  { key: 'mobile', name: 'Mobile', frame: 'phone' },
  { key: 'neutral', name: 'Neutral', frame: 'plain' },
];
const frameDefaultFor = (k) => (FRAME_OPTIONS.find((f) => f.key === k) || FRAME_OPTIONS[0]).frame;

/* relative time for comments */
function relTime(ts) {
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
const FRAME_KEYS = [
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
function FrameGlyph({ frame }) {
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
const PAGE_FRAMES = ['window', 'brackets', 'pill', 'stacked'];

function PageFrameGlyph({ frame }) {
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
const CARD_W = 224;
const HEADER_H = 46;
const BLOCK_H = 60;
const BLOCK_GAP = 6;
const BODY_PAD = 10;
const EMPTY_BODY = 40;
const ADD_ROW = 26;
const H_GAP = 46;
const V_GAP = 78;
const MARGIN = 80;

const uid = () => Math.random().toString(36).slice(2, 9);

const cardHeight = (n) => {
  if (!n.blocks || n.blocks.length === 0) return HEADER_H + EMPTY_BODY;
  return (
    HEADER_H +
    BODY_PAD * 2 +
    n.blocks.length * BLOCK_H +
    (n.blocks.length - 1) * BLOCK_GAP +
    BLOCK_GAP + ADD_ROW
  );
};

/* ================================================================== */
export default function SitemapBuilder({ project, onBack, onChange }) {
  const [nodes, setNodes] = useState(() => project?.nodes || []);
  const [selectedId, setSelectedId] = useState(null);
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingBlock, setEditingBlock] = useState(null); // {nodeId, blockId}
  const [draft, setDraft] = useState('');
  const [colorOpenId, setColorOpenId] = useState(null);
  const [linkOpenId, setLinkOpenId] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null); // {nodeId, blockId}
  const [framePickerId, setFramePickerId] = useState(null); // nodeId whose SECTION toolbar has the wireframe picker open
  const [pageFrameOpenId, setPageFrameOpenId] = useState(null); // nodeId whose PAGE toolbar has the frame submenu open
  const [secColorOpen, setSecColorOpen] = useState(false); // section color palette open
  const [arrowMode, setArrowMode] = useState(null); // {nodeId, blockId} — pick target pages to link to a section
  const [selectedEdge, setSelectedEdge] = useState(null); // childId of the connector being edited
  const [selectedArrow, setSelectedArrow] = useState(null); // {nodeId, blockId, targetId} of a section→page arrow
  const [projectName, setProjectName] = useState(project?.name || 'Untitled project');
  const [exportOpen, setExportOpen] = useState(false);
  // canvas objects (notes / links / comments)
  const [items, setItems] = useState(() => project?.items || []);
  const [selectedItem, setSelectedItem] = useState(null); // item id
  const [linkEditId, setLinkEditId] = useState(null);      // link item id being edited
  const [commentMode, setCommentMode] = useState(false);   // click-to-place comment mode
  const [commentsPanel, setCommentsPanel] = useState(false);
  const [toast, setToast] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [projMenuOpen, setProjMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sectionDetail, setSectionDetail] = useState(null); // {nodeId, blockId}
  const [settings, setSettings] = useState(() => ({ theme: 'light', frame: 'web', colorList: COLOR_KEYS, ...(project?.settings || {}) }));
  const [dragId, setDragId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);

  const [view, setView] = useState({ zoom: 0.9, x: 60, y: 90 });
  const panRef = useRef(null);
  const containerRef = useRef(null);
  const blockDragRef = useRef(null);
  const firstSave = useRef(true);

  // -------- undo / redo history --------
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const skipHistory = useRef(false);
  const prevNodes = useRef(nodes);
  const firstHist = useRef(true);
  const [histTick, setHistTick] = useState(0); // re-render to refresh button enabled state

  // persist node / item / settings changes back to the project (skip the very first render)
  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return; }
    onChange?.({ nodes, items, settings });
  }, [nodes, items, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  // track history on every node change (skip undo/redo-driven updates)
  useEffect(() => {
    if (firstHist.current) { firstHist.current = false; prevNodes.current = nodes; return; }
    if (skipHistory.current) { skipHistory.current = false; prevNodes.current = nodes; return; }
    undoStack.current.push(prevNodes.current);
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
    prevNodes.current = nodes;
    setHistTick((t) => t + 1);
  }, [nodes]);

  const undo = () => {
    if (!undoStack.current.length) return;
    const prev = undoStack.current.pop();
    redoStack.current.push(prevNodes.current);
    skipHistory.current = true;
    setNodes(prev);
    setSelectedId(null); setSelectedBlock(null); setSelectedEdge(null); setSelectedArrow(null);
    setHistTick((t) => t + 1);
  };
  const redo = () => {
    if (!redoStack.current.length) return;
    const next = redoStack.current.pop();
    undoStack.current.push(prevNodes.current);
    skipHistory.current = true;
    setNodes(next);
    setSelectedId(null); setSelectedBlock(null); setSelectedEdge(null); setSelectedArrow(null);
    setHistTick((t) => t + 1);
  };

  // keyboard shortcuts for undo / redo
  useEffect(() => {
    const h = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // exit arrow-link mode on Escape
  useEffect(() => {
    if (!arrowMode) return;
    const h = (e) => { if (e.key === 'Escape') setArrowMode(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [arrowMode]);

  // auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /* -------------------- tree helpers -------------------- */
  const childrenOf = useCallback(
    (pid) => nodes.filter((n) => n.parentId === pid && n.group === 'main'),
    [nodes]
  );

  /* -------------------- layout -------------------- */
  const layout = useMemo(() => {
    const pos = {};
    const kids = (pid) => nodes.filter((n) => n.parentId === pid && n.group === 'main');
    const roots = nodes.filter((n) => n.group === 'main' && n.parentId === null);

    const depthOf = {};
    const setDepth = (n, d) => { depthOf[n.id] = d; kids(n.id).forEach((c) => setDepth(c, d + 1)); };
    roots.forEach((r) => setDepth(r, 0));

    const depthH = {};
    nodes.forEach((n) => {
      if (n.group === 'main') {
        const d = depthOf[n.id] ?? 0;
        depthH[d] = Math.max(depthH[d] || 0, cardHeight(n));
      }
    });
    const yOfDepth = (d) => {
      let y = 0;
      for (let k = 0; k < d; k++) y += (depthH[k] || 0) + V_GAP;
      return y;
    };

    let cursor = 0;
    const cx = {};
    const assign = (n) => {
      const ch = kids(n.id);
      if (ch.length === 0) { cx[n.id] = cursor + CARD_W / 2; cursor += CARD_W + H_GAP; }
      else { ch.forEach(assign); cx[n.id] = (cx[ch[0].id] + cx[ch[ch.length - 1].id]) / 2; }
    };
    roots.forEach((r) => { assign(r); cursor += H_GAP; });

    let mainBottom = 0;
    let mainRight = 0;
    let rootCx = CARD_W / 2;
    if (roots.length) rootCx = (cx[roots[0].id] + cx[roots[roots.length - 1].id]) / 2;

    nodes.forEach((n) => {
      if (n.group === 'main') {
        const d = depthOf[n.id] ?? 0;
        const h = cardHeight(n);
        const x = cx[n.id] - CARD_W / 2;
        const y = yOfDepth(d);
        pos[n.id] = { x, y, w: CARD_W, h, cx: cx[n.id] };
        mainBottom = Math.max(mainBottom, y + h);
        mainRight = Math.max(mainRight, x + CARD_W);
      }
    });

    const sectionNodes = nodes.filter((n) => n.group === 'section');
    const sectionY = mainBottom + 150;
    let sc = 0;
    sectionNodes.forEach((n) => {
      const h = cardHeight(n);
      pos[n.id] = { x: sc, y: sectionY, w: CARD_W, h, cx: sc + CARD_W / 2 };
      sc += CARD_W + H_GAP;
      mainRight = Math.max(mainRight, sc);
    });
    const sectionCenter = sectionNodes.length ? (sc - H_GAP) / 2 : 0;
    const bottom = sectionNodes.length ? sectionY + 90 : mainBottom;

    return { pos, mainBottom, sectionY, sectionCenter, rootCx, width: mainRight, bottom,
             hasSection: sectionNodes.length > 0 };
  }, [nodes]);

  /* -------------------- mutations -------------------- */
  const addChild = (parentId) => {
    const node = { id: uid(), label: 'Page', parentId, group: 'main', color: 'blue', blocks: [] };
    setNodes((ns) => [...ns, node]);
    setSelectedId(node.id);
  };
  const addSibling = (node, side) => {
    const newNode = { id: uid(), label: 'Page', parentId: node.parentId, group: node.group, color: 'blue', blocks: [] };
    setNodes((ns) => {
      const i = ns.findIndex((x) => x.id === node.id);
      const copy = [...ns];
      copy.splice(side === 'left' ? i : i + 1, 0, newNode);
      return copy;
    });
    setSelectedId(newNode.id);
  };

  const addRoot = () => {
    const node = { id: uid(), label: 'Page', parentId: null, group: 'main', color: 'blue', link: '', pageFrame: 'window', blocks: [] };
    setNodes((ns) => [...ns, node]);
    setSelectedId(node.id);
  };

  /* -------------------- canvas objects (notes / links / comments) -------------------- */
  const viewCenter = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cw = rect ? rect.width : 900, ch = rect ? rect.height : 600;
    return { x: (cw / 2 - view.x) / view.zoom, y: (ch / 2 - view.y) / view.zoom };
  };
  const addNote = () => {
    const c = viewCenter();
    const it = { id: uid(), type: 'note', x: c.x - 90, y: c.y - 90, w: 184, h: 184, color: 'yellow', text: '' };
    setItems((s) => [...s, it]); setSelectedItem(it.id);
  };
  const addLink = () => {
    const c = viewCenter();
    const it = { id: uid(), type: 'link', x: c.x - 110, y: c.y - 60, url: '', host: '', title: '' };
    setItems((s) => [...s, it]); setSelectedItem(it.id); setLinkEditId(it.id);
  };
  const addCommentAt = (cx, cy) => {
    const it = { id: uid(), type: 'comment', x: cx, y: cy, text: '', author: ME.name, initials: ME.initials, color: ME.color, ts: Date.now() };
    setItems((s) => [...s, it]); setSelectedItem(it.id); setCommentMode(false); setCommentsPanel(true);
  };
  const updateItem = (id, patch) => setItems((s) => s.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const deleteItem = (id) => { setItems((s) => s.filter((i) => i.id !== id)); setSelectedItem(null); setLinkEditId(null); };
  const duplicateItem = (id) => setItems((s) => {
    const it = s.find((i) => i.id === id); if (!it) return s;
    return [...s, { ...it, id: uid(), x: it.x + 24, y: it.y + 24 }];
  });
  const setLinkUrl = (id, url) => {
    let host = '';
    try { host = new URL(/^https?:\/\//.test(url) ? url : 'https://' + url).hostname.replace(/^www\./, ''); } catch (e) {}
    updateItem(id, { url, host, title: host || url });
  };
  const startItemDrag = (e, item) => {
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, ox = item.x, oy = item.y, z = view.zoom;
    const move = (ev) => updateItem(item.id, { x: ox + (ev.clientX - sx) / z, y: oy + (ev.clientY - sy) / z });
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  const deleteNode = (id) => {
    const toRemove = new Set([id]);
    let added = true;
    while (added) {
      added = false;
      for (const n of nodes) {
        if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
          toRemove.add(n.id);
          added = true;
        }
      }
    }
    setNodes((ns) => ns.filter((n) => !toRemove.has(n.id)));
    setSelectedId(null);
  };
  const setColor = (id, color) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, color } : n)));
  };
  const setNodePageFrame = (id, pageFrame) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, pageFrame, frameCustom: true } : n)));
    setPageFrameOpenId(null);
  };
  // project color list — add / remove (removing reverts pages & sections to default)
  const addProjectColor = (hex) => {
    if (!hex) return;
    setSettings((s) => {
      const list = s.colorList || COLOR_KEYS;
      return list.includes(hex) ? s : { ...s, colorList: [...list, hex] };
    });
  };
  const removeProjectColor = (key) => {
    if (key === 'blue') return; // default cannot be removed
    setSettings((s) => ({ ...s, colorList: (s.colorList || COLOR_KEYS).filter((k) => k !== key) }));
    // revert any page / block / connector / arrow using this color back to default
    setNodes((ns) => ns.map((n) => ({
      ...n,
      color: n.color === key ? 'blue' : n.color,
      edge: n.edge && n.edge.color === key ? { ...n.edge, color: 'blue' } : n.edge,
      blocks: (n.blocks || []).map((b) => {
        const styles = b.arrowStyles ? Object.fromEntries(Object.entries(b.arrowStyles).map(([t, v]) => [t, v.color === key ? { ...v, color: 'blue' } : v])) : b.arrowStyles;
        return { ...b, color: b.color === key ? 'blue' : b.color, arrowStyles: styles };
      }),
    })));
  };
  const setBlockColor = (nodeId, blockId, color) => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId
          ? { ...n, blocks: n.blocks.map((b) => (b.id === blockId ? { ...b, color } : b)) }
          : n
      )
    );
  };
  const setLink = (id, link) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, link } : n)));
  };
  // connector (edge) styling — stored on the child node
  const setEdge = (childId, patch) => {
    setNodes((ns) => ns.map((n) => (n.id === childId ? { ...n, edge: { ...(n.edge || {}), ...patch } } : n)));
  };
  const detachEdge = (childId) => {
    setNodes((ns) => ns.map((n) => (n.id === childId ? { ...n, parentId: null } : n)));
    setSelectedEdge(null);
  };
  // reparent a page onto another page (drag & drop)
  const moveNode = (id, newParentId) => {
    if (id === newParentId) return;
    // prevent dropping a node into its own descendant
    let p = newParentId;
    const byId = (x) => nodes.find((n) => n.id === x);
    while (p) {
      if (p === id) return;
      p = byId(p)?.parentId ?? null;
    }
    const target = byId(newParentId);
    setNodes((ns) => ns.map((n) => (n.id === id
      ? { ...n, parentId: newParentId, group: target ? target.group : n.group }
      : n)));
  };
  // move a page between the MAIN and SECTION zones (drag onto empty area)
  const moveNodeToZone = (id, group) => {
    setNodes((ns) => ns.map((n) => {
      if (n.id === id) return { ...n, group, parentId: null };
      // when a page leaves MAIN, its direct children become roots so they aren't orphaned
      if (group === 'section' && n.parentId === id) return { ...n, parentId: null };
      return n;
    }));
  };
  // reorder a block within its page (drag & drop)
  const moveBlock = (nodeId, fromId, toId) => {
    if (fromId === toId) return;
    setNodes((ns) => ns.map((n) => {
      if (n.id !== nodeId) return n;
      const blocks = [...n.blocks];
      const fi = blocks.findIndex((b) => b.id === fromId);
      const ti = blocks.findIndex((b) => b.id === toId);
      if (fi < 0 || ti < 0) return n;
      const [moved] = blocks.splice(fi, 1);
      blocks.splice(ti, 0, moved);
      return { ...n, blocks };
    }));
  };
  // move a section from one page to another (drag & drop across cards)
  const moveBlockToPage = (fromNodeId, blockId, toNodeId, beforeBlockId) => {
    if (fromNodeId === toNodeId) return;
    setNodes((ns) => {
      const src = ns.find((n) => n.id === fromNodeId);
      const moved = src && src.blocks.find((b) => b.id === blockId);
      if (!moved) return ns;
      return ns.map((n) => {
        if (n.id === fromNodeId) return { ...n, blocks: n.blocks.filter((b) => b.id !== blockId) };
        if (n.id === toNodeId) {
          const blocks = [...n.blocks];
          const at = beforeBlockId ? blocks.findIndex((b) => b.id === beforeBlockId) : -1;
          if (at >= 0) blocks.splice(at, 0, moved); else blocks.push(moved);
          return { ...n, blocks };
        }
        return n;
      });
    });
    setSelectedBlock({ nodeId: toNodeId, blockId });
  };
  const newBlock = (color) => ({ id: uid(), name: 'New block', color, frame: 'bar', done: false, arrowTargets: [] });
  const addBlock = (id) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, blocks: [...n.blocks, newBlock(n.color)] } : n)));
  };
  // add a section right after a given one
  const addBlockAfter = (nodeId, blockId) => {
    setNodes((ns) => ns.map((n) => {
      if (n.id !== nodeId) return n;
      const i = n.blocks.findIndex((b) => b.id === blockId);
      const blocks = [...n.blocks];
      blocks.splice(i + 1, 0, newBlock(n.color));
      return { ...n, blocks };
    }));
  };
  const duplicateBlock = (nodeId, blockId) => {
    setNodes((ns) => ns.map((n) => {
      if (n.id !== nodeId) return n;
      const i = n.blocks.findIndex((b) => b.id === blockId);
      if (i < 0) return n;
      const copy = { ...n.blocks[i], id: uid(), arrowTargets: [...(n.blocks[i].arrowTargets || [])] };
      const blocks = [...n.blocks];
      blocks.splice(i + 1, 0, copy);
      return { ...n, blocks };
    }));
  };
  const deleteBlock = (nodeId, blockId) => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId ? { ...n, blocks: n.blocks.filter((b) => b.id !== blockId) } : n
      )
    );
    setSelectedBlock((sb) => (sb && sb.blockId === blockId ? null : sb));
  };
  const setBlockFrame = (nodeId, blockId, frame) => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId
          ? { ...n, blocks: n.blocks.map((b) => (b.id === blockId ? { ...b, frame } : b)) }
          : n
      )
    );
    setFramePickerId(null); // close the picker after choosing a frame
  };
  const setBlockDescription = (nodeId, blockId, description) => {
    setNodes((ns) => ns.map((n) => (n.id === nodeId
      ? { ...n, blocks: n.blocks.map((b) => (b.id === blockId ? { ...b, description } : b)) } : n)));
  };
  const addBlockComment = (nodeId, blockId, text) => {
    if (!text.trim()) return;
    const c = { id: uid(), text: text.trim(), author: ME.name, initials: ME.initials, color: ME.color, ts: Date.now() };
    setNodes((ns) => ns.map((n) => (n.id === nodeId
      ? { ...n, blocks: n.blocks.map((b) => (b.id === blockId ? { ...b, comments: [...(b.comments || []), c] } : b)) } : n)));
  };
  const toggleBlockDone = (nodeId, blockId) => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId
          ? { ...n, blocks: n.blocks.map((b) => (b.id === blockId ? { ...b, done: !b.done } : b)) }
          : n
      )
    );
  };
  // add / remove a target page id on a section (arrow-link mode)
  const toggleArrowTarget = (nodeId, blockId, targetId) => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== nodeId) return n;
        return { ...n, blocks: n.blocks.map((b) => {
          if (b.id !== blockId) return b;
          const cur = b.arrowTargets || [];
          return { ...b, arrowTargets: cur.includes(targetId) ? cur.filter((x) => x !== targetId) : [...cur, targetId] };
        }) };
      })
    );
  };
  // style a single section→page arrow (color / style stored per target)
  const setArrowStyle = (nodeId, blockId, targetId, patch) => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== nodeId) return n;
        return { ...n, blocks: n.blocks.map((b) => {
          if (b.id !== blockId) return b;
          const styles = { ...(b.arrowStyles || {}) };
          styles[targetId] = { ...(styles[targetId] || {}), ...patch };
          return { ...b, arrowStyles: styles };
        }) };
      })
    );
  };
  const removeArrow = (nodeId, blockId, targetId) => {
    toggleArrowTarget(nodeId, blockId, targetId);
    setSelectedArrow(null);
  };
  const commitTitle = (id) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, label: draft.trim() || 'Page' } : n)));
    setEditingTitleId(null);
  };
  const commitBlock = () => {
    if (!editingBlock) return;
    const { nodeId, blockId } = editingBlock;
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId
          ? { ...n, blocks: n.blocks.map((b) => (b.id === blockId ? { ...b, name: draft.trim() || 'Block' } : b)) }
          : n
      )
    );
    setEditingBlock(null);
  };

  /* -------------------- pan / zoom -------------------- */
  const onBgMouseDown = (e) => {
    if (e.target.closest('[data-node]') || e.target.closest('[data-ui]')) return;
    // comment placement mode: drop a comment where the user clicks
    if (commentMode) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = (e.clientX - rect.left - view.x) / view.zoom;
      const cy = (e.clientY - rect.top - view.y) / view.zoom;
      addCommentAt(cx, cy);
      return;
    }
    setSelectedId(null);
    setSelectedBlock(null);
    setFramePickerId(null);
    setColorOpenId(null);
    setLinkOpenId(null);
    setSelectedEdge(null);
    setSelectedArrow(null);
    setSelectedItem(null);
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
    const move = (ev) => {
      const pr = panRef.current;
      if (!pr) return;
      // capture values now — do NOT read panRef inside the setState updater,
      // it may be null by the time React replays the update.
      const nx = pr.ox + (ev.clientX - pr.sx);
      const ny = pr.oy + (ev.clientY - pr.sy);
      setView((v) => ({ ...v, x: nx, y: ny }));
    };
    const up = () => { panRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onWheel = (e) => {
    // let popovers / panels (pickers, settings, comments) scroll instead of zooming
    if (e.target.closest && e.target.closest('[data-ui]')) return;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setView((v) => {
      // gentle, delta-proportional zoom (clamped so one tick never jumps too far)
      const factor = Math.min(1.06, Math.max(0.94, Math.exp(-e.deltaY * 0.0012)));
      const z = Math.min(2.5, Math.max(0.25, v.zoom * factor));
      const wx = (mx - v.x) / v.zoom;
      const wy = (my - v.y) / v.zoom;
      return { zoom: z, x: mx - wx * z, y: my - wy * z };
    });
  };

  const zoomBy = (f) => setView((v) => ({ ...v, zoom: Math.min(2.5, Math.max(0.25, v.zoom * f)) }));
  const fitView = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const contentW = layout.width + MARGIN * 2;
    const contentH = layout.bottom + MARGIN * 2;
    const z = Math.min(rect.width / contentW, rect.height / contentH, 1);
    setView({ zoom: z, x: (rect.width - contentW * z) / 2, y: 24 });
  };
  // center the canvas on a content point (x,y are pre-MARGIN node coords)
  const focusOn = (x, y) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cw = rect ? rect.width : 900, ch = rect ? rect.height : 600;
    const z = Math.max(view.zoom, 0.85);
    setView({ zoom: z, x: cw / 2 - (x + MARGIN) * z, y: ch / 2 - (y + MARGIN) * z });
  };

  /* -------------------- search -------------------- */
  const searchResults = (() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    const res = [];
    nodes.forEach((n) => {
      const pos = layout.pos[n.id];
      if (!pos) return;
      if ((n.label || '').toLowerCase().includes(q)) {
        res.push({ key: 'p' + n.id, label: n.label, kind: n.group === 'section' ? 'Section' : 'Page',
          color: resolveColor(n.color).solid, x: pos.cx, y: pos.y });
      }
      (n.blocks || []).forEach((b, bi) => {
        if ((b.name || '').toLowerCase().includes(q)) {
          const by = pos.y + HEADER_H + bi * (BLOCK_H + BLOCK_GAP) + BLOCK_H / 2;
          res.push({ key: 'b' + b.id, label: b.name, kind: 'Block',
            color: resolveColor(b.color).solid, x: pos.cx, y: by });
        }
      });
    });
    return res.slice(0, 30);
  })();

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/#/p/${project?.id || ''}`;
  const theme = THEMES[settings.theme] || THEMES.light;
  const dflFrame = frameDefaultFor(settings.frame);
  const visibleColorKeys = settings.colorList && settings.colorList.length ? settings.colorList : COLOR_KEYS;

  /* -------------------- connectors -------------------- */
  const connectors = []; // orthogonal tree lines (parent → child)
  const arrows = [];      // curved arrows from a section to its linked target pages
  // tree lines
  nodes.forEach((p) => {
    if (p.group !== 'main') return;
    const pp = layout.pos[p.id];
    if (!pp) return;
    childrenOf(p.id).forEach((c) => {
      const cp = layout.pos[c.id];
      if (!cp) return;
      const x1 = pp.cx + MARGIN, y1 = pp.y + pp.h + MARGIN;
      const x2 = cp.cx + MARGIN, y2 = cp.y + MARGIN;
      const midY = y1 + (y2 - y1) / 2;
      const edge = c.edge || {};
      connectors.push({
        key: p.id + c.id, childId: c.id,
        d: `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`,
        color: resolveColor(edge.color || 'blue').solid,
        dashed: edge.style === 'dashed',
        mx: x2, my: midY,
      });
    });
  });
  // section → linked-page arrows
  nodes.forEach((p) => {
    const pp = layout.pos[p.id];
    if (!pp) return;
    (p.blocks || []).forEach((b, bi) => {
      (b.arrowTargets || []).forEach((tid) => {
        const tp = layout.pos[tid];
        if (!tp) return;
        const blockMidY = pp.y + HEADER_H + bi * (BLOCK_H + BLOCK_GAP) + BLOCK_H / 2 + MARGIN;
        const targetRight = tp.cx >= pp.cx;
        const sx = (targetRight ? pp.x + CARD_W : pp.x) + MARGIN;
        const ex = (targetRight ? tp.x : tp.x + CARD_W) + MARGIN;
        const ey = tp.y + tp.h / 2 + MARGIN;
        const dx = Math.max(40, Math.abs(ex - sx) / 2) * (targetRight ? 1 : -1);
        const stl = (b.arrowStyles && b.arrowStyles[tid]) || {};
        arrows.push({
          key: 'a' + p.id + b.id + tid, nodeId: p.id, blockId: b.id, targetId: tid,
          d: `M ${sx} ${blockMidY} C ${sx + dx} ${blockMidY}, ${ex - dx} ${ey}, ${ex} ${ey}`,
          color: resolveColor(stl.color || 'blue').solid,
          style: stl.style || 'dashed',
          mx: (sx + ex) / 2, my: (blockMidY + ey) / 2,
        });
      });
    });
  });
  const dashFor = (style) => (style === 'dashed' ? '6 5' : style === 'dotted' ? '1 5' : undefined);

  const svgW = layout.width + MARGIN * 2 + CARD_W;
  const svgH = layout.bottom + MARGIN * 2 + 80;

  /* ================================================================ */
  return (
    <div className="fixed inset-0 overflow-hidden select-none"
         style={{ background: theme.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* ---------- Top bar ---------- */}
      <div data-ui className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-30 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onBack}
            title="Back to dashboard"
            className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-50"
          ><ArrowLeft size={17} /></button>
          <div className="relative">
            <button onClick={() => setProjMenuOpen((v) => !v)}
                    className="w-9 h-9 rounded-lg hover:bg-gray-50 flex items-center justify-center"><BrandStar size={22} /></button>
            {projMenuOpen && (
              <ProjectMenu
                onClose={() => setProjMenuOpen(false)}
                onDashboard={() => { setProjMenuOpen(false); onBack?.(); }}
                exportMenu={<ExportMenu nodes={nodes} childrenOf={childrenOf} onClose={() => setProjMenuOpen(false)} setNodes={setNodes} />}
              />
            )}
          </div>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={() => onChange?.({ name: projectName.trim() || 'Untitled project' })}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            className="text-[15px] font-semibold text-[#473AE0] bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded px-1 w-48"
          />
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button onClick={() => setShareOpen(true)} className="flex items-center gap-1 bg-[#473AE0] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-indigo-600">
            Share <Play size={13} className="ml-1" fill="white" />
          </button>
          <button onClick={() => { setSearchOpen((v) => !v); setSearchQ(''); }} className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Search size={16} /></button>
          <button onClick={() => setSettingsOpen(true)} title="Project settings" className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Settings size={16} /></button>
          <div className="w-9 h-9 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-bold">PU</div>
        </div>

        {/* search popup */}
        {searchOpen && (
          <div data-ui className="absolute left-1/2 -translate-x-1/2 top-14 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 pointer-events-auto">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1.5">
                <Search size={15} className="text-gray-400" />
                <input autoFocus value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                       onKeyDown={(e) => { if (e.key === 'Escape') setSearchOpen(false); }} placeholder="Search pages & sections…"
                       className="flex-1 outline-none text-sm" />
                {searchQ && <button onClick={() => setSearchQ('')}><X size={14} className="text-gray-400" /></button>}
              </div>
              <button onClick={() => setSearchOpen(false)} title="Close"
                      className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center shrink-0">
                <X size={15} />
              </button>
            </div>
            {searchQ.trim() && (
              <div className="mt-2 max-h-72 overflow-y-auto">
                {searchResults.length === 0 && <div className="text-xs text-gray-400 px-1 py-2">No matches</div>}
                {searchResults.map((r) => (
                  <button key={r.key} onClick={() => { focusOn(r.x, r.y); setSearchOpen(false); }}
                          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 text-left">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                    <span className="text-sm text-gray-700 truncate">{r.label}</span>
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-400">{r.kind}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------- Arrow-link mode banner ---------- */}
      {arrowMode && (
        <div data-ui className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900 text-white text-sm rounded-full shadow-lg pl-4 pr-2 py-2">
          <Share2 size={15} />
          <span>Click pages to link them to this section</span>
          <button onClick={() => setArrowMode(null)} className="bg-white text-gray-900 text-xs font-semibold rounded-full px-3 py-1 hover:bg-gray-100">Done</button>
        </div>
      )}

      {/* ---------- Canvas ---------- */}
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseDown={onBgMouseDown}
        onWheel={onWheel}
        onDragOver={(e) => { if (dragId) e.preventDefault(); }}
        onDrop={(e) => {
          if (!dragId) return;
          const rect = containerRef.current.getBoundingClientRect();
          const cy = (e.clientY - rect.top - view.y) / view.zoom;
          const zone = cy > (layout.mainBottom + MARGIN + 90) ? 'section' : 'main';
          moveNodeToZone(dragId, zone);
          setDragId(null); setDropTargetId(null);
        }}
        style={{ backgroundImage: `radial-gradient(${theme.dot} 1px, transparent 1px)`, backgroundSize: '24px 24px' }}
      >
        <div style={{ position: 'absolute', transformOrigin: '0 0',
                      transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>

          {/* group labels */}
          <div className="absolute text-[11px] font-semibold tracking-[0.2em] text-gray-400"
               style={{ left: layout.rootCx + MARGIN - 20, top: MARGIN - 34 }}>MAIN</div>
          {layout.hasSection && (
            <>
              <div className="absolute" style={{ left: MARGIN - 40, top: layout.sectionY + MARGIN - 40, width: layout.width + 80 }}>
                <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.2em] text-gray-400">
                  <div className="h-px bg-gray-200 flex-1" /> SECTION <div className="h-px bg-gray-200 flex-1" />
                </div>
              </div>
            </>
          )}

          {/* connectors */}
          <svg width={svgW} height={svgH} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            <defs>
              <marker id="arrowhead" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto">
                <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke" />
              </marker>
            </defs>
            {connectors.map((c) => (
              <g key={c.key}>
                {/* visible line */}
                <path d={c.d} fill="none" stroke={c.color} strokeWidth={selectedEdge === c.childId ? 3 : 2}
                      strokeDasharray={c.dashed ? '6 5' : undefined} style={{ pointerEvents: 'none' }} />
                {/* wide invisible hit area */}
                <path d={c.d} fill="none" stroke="transparent" strokeWidth="14"
                      style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); setSelectedEdge(c.childId); setSelectedId(null); setSelectedBlock(null); }} />
              </g>
            ))}
            {arrows.map((a) => {
              const sel = selectedArrow && selectedArrow.nodeId === a.nodeId && selectedArrow.blockId === a.blockId && selectedArrow.targetId === a.targetId;
              return (
                <g key={a.key}>
                  <path d={a.d} fill="none" stroke={a.color} strokeWidth={sel ? 3 : 2}
                        strokeDasharray={dashFor(a.style)} strokeLinecap={a.style === 'dotted' ? 'round' : 'butt'}
                        markerEnd="url(#arrowhead)" style={{ pointerEvents: 'none' }} />
                  <path d={a.d} fill="none" stroke="transparent" strokeWidth="14"
                        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); setSelectedArrow({ nodeId: a.nodeId, blockId: a.blockId, targetId: a.targetId }); setSelectedEdge(null); setSelectedId(null); setSelectedBlock(null); }} />
                </g>
              );
            })}
          </svg>

          {/* connector edit popover */}
          {selectedEdge && (() => {
            const c = connectors.find((x) => x.childId === selectedEdge);
            const child = nodes.find((x) => x.id === selectedEdge);
            if (!c || !child) return null;
            const e = child.edge || {};
            return (
              <div data-ui className="absolute z-30"
                   style={{ left: c.mx, top: c.my, transform: `translate(-50%, -50%) scale(${1 / view.zoom})` }}
                   onMouseDown={(ev) => ev.stopPropagation()} onClick={(ev) => ev.stopPropagation()}>
                <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-2 w-44">
                  <LineStyleRow value={e.style || 'solid'} onPick={(s) => setEdge(child.id, { style: s })} />
                  <div className="grid grid-cols-6 gap-1.5 mb-2">
                    {COLOR_KEYS.map((k) => (
                      <button key={k} onClick={() => setEdge(child.id, { color: k })} title={COLORS[k].name}
                              className="w-5 h-5 rounded-full"
                              style={{ background: COLORS[k].solid, boxShadow: (e.color || 'blue') === k ? `0 0 0 2px #fff, 0 0 0 3.5px ${COLORS[k].solid}` : 'none' }} />
                    ))}
                  </div>
                  <button onClick={() => detachEdge(child.id)}
                          className="w-full flex items-center justify-center gap-1 h-7 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50">
                    <Unlink size={13} /> Delete connection
                  </button>
                </div>
              </div>
            );
          })()}

          {/* arrow (section → page) edit popover */}
          {selectedArrow && (() => {
            const a = arrows.find((x) => x.nodeId === selectedArrow.nodeId && x.blockId === selectedArrow.blockId && x.targetId === selectedArrow.targetId);
            if (!a) return null;
            return (
              <div data-ui className="absolute z-30"
                   style={{ left: a.mx, top: a.my, transform: `translate(-50%, -50%) scale(${1 / view.zoom})` }}
                   onMouseDown={(ev) => ev.stopPropagation()} onClick={(ev) => ev.stopPropagation()}>
                <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-2 w-44">
                  <LineStyleRow value={a.style}
                                onPick={(s) => setArrowStyle(a.nodeId, a.blockId, a.targetId, { style: s })} />
                  <div className="grid grid-cols-6 gap-1.5 mb-2">
                    {COLOR_KEYS.map((k) => (
                      <button key={k} onClick={() => setArrowStyle(a.nodeId, a.blockId, a.targetId, { color: k })} title={COLORS[k].name}
                              className="w-5 h-5 rounded-full"
                              style={{ background: COLORS[k].solid, boxShadow: a.color === COLORS[k].solid ? `0 0 0 2px #fff, 0 0 0 3.5px ${COLORS[k].solid}` : 'none' }} />
                    ))}
                  </div>
                  <button onClick={() => removeArrow(a.nodeId, a.blockId, a.targetId)}
                          className="w-full flex items-center justify-center gap-1 h-7 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50">
                    <Unlink size={13} /> Delete arrow
                  </button>
                </div>
              </div>
            );
          })()}

          {/* nodes */}
          {nodes.map((n) => {
            const p = layout.pos[n.id];
            if (!p) return null;
            const col = resolveColor(n.color);
            const isSel = selectedId === n.id;
            const frame = (n.frameCustom && n.pageFrame) ? n.pageFrame : dflFrame;
            const showChrome = frame === 'window' || frame === 'stacked';
            // is this page a current arrow target of the section being linked?
            let isArrowTarget = false;
            if (arrowMode) {
              const srcNode = nodes.find((x) => x.id === arrowMode.nodeId);
              const srcBlock = srcNode && srcNode.blocks.find((b) => b.id === arrowMode.blockId);
              isArrowTarget = !!(srcBlock && (srcBlock.arrowTargets || []).includes(n.id));
            }
            return (
              <div key={n.id} data-node
                   style={{ position: 'absolute', left: p.x + MARGIN, top: p.y + MARGIN, width: CARD_W, height: p.h,
                            transition: dragId ? 'none' : 'left 0.2s ease, top 0.2s ease' }}>

                {/* stacked frame: a duplicate card peeking behind */}
                {frame === 'stacked' && (
                  <div className="absolute rounded-xl bg-white pointer-events-none"
                       style={{ inset: 0, transform: 'translate(7px, 7px)', border: `2px solid ${col.solid}`, opacity: 0.45, zIndex: -1 }} />
                )}
                {/* brackets frame: 4 corner brackets */}
                {frame === 'brackets' && [
                  { k: 'tl', s: { top: -3, left: -3, borderTop: `2.5px solid ${col.solid}`, borderLeft: `2.5px solid ${col.solid}`, borderTopLeftRadius: 6 } },
                  { k: 'tr', s: { top: -3, right: -3, borderTop: `2.5px solid ${col.solid}`, borderRight: `2.5px solid ${col.solid}`, borderTopRightRadius: 6 } },
                  { k: 'bl', s: { bottom: -3, left: -3, borderBottom: `2.5px solid ${col.solid}`, borderLeft: `2.5px solid ${col.solid}`, borderBottomLeftRadius: 6 } },
                  { k: 'br', s: { bottom: -3, right: -3, borderBottom: `2.5px solid ${col.solid}`, borderRight: `2.5px solid ${col.solid}`, borderBottomRightRadius: 6 } },
                ].map((c) => <div key={c.k} className="absolute w-3.5 h-3.5 pointer-events-none" style={c.s} />)}

                {/* contextual toolbar(s) — page menu OR section menu */}
                {isSel && (() => {
                  const activeBlock = selectedBlock && selectedBlock.nodeId === n.id
                    ? n.blocks.find((b) => b.id === selectedBlock.blockId)
                    : null;
                  if (activeBlock) {
                    const bi = n.blocks.findIndex((b) => b.id === activeBlock.id);
                    const blockTop = HEADER_H + bi * (BLOCK_H + BLOCK_GAP);
                    return (
                      <SectionToolbar
                        zoom={view.zoom}
                        topOffset={blockTop}
                        block={activeBlock}
                        colorOpen={secColorOpen}
                        framePickerOpen={framePickerId === n.id}
                        arrowActive={!!arrowMode && arrowMode.blockId === activeBlock.id}
                        onMarkDone={() => toggleBlockDone(n.id, activeBlock.id)}
                        onAddBelow={() => addBlockAfter(n.id, activeBlock.id)}
                        onColor={() => { setSecColorOpen((v) => !v); setFramePickerId(null); }}
                        onPickColor={(c) => setBlockColor(n.id, activeBlock.id, c)}
                        onCloseColor={() => setSecColorOpen(false)}
                        colorKeys={visibleColorKeys}
                        onWireframes={() => { setFramePickerId(framePickerId === n.id ? null : n.id); setSecColorOpen(false); }}
                        onPickFrame={(f) => setBlockFrame(n.id, activeBlock.id, f)}
                        onClearFrame={() => setBlockFrame(n.id, activeBlock.id, 'bar')}
                        onArrows={() => { setArrowMode(arrowMode && arrowMode.blockId === activeBlock.id ? null : { nodeId: n.id, blockId: activeBlock.id }); setSecColorOpen(false); setFramePickerId(null); }}
                        onDuplicate={() => duplicateBlock(n.id, activeBlock.id)}
                        onDelete={() => deleteBlock(n.id, activeBlock.id)}
                      />
                    );
                  }
                  return (
                    <PageToolbar
                      zoom={view.zoom}
                      node={n}
                      colorOpen={colorOpenId === n.id}
                      frameOpen={pageFrameOpenId === n.id}
                      linkOpen={linkOpenId === n.id}
                      onAddBlock={() => addBlock(n.id)}
                      onFrame={() => { setPageFrameOpenId(pageFrameOpenId === n.id ? null : n.id); setColorOpenId(null); setLinkOpenId(null); }}
                      onPickFrame={(f) => setNodePageFrame(n.id, f)}
                      onColor={() => { setColorOpenId(colorOpenId === n.id ? null : n.id); setLinkOpenId(null); setPageFrameOpenId(null); }}
                      onPickColor={(c) => setColor(n.id, c)}
                      onCloseColor={() => setColorOpenId(null)}
                      colorKeys={visibleColorKeys}
                      onLink={() => { setLinkOpenId(linkOpenId === n.id ? null : n.id); setColorOpenId(null); setPageFrameOpenId(null); }}
                      onSetLink={(v) => setLink(n.id, v)}
                      onDelete={() => deleteNode(n.id)}
                    />
                  );
                })()}

                {/* card */}
                <div
                  draggable={editingTitleId !== n.id && !editingBlock}
                  onDragStart={(e) => { e.stopPropagation(); setDragId(n.id); }}
                  onDragEnd={() => { setDragId(null); setDropTargetId(null); }}
                  onDragOver={(e) => { if (dragId && dragId !== n.id) { e.preventDefault(); setDropTargetId(n.id); } }}
                  onDragLeave={() => { if (dropTargetId === n.id) setDropTargetId(null); }}
                  onDrop={(e) => { if (dragId && dragId !== n.id) { e.preventDefault(); e.stopPropagation(); moveNode(dragId, n.id); } setDragId(null); setDropTargetId(null); }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (arrowMode) {
                      if (n.id !== arrowMode.nodeId) toggleArrowTarget(arrowMode.nodeId, arrowMode.blockId, n.id);
                      return;
                    }
                    setSelectedId(n.id); setSelectedBlock(null); setFramePickerId(null);
                  }}
                  className={`w-full h-full bg-white flex flex-col overflow-hidden transition-shadow ${frame === 'phone' ? 'rounded-[28px]' : frame === 'pill' ? 'rounded-3xl' : 'rounded-xl'} ${arrowMode && arrowMode.nodeId !== n.id ? 'cursor-pointer' : ''}`}
                  style={{
                    border: `2px solid ${dropTargetId === n.id ? '#10B981' : (isArrowTarget ? '#473AE0' : (frame === 'brackets' ? 'transparent' : col.solid))}`,
                    opacity: dragId === n.id ? 0.4 : (arrowMode && (arrowMode.nodeId === n.id) ? 0.55 : 1),
                    boxShadow: dropTargetId === n.id
                      ? '0 0 0 3px #10B98155, 0 8px 24px rgba(0,0,0,0.12)'
                      : isArrowTarget ? '0 0 0 3px #473AE055, 0 8px 24px rgba(0,0,0,0.12)'
                      : isSel ? `0 0 0 3px ${col.solid}33, 0 8px 24px rgba(0,0,0,0.08)` : '0 4px 14px rgba(0,0,0,0.05)',
                  }}
                >
                  {/* header */}
                  <div className="flex items-center px-3 shrink-0 relative" style={{ height: HEADER_H }}>
                    {frame === 'phone' && (
                      <span className="absolute left-1/2 -translate-x-1/2 top-1 w-10 h-1.5 rounded-full" style={{ background: col.solid, opacity: .35 }} />
                    )}
                    {showChrome && (
                      <div className="flex gap-1 absolute" >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: col.solid, opacity: .5 }} />
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: col.solid, opacity: .5 }} />
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: col.solid, opacity: .5 }} />
                      </div>
                    )}
                    <div className="flex-1 flex justify-center">
                      {editingTitleId === n.id ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => commitTitle(n.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(n.id); if (e.key === 'Escape') setEditingTitleId(null); }}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-bold text-center outline-none border-b w-32"
                          style={{ color: col.solid, borderColor: col.solid }}
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => { e.stopPropagation(); setEditingTitleId(n.id); setDraft(n.label); }}
                          className="text-sm font-bold cursor-text"
                          style={{ color: col.solid }}
                        >{n.label}</span>
                      )}
                    </div>
                  </div>

                  {/* body */}
                  {n.blocks.length > 0 ? (
                    <div className="px-2.5 pb-2.5 flex flex-col" style={{ gap: BLOCK_GAP }}
                         onDragOver={(e) => { if (blockDragRef.current) e.preventDefault(); }}
                         onDrop={(e) => { const d = blockDragRef.current; if (d && d.nodeId !== n.id) moveBlockToPage(d.nodeId, d.blockId, n.id); blockDragRef.current = null; }}>
                      {n.blocks.map((b) => {
                        const bc = resolveColor(b.color);
                        const blkSel = selectedBlock && selectedBlock.blockId === b.id;
                        return (
                          <div key={b.id} data-ui
                               draggable={!(editingBlock && editingBlock.blockId === b.id)}
                               onDragStart={(e) => { e.stopPropagation(); blockDragRef.current = { nodeId: n.id, blockId: b.id }; }}
                               onDragOver={(e) => { if (blockDragRef.current) { e.preventDefault(); e.stopPropagation(); } }}
                               onDrop={(e) => { e.stopPropagation(); const d = blockDragRef.current; if (d) { if (d.nodeId === n.id) moveBlock(n.id, d.blockId, b.id); else moveBlockToPage(d.nodeId, d.blockId, n.id, b.id); } blockDragRef.current = null; }}
                               onDragEnd={() => { blockDragRef.current = null; }}
                               onClick={(e) => { e.stopPropagation(); if (arrowMode) return; setSelectedId(n.id); setSelectedBlock({ nodeId: n.id, blockId: b.id }); setFramePickerId(null); }}
                               className="relative group rounded-md flex flex-col px-2 py-1.5 text-white cursor-pointer"
                               style={{ height: BLOCK_H, background: bc.soft, opacity: b.done ? 0.6 : 1,
                                        outline: blkSel ? '2px solid #F472B6' : 'none', outlineOffset: '1px' }}>
                            {editingBlock && editingBlock.blockId === b.id ? (
                              <input
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={commitBlock}
                                onKeyDown={(e) => { if (e.key === 'Enter') commitBlock(); if (e.key === 'Escape') setEditingBlock(null); }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-transparent outline-none text-[11px] font-semibold text-white placeholder-white/70"
                              />
                            ) : (
                              <div className="flex flex-col h-full"
                                   onDoubleClick={(e) => { e.stopPropagation(); setEditingBlock({ nodeId: n.id, blockId: b.id }); setDraft(b.name); }}>
                                <div className="flex items-center justify-between shrink-0">
                                  <span className={`text-[11px] font-semibold leading-none ${b.done ? 'line-through' : ''}`}>{b.name}</span>
                                  <div className="flex items-center gap-1">
                                    {(b.arrowTargets || []).length > 0 && <span className="text-[8px] font-bold bg-white/25 rounded px-1 leading-tight">↳{b.arrowTargets.length}</span>}
                                    {b.done && <Check size={11} strokeWidth={3} />}
                                  </div>
                                </div>
                                <div className="flex-1 min-h-0 mt-1" style={{ color: 'rgba(255,255,255,0.95)' }}>
                                  <FrameGlyph frame={b.frame || 'bar'} />
                                </div>
                              </div>
                            )}
                            <button
                              data-ui
                              onClick={(e) => { e.stopPropagation(); setSectionDetail({ nodeId: n.id, blockId: b.id }); }}
                              title="Open section"
                              className="absolute right-1 top-1 w-5 h-5 rounded-full bg-white/90 shadow text-[#473AE0] hidden group-hover:flex items-center justify-center"
                            ><Menu size={11} /></button>
                            {isSel && (
                              <button
                                data-ui
                                onClick={(e) => { e.stopPropagation(); deleteBlock(n.id, b.id); }}
                                className="absolute -right-1.5 -top-1.5 w-4 h-4 rounded-full bg-white shadow border border-gray-200 text-gray-500 hidden group-hover:flex items-center justify-center"
                              ><X size={9} /></button>
                            )}
                          </div>
                        );
                      })}
                      <button
                        data-ui
                        onClick={(e) => { e.stopPropagation(); setSelectedId(n.id); addBlock(n.id); }}
                        className="rounded-md flex items-center justify-center text-gray-400 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-500"
                        style={{ height: ADD_ROW }}
                        title="Add section"
                      ><Plus size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center px-2.5 pb-2.5"
                         onDragOver={(e) => { if (blockDragRef.current) e.preventDefault(); }}
                         onDrop={(e) => { const d = blockDragRef.current; if (d && d.nodeId !== n.id) moveBlockToPage(d.nodeId, d.blockId, n.id); blockDragRef.current = null; }}>
                      <button
                        data-ui
                        onClick={(e) => { e.stopPropagation(); setSelectedId(n.id); addBlock(n.id); }}
                        className="w-full h-full rounded-md flex items-center justify-center hover:brightness-95 cursor-pointer"
                        style={{ background: isSel ? `${col.solid}11` : '#F4F6FB' }}
                        title="Add section"
                      >
                        <Plus size={16} className="text-gray-400" />
                      </button>
                    </div>
                  )}
                </div>

                {/* add-sibling buttons left / right */}
                {isSel && (
                  <>
                    <button
                      data-ui
                      onClick={(e) => { e.stopPropagation(); addSibling(n, 'left'); }}
                      className="absolute top-1/2 -translate-y-1/2 -left-3.5 w-7 h-7 rounded-full bg-[#473AE0] text-white flex items-center justify-center shadow-md hover:bg-indigo-600 z-10"
                      title="Add page on the left"
                    ><Plus size={15} /></button>
                    <button
                      data-ui
                      onClick={(e) => { e.stopPropagation(); addSibling(n, 'right'); }}
                      className="absolute top-1/2 -translate-y-1/2 -right-3.5 w-7 h-7 rounded-full bg-[#473AE0] text-white flex items-center justify-center shadow-md hover:bg-indigo-600 z-10"
                      title="Add page on the right"
                    ><Plus size={15} /></button>
                  </>
                )}

                {/* add-child button below card (main group) */}
                {n.group === 'main' && (
                  <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1"
                       style={{ top: p.h + 4 }}>
                    <button
                      data-ui
                      onClick={(e) => { e.stopPropagation(); addChild(n.id); }}
                      className={`w-7 h-7 rounded-full bg-[#473AE0] text-white flex items-center justify-center shadow-md hover:bg-indigo-600 transition-opacity ${isSel ? 'opacity-100' : 'opacity-0'}`}
                      title="Add sub-page"
                    ><Plus size={15} /></button>
                  </div>
                )}
              </div>
            );
          })}

          {/* ---------- canvas objects: notes / links / comments ---------- */}
          {items.map((it) => {
            const sel = selectedItem === it.id;
            if (it.type === 'note') {
              const nc = NOTE_COLORS[it.color] || NOTE_COLORS.yellow;
              return (
                <div key={it.id} data-ui className="absolute" style={{ left: it.x, top: it.y, width: it.w, height: it.h }}>
                  {sel && (
                    <ItemToolbar zoom={view.zoom}
                      colors={<NoteColorButton value={it.color} onPick={(c) => updateItem(it.id, { color: c })} />}
                      onDuplicate={() => duplicateItem(it.id)} onDelete={() => deleteItem(it.id)} />
                  )}
                  <div onMouseDown={(e) => startItemDrag(e, it)} onClick={(e) => { e.stopPropagation(); setSelectedItem(it.id); }}
                       className="w-full h-full rounded-lg p-3 cursor-move"
                       style={{ background: nc.bg, boxShadow: sel ? '0 0 0 2px #473AE0, 0 10px 26px rgba(0,0,0,0.14)' : '0 6px 18px rgba(0,0,0,0.12)' }}>
                    <textarea value={it.text} onChange={(e) => updateItem(it.id, { text: e.target.value })}
                              onMouseDown={(e) => e.stopPropagation()} placeholder="Write a note..."
                              className="w-full h-full bg-transparent resize-none outline-none text-sm text-gray-700 placeholder-gray-500/70" />
                  </div>
                </div>
              );
            }
            if (it.type === 'link') {
              return (
                <div key={it.id} data-ui className="absolute" style={{ left: it.x, top: it.y, width: 220 }}>
                  {sel && (
                    <ItemToolbar zoom={view.zoom}
                      extra={<button onClick={() => setLinkEditId(it.id)} title="Edit link" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-[#473AE0]"><Pencil size={15} /></button>}
                      onDuplicate={() => { navigator.clipboard?.writeText(it.url || ''); duplicateItem(it.id); }}
                      onDelete={() => deleteItem(it.id)} />
                  )}
                  <div onMouseDown={(e) => startItemDrag(e, it)} onClick={(e) => { e.stopPropagation(); setSelectedItem(it.id); }}
                       className="rounded-xl border bg-white p-3 cursor-move"
                       style={{ borderColor: sel ? '#473AE0' : '#E5E7EB', boxShadow: sel ? '0 10px 26px rgba(0,0,0,0.14)' : '0 6px 18px rgba(0,0,0,0.08)' }}>
                    <div className="rounded-lg bg-gray-900 h-24 flex items-center justify-center overflow-hidden mb-2">
                      {it.host
                        ? <img src={`https://logo.clearbit.com/${it.host}`} alt="" onError={(e) => { e.target.style.display = 'none'; }} className="max-h-12 max-w-[80%]" />
                        : <span className="text-white/70 text-sm font-semibold tracking-wide">LINK</span>}
                    </div>
                    <div className="text-sm font-semibold text-[#473AE0] truncate">{it.title || 'Untitled link'}</div>
                    <div className="text-xs text-gray-400 truncate">{it.host || it.url || 'Enter a URL'}</div>
                  </div>
                  {linkEditId === it.id && (
                    <div className="absolute left-1/2 top-full mt-2" style={{ transform: `translate(-50%, 0) scale(${1 / view.zoom})`, transformOrigin: 'top center' }}
                         onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                      <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-1.5 flex items-center gap-1 w-60">
                        <input autoFocus defaultValue={it.url || ''} placeholder="Enter URL…"
                               onKeyDown={(e) => { if (e.key === 'Enter') { setLinkUrl(it.id, e.target.value); setLinkEditId(null); } if (e.key === 'Escape') setLinkEditId(null); }}
                               onBlur={(e) => { setLinkUrl(it.id, e.target.value); setLinkEditId(null); }}
                               className="flex-1 px-2 py-1.5 text-sm outline-none" />
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            // comment
            return (
              <div key={it.id} data-ui className="absolute" style={{ left: it.x, top: it.y }}>
                <div onMouseDown={(e) => startItemDrag(e, it)} onClick={(e) => { e.stopPropagation(); setSelectedItem(it.id); setCommentsPanel(true); }}
                     className="w-9 h-9 rounded-full rounded-bl-none flex items-center justify-center text-white text-[11px] font-bold shadow-lg cursor-move"
                     style={{ background: it.color, outline: sel ? '2px solid #473AE0' : 'none', outlineOffset: '2px' }}>
                  {it.initials}
                </div>
                {sel && (
                  <div className="absolute left-11 top-0 w-56" style={{ transformOrigin: 'top left', transform: `scale(${1 / view.zoom})` }}
                       onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ background: it.color }}>{it.initials}</span>
                        <span className="text-xs font-semibold text-gray-700">{it.author}</span>
                        <button onClick={() => deleteItem(it.id)} className="ml-auto text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                      <textarea autoFocus value={it.text} onChange={(e) => updateItem(it.id, { text: e.target.value })}
                                placeholder="Add a comment…" rows={2}
                                className="w-full text-sm outline-none resize-none placeholder-gray-400" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        </div>
      </div>

      {/* ---------- Bottom toolbar ---------- */}
      <div data-ui className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white rounded-2xl shadow-lg border border-gray-100 px-2 py-1.5">
        <ToolBtn onClick={addRoot} title="Add page"><Plus size={18} /></ToolBtn>
        <div className="w-px h-6 bg-gray-200 mx-0.5" />
        <ToolBtn title="AI (coming soon)"><Sparkles size={18} className="text-purple-500" /></ToolBtn>
        <ToolBtn onClick={addNote} title="Add note"><StickyNote size={18} /></ToolBtn>
        <ToolBtn onClick={() => setToast('Files — coming soon')} title="Files (coming soon)"><Paperclip size={18} /></ToolBtn>
        <ToolBtn onClick={addLink} title="Add link"><ExternalLink size={18} /></ToolBtn>
        <ToolBtn active={commentMode} onClick={() => { setCommentMode((v) => !v); setCommentsPanel(true); }} title="Comment (click on the board)"><MessageSquare size={18} /></ToolBtn>
        <div className="w-px h-6 bg-gray-200 mx-0.5" />
        <div className="relative">
          <ToolBtn onClick={() => setExportOpen((v) => !v)} title="Import / Export"><Download size={18} /></ToolBtn>
          {exportOpen && (
            <div className="absolute bottom-12 right-0 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5 w-52">
              <ExportMenu nodes={nodes} childrenOf={childrenOf} onClose={() => setExportOpen(false)} setNodes={setNodes} />
            </div>
          )}
        </div>
      </div>

      {/* ---------- Undo / Redo (bottom-left) ---------- */}
      {(() => {
        const canUndo = undoStack.current.length > 0 && histTick >= 0;
        const canRedo = redoStack.current.length > 0;
        const btn = (enabled) => `w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center ${enabled ? 'text-gray-600 hover:bg-gray-50' : 'text-gray-300 cursor-default'}`;
        return (
          <div data-ui className="absolute bottom-5 left-5 z-30 flex items-center gap-2">
            <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)" className={btn(canUndo)}><RotateCcw size={17} /></button>
            <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)" className={btn(canRedo)}><RotateCw size={17} /></button>
          </div>
        );
      })()}

      {/* ---------- Zoom control ---------- */}
      <div data-ui className="absolute bottom-5 right-5 z-30 flex items-center gap-1 bg-white rounded-full shadow-lg border border-gray-100 px-1.5 py-1">
        <button onClick={() => zoomBy(1 / 1.15)} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-600 flex items-center justify-center text-lg">−</button>
        <button onClick={fitView} className="px-2 text-sm text-gray-600 tabular-nums min-w-[52px]">{Math.round(view.zoom * 100)}%</button>
        <button onClick={() => zoomBy(1.15)} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-600 flex items-center justify-center text-lg">+</button>
      </div>

      {/* ---------- Comments side panel ---------- */}
      {commentsPanel && (
        <div data-ui className="absolute top-0 right-0 bottom-0 w-72 bg-white border-l border-gray-100 shadow-xl z-40 flex flex-col">
          <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
            <span className="font-semibold text-gray-800">Artboard comments</span>
            <button onClick={() => { setCommentsPanel(false); setCommentMode(false); }} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 flex items-center justify-center"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {items.filter((i) => i.type === 'comment').length === 0 && (
              <div className="text-center text-sm text-gray-400 mt-10">
                <MessageSquare size={20} className="mx-auto mb-2 opacity-50" />
                Click anywhere on the board to comment
              </div>
            )}
            {items.filter((i) => i.type === 'comment').map((c) => (
              <button key={c.id} onClick={() => { setSelectedItem(c.id); focusOn(c.x - MARGIN, c.y - MARGIN); }}
                      className="w-full text-left rounded-xl border border-gray-100 hover:border-indigo-200 p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ background: c.color }}>{c.initials}</span>
                  <span className="text-xs font-semibold text-gray-700">{c.author}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{relTime(c.ts)}</span>
                </div>
                <div className="text-sm text-gray-600 break-words">{c.text || <span className="text-gray-300">No text yet</span>}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Share popup ---------- */}
      {shareOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20" onMouseDown={() => setShareOpen(false)}>
          <div data-ui className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-[92vw] p-6" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <span className="text-lg font-bold text-gray-800">Share</span>
              <button onClick={() => setShareOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Share link</div>
              <div className="flex items-center gap-2">
                <input readOnly value={shareUrl}
                       onFocus={(e) => e.target.select()}
                       className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 outline-none" />
                <button onClick={() => { navigator.clipboard?.writeText(shareUrl); setToast('Link copied'); }}
                        className="w-11 h-11 rounded-xl bg-[#473AE0] text-white flex items-center justify-center hover:bg-indigo-600 shrink-0" title="Copy link">
                  <Copy size={18} />
                </button>
              </div>
              <div className="text-xs text-gray-400 mt-2">Anyone with the link can view</div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Project settings panel ---------- */}
      {settingsOpen && (
        <ProjectSettings settings={settings} setSettings={setSettings} onClose={() => setSettingsOpen(false)}
                         onAddColor={addProjectColor} onRemoveColor={removeProjectColor} />
      )}

      {/* ---------- Section detail modal ---------- */}
      {sectionDetail && (() => {
        const n = nodes.find((x) => x.id === sectionDetail.nodeId);
        const b = n && n.blocks.find((x) => x.id === sectionDetail.blockId);
        if (!n || !b) return null;
        return (
          <SectionDetail node={n} block={b}
            onClose={() => setSectionDetail(null)}
            onDescription={(v) => setBlockDescription(n.id, b.id, v)}
            onAddComment={(t) => addBlockComment(n.id, b.id, t)} />
        );
      })()}

      {/* ---------- Toast ---------- */}
      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg">{toast}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Contextual toolbar (floats above a selected card)                  */
/* ------------------------------------------------------------------ */
/* floating toolbar shell (handles zoom counter-scaling + positioning) */
function ToolbarShell({ zoom, top = -12, children }) {
  return (
    <div data-ui
         className="absolute left-1/2 z-20"
         style={{ top, transform: `translate(-50%, -100%) scale(${1 / zoom})`, transformOrigin: 'bottom center' }}
         onMouseDown={(e) => e.stopPropagation()}
         onClick={(e) => e.stopPropagation()}>
      <div className="relative flex items-center gap-0.5 bg-white rounded-xl shadow-xl border border-gray-100 px-1.5 py-1.5">
        {children}
      </div>
    </div>
  );
}

/* icon button with a small dark tooltip on hover */
function TipBtn({ title, onClick, active, danger, children }) {
  const base = 'relative group/tb w-7 h-7 rounded-lg flex items-center justify-center';
  const tone = danger
    ? 'text-red-500 hover:bg-red-50'
    : active ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-600 hover:bg-gray-100 hover:text-[#473AE0]';
  return (
    <button onClick={onClick} className={`${base} ${tone} ${active && danger ? 'bg-red-50' : ''}`}>
      {children}
      <span className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 text-white text-[11px] px-2 py-1 opacity-0 group-hover/tb:opacity-100 transition-opacity z-30">
        {title}
      </span>
    </button>
  );
}

/* 3 line-style choices: solid / dashed / dotted */
function LineStyleRow({ value, onPick }) {
  const opts = [
    { k: 'solid',  dash: '' },
    { k: 'dashed', dash: '6 5' },
    { k: 'dotted', dash: '1 5' },
  ];
  return (
    <div className="flex gap-1 mb-2">
      {opts.map((o) => (
        <button key={o.k} onClick={() => onPick(o.k)} title={o.k}
                className={`flex-1 h-7 rounded-lg border flex items-center justify-center ${value === o.k ? 'border-[#473AE0] bg-indigo-50' : 'border-gray-200'}`}>
          <svg width="30" height="8" viewBox="0 0 30 8">
            <path d="M1 4 H29" stroke={value === o.k ? '#473AE0' : '#9aa3b2'} strokeWidth="2"
                  strokeDasharray={o.dash || undefined} strokeLinecap={o.k === 'dotted' ? 'round' : 'butt'} />
          </svg>
        </button>
      ))}
    </div>
  );
}

/* floating toolbar above a canvas object (note / link) */
function ItemToolbar({ zoom, colors, extra, onDuplicate, onDelete }) {
  return (
    <div data-ui className="absolute left-1/2 z-20"
         style={{ top: -10, transform: `translate(-50%, -100%) scale(${1 / zoom})`, transformOrigin: 'bottom center' }}
         onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-0.5 bg-white rounded-xl shadow-xl border border-gray-100 px-1.5 py-1.5">
        {colors}
        {extra}
        {(colors || extra) && <div className="w-px h-5 bg-gray-200 mx-0.5" />}
        <button onClick={onDuplicate} title="Duplicate" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-[#473AE0]"><Copy size={15} /></button>
        <button onClick={onDelete} title="Delete" className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

/* note color = a single swatch that opens a 4-color popover (same pattern as page/section) */
function NoteColorButton({ value, onPick }) {
  const [open, setOpen] = useState(false);
  const nc = NOTE_COLORS[value] || NOTE_COLORS.yellow;
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} title="Note color" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100">
        <span className="w-4 h-4 rounded-full" style={{ background: nc.bg, boxShadow: `inset 0 0 0 1px ${nc.edge}` }} />
      </button>
      {open && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-100 px-3 py-2 flex gap-2">
          {NOTE_KEYS.map((k) => (
            <button key={k} onClick={() => { onPick(k); setOpen(false); }} title={k} className="w-5 h-5 rounded-full"
                    style={{ background: NOTE_COLORS[k].bg, boxShadow: value === k ? `0 0 0 2px #fff, 0 0 0 3px ${NOTE_COLORS[k].edge}` : `inset 0 0 0 1px ${NOTE_COLORS[k].edge}` }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* shared 12-color palette popover + free color picker */
function ColorPalette({ value, onPick, onClose, keys = COLOR_KEYS }) {
  const isPreset = !!COLORS[value];
  return (
    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-44">
      <div className="grid grid-cols-4 gap-2.5 justify-items-center">
        {keys.map((k) => {
          const col = resolveColor(k);
          return (
            <button key={k} onClick={() => { onPick(k); onClose?.(); }} title={col.name}
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: col.solid,
                             boxShadow: value === k ? `0 0 0 2px #fff, 0 0 0 4px ${col.solid}` : 'none' }}>
              {value === k && <span className="w-2 h-2 rounded-full bg-white" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-2">
        <label className="relative w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden"
               title="Pick a custom color"
               style={!isPreset ? { background: resolveColor(value).solid } : undefined}>
          {isPreset && <Plus size={15} className="text-gray-500" />}
          <input type="color" value={resolveColor(value).solid}
                 onChange={(e) => onPick(e.target.value)}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        </label>
        <span className="text-xs text-gray-500">Custom color</span>
      </div>
    </div>
  );
}

/* small inline delete confirmation popover (English) */
function DeleteConfirm({ text, onCancel, onConfirm }) {
  return (
    <div className="absolute top-full mt-2 right-0 bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-56 text-left">
      <div className="text-sm text-gray-700 mb-3">{text}</div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
        <button onClick={onConfirm} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600">Delete</button>
      </div>
    </div>
  );
}

/* ---------------- PAGE menu ---------------- */
function PageToolbar({ zoom, node, colorOpen, frameOpen, linkOpen, colorKeys,
                       onAddBlock, onFrame, onPickFrame, onColor, onPickColor, onCloseColor, onLink, onSetLink, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  return (
    <ToolbarShell zoom={zoom}>
      {/* 1 — add section */}
      <TBtn onClick={onAddBlock} title="Add section"><Plus size={16} /></TBtn>
      {/* 2 — page frame */}
      <button onClick={onFrame} title="Frame"
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 ${frameOpen ? 'bg-indigo-50 text-[#473AE0]' : ''}`}>
        <PageFrameGlyph frame={node.pageFrame || 'window'} />
      </button>
      {/* 3 — color */}
      <button onClick={onColor} title="Color" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100">
        <span className="w-4 h-4 rounded-full" style={{ background: resolveColor(node.color).solid }} />
      </button>
      {/* 6 — link */}
      <button onClick={onLink} title="Link to this page"
              className={`w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 ${node.link ? 'text-[#473AE0]' : 'text-gray-600'}`}>
        <ExternalLink size={16} />
      </button>
      {/* 7 — AI */}
      <button onClick={() => setAiOpen((v) => !v)} title="AI"
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-purple-500 hover:bg-purple-50 ${aiOpen ? 'bg-purple-50' : ''}`}>
        <Sparkles size={16} />
      </button>
      <div className="w-px h-5 bg-gray-200 mx-0.5" />
      {/* 8 — delete page */}
      <button onClick={() => setConfirm(true)} title="Delete page" className={`w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 ${confirm ? 'bg-red-50' : ''}`}><Trash2 size={16} /></button>

      {confirm && (
        <DeleteConfirm
          text="Delete this page and all its sub-pages?"
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); onDelete(); }}
        />
      )}

      {frameOpen && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 flex gap-1 bg-white rounded-xl shadow-xl border border-gray-100 px-2 py-2">
          {PAGE_FRAMES.map((f) => (
            <button key={f} onClick={() => onPickFrame(f)} title={f}
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center hover:border-indigo-300 ${(node.pageFrame || 'window') === f ? 'border-[#473AE0] bg-indigo-50' : 'border-gray-200'}`}
                    style={{ color: '#473AE0' }}>
              <PageFrameGlyph frame={f} />
            </button>
          ))}
        </div>
      )}

      {colorOpen && <ColorPalette value={node.color} onPick={onPickColor} onClose={onCloseColor} keys={colorKeys} />}

      {linkOpen && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-100 px-2 py-2 w-56">
          <div className="text-[10px] font-semibold text-gray-400 px-1 pb-1 uppercase tracking-wide">Link to this page</div>
          <input autoFocus value={node.link || ''} onChange={(e) => onSetLink(e.target.value)} placeholder="Enter link URL"
                 className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-300" />
        </div>
      )}

      {aiOpen && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-60">
          <textarea autoFocus placeholder="A few words about page content…" rows={3}
                    className="w-full resize-none outline-none text-sm text-gray-700 placeholder-gray-400" />
          <button className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-purple-500 hover:bg-purple-50">
            <Sparkles size={15} /> Generate
          </button>
        </div>
      )}
    </ToolbarShell>
  );
}

/* ---------------- SECTION menu (floats above the selected section) ---------------- */
function SectionToolbar({ zoom, topOffset, block, colorOpen, framePickerOpen, arrowActive, colorKeys,
                          onMarkDone, onAddBelow, onColor, onPickColor, onCloseColor, onWireframes, onPickFrame, onClearFrame,
                          onArrows, onDuplicate, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <ToolbarShell zoom={zoom} top={topOffset != null ? topOffset - 12 : -12}>
      {/* 1 — mark as completed (toggle) */}
      <button onClick={onMarkDone}
              className={`relative group/tb w-7 h-7 rounded-lg flex items-center justify-center ${block.done ? 'bg-green-50 text-green-600' : 'text-gray-600 hover:bg-gray-100 hover:text-[#473AE0]'}`}>
        <CheckCircle2 size={16} fill={block.done ? 'currentColor' : 'none'} stroke={block.done ? '#fff' : 'currentColor'} />
        <span className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 text-white text-[11px] px-2 py-1 opacity-0 group-hover/tb:opacity-100 transition-opacity z-30">
          {block.done ? 'Mark as not completed' : 'Mark as completed'}
        </span>
      </button>
      {/* 2 — add section below */}
      <TipBtn title="Add section below" onClick={onAddBelow}><PlusSquare size={16} /></TipBtn>
      {/* 3 — color */}
      <TipBtn title="Section color" active={colorOpen} onClick={onColor}>
        <span className="w-4 h-4 rounded-full" style={{ background: resolveColor(block.color).solid }} />
      </TipBtn>
      {/* 4 — wireframe */}
      <TipBtn title="Wireframe" active={framePickerOpen} onClick={onWireframes}><LayoutGrid size={16} /></TipBtn>
      {/* 5 — arrows (link to pages) */}
      <TipBtn title="Link to pages" active={arrowActive || (block.arrowTargets || []).length > 0} onClick={onArrows}><MoveUpRight size={16} /></TipBtn>
      <div className="w-px h-5 bg-gray-200 mx-0.5" />
      {/* 6 — duplicate */}
      <TipBtn title="Duplicate section" onClick={onDuplicate}><Copy size={16} /></TipBtn>
      {/* 7 — delete (with confirm) */}
      <TipBtn title="Delete section" danger active={confirm} onClick={() => setConfirm(true)}><Trash2 size={16} /></TipBtn>

      {confirm && (
        <DeleteConfirm
          text="Delete this section?"
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); onDelete(); }}
        />
      )}

      {colorOpen && <ColorPalette value={block.color} onPick={onPickColor} onClose={onCloseColor} keys={colorKeys} />}

      {framePickerOpen && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-100 p-2 w-60">
          <div className="text-[10px] font-semibold text-gray-400 px-1 pb-1.5 uppercase tracking-wide">Wireframe — {block.name}</div>
          <div className="grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto">
            {FRAME_KEYS.map((f) => (
              <button key={f} onClick={() => onPickFrame(f)} title={f}
                      className={`h-12 rounded-lg border flex items-center justify-center px-1.5 py-1 hover:border-indigo-300 ${block.frame === f ? 'border-[#473AE0] bg-indigo-50' : 'border-gray-200'}`}
                      style={{ color: '#473AE0' }}>
                <FrameGlyph frame={f} />
              </button>
            ))}
          </div>
          <button onClick={onClearFrame} className="w-full text-center text-sm text-red-500 font-medium pt-2 hover:text-red-600">Clear</button>
        </div>
      )}
    </ToolbarShell>
  );
}

function TBtn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-[#473AE0]">
      {children}
    </button>
  );
}

function ToolBtn({ children, onClick, title, active }) {
  return (
    <button onClick={onClick} title={title}
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'}`}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Project menu (left dropdown): Go to Dashboard + Export              */
/* ------------------------------------------------------------------ */
function ProjectMenu({ onClose, onDashboard, exportMenu }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute left-0 top-10 z-40 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5"
         onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <button onClick={onDashboard} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
        <LayoutGrid size={15} /> Go to Dashboard
      </button>
      <div className="h-px bg-gray-100 my-1" />
      {exportMenu}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Project settings panel (theme / frames / colors)                   */
/* ------------------------------------------------------------------ */
function ProjectSettings({ settings, setSettings, onClose, onAddColor, onRemoveColor }) {
  const [tab, setTab] = useState('general');
  const setTheme = (t) => setSettings((s) => ({ ...s, theme: t }));
  const setFrame = (f) => setSettings((s) => ({ ...s, frame: f }));
  const colorList = (settings.colorList && settings.colorList.length) ? settings.colorList : COLOR_KEYS;
  return (
    <div data-ui className="absolute top-0 right-0 bottom-0 w-80 bg-white border-l border-gray-100 shadow-xl z-50 flex flex-col"
         onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
        <span className="font-semibold text-gray-800">Project settings</span>
        <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 flex items-center justify-center"><X size={16} /></button>
      </div>
      <div className="flex items-center gap-8 px-5 border-b border-gray-100">
        <button onClick={() => setTab('general')} className={`py-3 ${tab === 'general' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-400'}`}><Sliders size={16} /></button>
        <button onClick={() => setTab('colors')} className={`py-3 ${tab === 'colors' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-400'}`}><Palette size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'general' ? (
          <>
            <div className="text-sm font-semibold text-gray-700 mb-3">Theme</div>
            <div className="grid grid-cols-2 gap-3 mb-7">
              {THEME_KEYS.map((k) => (
                <button key={k} onClick={() => setTheme(k)}
                        className={`rounded-xl border-2 p-3 h-20 flex flex-col justify-between ${settings.theme === k ? 'border-[#10B981]' : 'border-gray-200'}`}
                        style={{ background: THEMES[k].bg }}>
                  <span className={`text-sm font-medium ${k === 'dark' ? 'text-white' : 'text-gray-700'}`}>{THEMES[k].name}</span>
                  <div className="flex gap-1">
                    <span className="w-7 h-3 rounded" style={{ background: '#5C4FE8' }} />
                    <span className="w-4 h-3 rounded" style={{ background: '#13C08A' }} />
                  </div>
                </button>
              ))}
            </div>
            <div className="text-sm font-semibold text-gray-700 mb-3">Frames</div>
            <div className="grid grid-cols-3 gap-2">
              {FRAME_OPTIONS.map((f) => (
                <button key={f.key} onClick={() => setFrame(f.key)}
                        className={`rounded-xl border-2 p-3 flex flex-col items-center gap-1 ${settings.frame === f.key ? 'border-[#10B981]' : 'border-gray-200'}`}
                        style={{ color: '#473AE0' }}>
                  <PageFrameGlyph frame={f.frame} />
                  <span className="text-xs text-gray-600">{f.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold text-gray-700 mb-1">Color legend</div>
            <div className="text-xs text-gray-400 mb-2">Removing a color resets pages &amp; sections that used it to the default.</div>
            <div className="divide-y divide-gray-100">
              {colorList.map((k) => {
                const col = resolveColor(k);
                return (
                  <div key={k} className="flex items-center gap-3 py-2.5">
                    <span className="w-4 h-4 rounded-full" style={{ background: col.solid }} />
                    <span className="text-sm text-gray-700">{col.name}</span>
                    {k === 'blue'
                      ? <span className="ml-auto text-xs text-gray-400">Default</span>
                      : <button onClick={() => onRemoveColor(k)} className="ml-auto text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>}
                  </div>
                );
              })}
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-[#473AE0] font-medium cursor-pointer">
              <Plus size={16} /> New color
              <input type="color" defaultValue="#473AE0" onChange={(e) => onAddColor(e.target.value)} className="sr-only" />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section detail modal (description + comments + page preview)        */
/* ------------------------------------------------------------------ */
/* basic rich-text editor (bold / italic / underline / list) */
function RichEditor({ html, onChange }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.innerHTML = html || ''; /* set once */ }, []); // eslint-disable-line
  const cmd = (c) => { document.execCommand(c, false); if (ref.current) { ref.current.focus(); onChange(ref.current.innerHTML); } };
  const TB = ({ on, title, children }) => (
    <button onMouseDown={(e) => { e.preventDefault(); on(); }} title={title}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-[#473AE0]">{children}</button>
  );
  return (
    <div>
      <div className="flex items-center gap-0.5 border-b border-gray-100 pb-2 mb-3">
        <TB on={() => cmd('bold')} title="Bold"><Bold size={15} /></TB>
        <TB on={() => cmd('italic')} title="Italic"><Italic size={15} /></TB>
        <TB on={() => cmd('underline')} title="Underline"><Underline size={15} /></TB>
        <TB on={() => cmd('insertUnorderedList')} title="List"><List size={15} /></TB>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
           onInput={() => onChange(ref.current.innerHTML)}
           data-ph="Add a description…"
           className="min-h-[150px] outline-none text-gray-700 leading-relaxed empty:before:content-[attr(data-ph)] empty:before:text-gray-400" />
    </div>
  );
}

function SectionDetail({ node, block, onClose, onDescription, onAddComment }) {
  const [draft, setDraft] = useState('');
  const pcol = resolveColor(node.color);
  const send = () => { if (draft.trim()) { onAddComment(draft); setDraft(''); } };
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={onClose}>
     <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
      <div className="h-14 px-5 flex items-center justify-between border-b border-gray-100 shrink-0">
        <button onClick={onClose} className="flex items-center gap-2 text-[#473AE0] font-semibold"><ArrowLeft size={18} /> {block.name}</button>
        <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
      </div>
      <div className="flex gap-8 p-6 overflow-auto">
        {/* left: description + comments */}
        <div className="flex-1 min-w-0 max-w-[680px]">
          <div className="rounded-2xl border border-gray-200 p-5">
            <div className="text-lg font-bold mb-3" style={{ color: pcol.solid }}>{block.name}</div>
            <RichEditor html={block.description} onChange={onDescription} />
          </div>
          <div className="mt-6 space-y-3">
            {(block.comments || []).map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <span className="w-8 h-8 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0" style={{ background: c.color }}>{c.initials}</span>
                <div className="bg-gray-50 rounded-xl px-3 py-2 flex-1">
                  <div className="text-xs font-semibold text-gray-700">{c.author} <span className="text-gray-400 font-normal ml-1">{relTime(c.ts)}</span></div>
                  <div className="text-sm text-gray-700 break-words">{c.text}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2">
              <span className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style={{ background: ME.color }}>{ME.initials}</span>
              <div className="flex-1 relative">
                <input value={draft} onChange={(e) => setDraft(e.target.value)}
                       onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                       placeholder="Add a comment…"
                       className="w-full bg-gray-100 rounded-xl pl-4 pr-12 py-3 outline-none text-sm" />
                {draft.trim() && (
                  <button onClick={send} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#473AE0] text-white flex items-center justify-center hover:bg-[#3a2fc0]"><Send size={14} /></button>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* right: compact page preview, active section highlighted */}
        <div className="shrink-0">
          <div className="w-60 rounded-2xl border-2" style={{ borderColor: pcol.solid }}>
            <div className="text-center font-bold py-2.5" style={{ color: pcol.solid }}>{node.label}</div>
            <div className="px-2 pb-2 flex flex-col gap-1.5">
              {node.blocks.map((bb) => {
                const bc = resolveColor(bb.color);
                const active = bb.id === block.id;
                return (
                  <div key={bb.id} className="rounded-md px-2 py-2 text-white text-[11px] font-semibold"
                       style={{ background: active ? bc.solid : bc.soft, boxShadow: active ? `0 0 0 2px #fff, 0 0 0 4px ${bc.solid}` : 'none' }}>
                    {bb.name}
                    <div className="mt-1" style={{ color: 'rgba(255,255,255,0.9)', height: 18 }}><FrameGlyph frame={bb.frame || 'bar'} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
     </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Export menu (JSON / XML / CSV + backup / load)                     */
/* ------------------------------------------------------------------ */
function ExportMenu({ nodes, childrenOf, onClose, setNodes }) {
  const download = (content, filename, type) => {
    const a = document.createElement('a');
    a.href = `data:${type};charset=utf-8,${encodeURIComponent(content)}`;
    a.download = filename;
    a.click();
    onClose();
  };
  const escapeXML = (s) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

  const hierarchy = (pid = null) =>
    childrenOf(pid).map((n) => ({ label: n.label, color: n.color,
      blocks: n.blocks.map((b) => ({ name: b.name, color: b.color })), children: hierarchy(n.id) }));

  const exportJSON = () => download(JSON.stringify(hierarchy(), null, 2), 'sitemap.json', 'application/json');
  const exportXML = () => {
    const build = (pid = null, indent = '  ') =>
      childrenOf(pid).map((n) => {
        const kids = childrenOf(n.id);
        const inner = kids.length ? `\n${build(n.id, indent + '  ')}\n${indent}` : '';
        return `${indent}<page label="${escapeXML(n.label)}">${inner}</page>`;
      }).join('\n');
    download(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemap>\n${build()}\n</sitemap>`, 'sitemap.xml', 'application/xml');
  };
  const exportCSV = () => {
    let csv = 'Label,Depth,Blocks\n';
    const walk = (pid = null, d = 0) => childrenOf(pid).forEach((n) => {
      csv += `"${n.label}",${d},"${n.blocks.map((b) => b.name).join(' | ')}"\n`;
      walk(n.id, d + 1);
    });
    walk();
    download(csv, 'sitemap.csv', 'text/csv');
  };
  const exportTXT = () => {
    let txt = '';
    const walk = (pid = null, d = 0) => childrenOf(pid).forEach((n) => {
      txt += `${'  '.repeat(d)}- ${n.label}${n.link ? ' (' + n.link + ')' : ''}\n`;
      walk(n.id, d + 1);
    });
    walk();
    download(txt, 'sitemap.txt', 'text/plain');
  };
  const backup = () => download(JSON.stringify(nodes, null, 2), 'sitemap-backup.json', 'application/json');
  const load = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('not an array');
        setNodes(data);
        onClose();
      } catch (err) { alert('Invalid file — expected a sitemap backup (.json).'); }
    };
    r.readAsText(f);
  };

  const item = 'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50';
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-400 px-3 pt-1 pb-0.5 uppercase tracking-wide">Export</div>
      <button className={item} onClick={exportJSON}><Download size={15} /> JSON</button>
      <button className={item} onClick={exportXML}><Download size={15} /> Sitemap XML</button>
      <button className={item} onClick={exportCSV}><Download size={15} /> CSV</button>
      <button className={item} onClick={exportTXT}><Download size={15} /> TXT</button>
      <div className="h-px bg-gray-100 my-1" />
      <div className="text-[10px] font-semibold text-gray-400 px-3 pt-1 pb-0.5 uppercase tracking-wide">Import / Backup</div>
      <label className={item + ' cursor-pointer'}><Upload size={15} /> Import JSON
        <input type="file" accept=".json,application/json" onChange={load} className="hidden" />
      </label>
      <button className={item} onClick={backup}><Save size={15} /> Backup (.json)</button>
    </div>
  );
}
