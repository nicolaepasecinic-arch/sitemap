import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, ArrowLeft, Check, Copy,
  Download, Sparkles, StickyNote, Share2, ExternalLink, Unlink, MoveUpRight,
  MessageSquare, Paperclip, Search, Play, X, RotateCcw, RotateCw, Pencil, Menu,
  Settings, Palette, Send, LogOut, Users, ChevronDown, BarChart3, Languages, Bot, RefreshCw, Loader2, FolderOpen
} from 'lucide-react';
import BrandStar from '../components/Brand';
import InvitePanel from '../components/InvitePanel';
import Account from '../components/Account';
import ConnectAI from '../components/ConnectAI';
import Team from '../components/Team';
import { hasBackend, apiAssistant, apiSyncProjectTask } from '../api';
import { duplicateProject } from '../projectStore';
import { initials } from '../auth';

import {
  COLORS, COLOR_KEYS, resolveColor, NOTE_COLORS, ME, THEMES,
  frameDefaultFor, relTime, FRAME_KEYS, FrameGlyph,
  CARD_W, HEADER_H, BLOCK_H, BLOCK_GAP, ADD_ROW, H_GAP, V_GAP, MARGIN, uid, cardHeight,
} from './sitemapTheme';
import {
  LineStyleRow, ItemToolbar, NoteColorButton, PageToolbar, SectionToolbar,
  ToolBtn, ProjectMenu, ProjectSettings, SectionDetail, FilesModal, ExportMenu,
} from './sitemapPanels';

/* ================================================================== */
export default function SitemapBuilder({ project, onBack, onChange, user, onLogout, onUserChange, readOnly = false, embedded = false }) {
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
  const [shareTab, setShareTab] = useState('link');
  const [acctMenuOpen, setAcctMenuOpen] = useState(false);
  const [acctModalOpen, setAcctModalOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [connectAiOpen, setConnectAiOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [projMenuOpen, setProjMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [filesPulse, setFilesPulse] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncBusy, setSyncBusy] = useState({}); // nodeId -> true while its task is syncing
  const [syncErr, setSyncErr] = useState('');
  const [askScope, setAskScope] = useState(false); // "all vs only new" prompt
  // linked Active Collab project (kept in state so it reflects links made this session)
  const [acProject, setAcProject] = useState({ id: project?.acProjectId || '', name: project?.acProjectName || '' });
  const [sectionDetail, setSectionDetail] = useState(null); // {nodeId, blockId}
  // -------- AI assistant (chat that edits the project) --------
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantInput, setAssistantInput] = useState('');
  const chatKey = `qoders-chat-${project?.id || 'local'}`;
  const [chat, setChat] = useState(() => {
    try { const raw = sessionStorage.getItem(chatKey); if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) return arr; } } catch (e) {}
    return [{ role: 'ai', text: "Hi! I'm your Qoders Map Assistant. Tell me what to change — add pages or sections, recolor, link sections to pages, delete things, or build out a whole page." }];
  });
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiMenuAnchor, setAiMenuAnchor] = useState('left'); // 'left' (bottom cluster) | 'center' (main toolbar)
  const [aiSub, setAiSub] = useState(null); // null | 'colors' | 'translate'
  const [aiSubInput, setAiSubInput] = useState('');
  const [cloneState, setCloneState] = useState(null); // null | 'confirm' | 'busy'
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

  // keep the assistant chat history for this project during the session (not saved to DB)
  useEffect(() => {
    try { sessionStorage.setItem(chatKey, JSON.stringify(chat.slice(-50))); } catch (e) {}
  }, [chat, chatKey]);

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
  // Project-level file attachments (managed in the Files modal, stored on settings.files).
  const projectFiles = settings.files || [];
  const setProjectFiles = (files) => setSettings((s) => ({ ...s, files }));
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
  // AI: replace a page's blocks with a generated content map (ordered sections).
  const applyContentMap = (nodeId, sections) => {
    if (!Array.isArray(sections) || !sections.length) return;
    const blocks = sections.map((s) => ({
      id: uid(),
      name: (s && s.name) || 'Section',
      color: (s && s.color) || 'blue',
      frame: (s && s.frame) || 'bar',
      done: false,
      arrowTargets: [],
      description: (s && s.description) || '',
    }));
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, blocks } : n)));
  };

  /* -------------------- AI assistant: apply structured operations -------------------- */
  const applyAiOperations = (ops) => {
    if (!Array.isArray(ops) || !ops.length) return;
    const validColor = (c) => (c && (COLORS[c] || /^#/.test(c)) ? c : null);
    const validFrame = (f) => (f && (FRAME_KEYS.includes(f) || f === 'none') ? f : null);
    setNodes((ns) => {
      // deep-ish clone so we can mutate freely
      let work = ns.map((n) => ({ ...n, blocks: (n.blocks || []).map((b) => ({ ...b, arrowTargets: [...(b.arrowTargets || [])] })) }));
      const idMap = {}; // AI temp id -> real id
      const realId = (id) => (id && idMap[id]) || id;
      const findPage = (id) => {
        if (!id) return null;
        const rid = realId(id);
        return work.find((n) => n.id === rid) || work.find((n) => (n.label || '').toLowerCase() === String(id).toLowerCase()) || null;
      };
      const findBlock = (page, id) => {
        if (!page || !id) return null;
        const rid = realId(id);
        return (page.blocks || []).find((b) => b.id === rid) || (page.blocks || []).find((b) => (b.name || '').toLowerCase() === String(id).toLowerCase()) || null;
      };
      const pageIdRef = (id) => { const p = findPage(id); return p ? p.id : null; };

      for (const op of ops) {
        switch (op && op.op) {
          case 'add_page': {
            const id = uid();
            if (op.pageId) idMap[op.pageId] = id;
            const parent = op.parentId ? pageIdRef(op.parentId) : null;
            work.push({ id, label: (op.title || 'Page').slice(0, 80), parentId: parent, group: 'main', color: validColor(op.color) || 'blue', link: op.url || '', pageFrame: 'window', blocks: [] });
            break;
          }
          case 'rename_page': { const p = findPage(op.pageId); if (p && op.title) p.label = op.title.slice(0, 80); break; }
          case 'delete_page': {
            const p = findPage(op.pageId); if (!p) break;
            const rm = new Set([p.id]); let added = true;
            while (added) { added = false; for (const n of work) { if (n.parentId && rm.has(n.parentId) && !rm.has(n.id)) { rm.add(n.id); added = true; } } }
            work = work.filter((n) => !rm.has(n.id));
            break;
          }
          case 'set_page_color': { const p = findPage(op.pageId); const c = validColor(op.color); if (p && c) p.color = c; break; }
          case 'set_page_link': { const p = findPage(op.pageId); if (p) p.link = op.url || ''; break; }
          case 'add_section': {
            const p = findPage(op.pageId); if (!p) break;
            const id = uid(); if (op.sectionId) idMap[op.sectionId] = id;
            const block = { id, name: (op.name || 'Section').slice(0, 60), color: validColor(op.color) || p.color || 'blue', frame: validFrame(op.frame) || 'bar', done: !!op.done, arrowTargets: [], description: (op.description || '').slice(0, 400) };
            const pos = Number.isInteger(op.position) && op.position >= 0 && op.position <= p.blocks.length ? op.position : p.blocks.length;
            p.blocks.splice(pos, 0, block);
            break;
          }
          case 'update_section': {
            const p = findPage(op.pageId); const b = findBlock(p, op.sectionId); if (!b) break;
            if (op.name) b.name = op.name.slice(0, 60);
            const f = validFrame(op.frame); if (f) b.frame = f;
            const c = validColor(op.color); if (c) b.color = c;
            if (op.description) b.description = op.description.slice(0, 400);
            break;
          }
          case 'delete_section': {
            const p = findPage(op.pageId); const b = findBlock(p, op.sectionId); if (!p || !b) break;
            p.blocks = p.blocks.filter((x) => x.id !== b.id);
            break;
          }
          case 'move_section': {
            const p = findPage(op.pageId); const b = findBlock(p, op.sectionId); if (!p || !b) break;
            const from = p.blocks.findIndex((x) => x.id === b.id);
            p.blocks.splice(from, 1);
            const pos = Number.isInteger(op.position) && op.position >= 0 && op.position <= p.blocks.length ? op.position : p.blocks.length;
            p.blocks.splice(pos, 0, b);
            break;
          }
          case 'set_section_done': { const p = findPage(op.pageId); const b = findBlock(p, op.sectionId); if (b) b.done = !!op.done; break; }
          case 'add_arrow': {
            const p = findPage(op.pageId); const b = findBlock(p, op.sectionId); const target = pageIdRef(op.toPageId);
            if (b && target && target !== p.id && !b.arrowTargets.includes(target)) b.arrowTargets.push(target);
            break;
          }
          case 'remove_arrow': {
            const p = findPage(op.pageId); const b = findBlock(p, op.sectionId); const target = pageIdRef(op.toPageId);
            if (b && target) b.arrowTargets = b.arrowTargets.filter((t) => t !== target);
            break;
          }
          default: break;
        }
      }
      return work;
    });
  };

  // core: send a message to the assistant, apply any operations, log into chat
  const askAssistant = async (msg, { showUser = true } = {}) => {
    if (!msg || assistantBusy) return;
    if (!hasBackend()) {
      setChat((c) => [...c, ...(showUser ? [{ role: 'user', text: msg }] : []), { role: 'ai', text: 'The assistant needs the backend running (set REACT_APP_API_URL).' }]);
      return;
    }
    if (showUser) setChat((c) => [...c, { role: 'user', text: msg }]);
    setAssistantBusy(true);
    try {
      const res = await apiAssistant(msg, { name: projectName, nodes });
      if (res && Array.isArray(res.operations) && res.operations.length) applyAiOperations(res.operations);
      setChat((c) => [...c, { role: 'ai', text: (res && res.reply) || 'Done.' }]);
    } catch (e) {
      setChat((c) => [...c, { role: 'ai', text: (e && e.message) || 'Something went wrong.' }]);
    } finally {
      setAssistantBusy(false);
    }
  };
  const sendAssistant = () => {
    const msg = assistantInput.trim();
    if (!msg) return;
    setAssistantInput('');
    askAssistant(msg);
  };

  // AI menu actions
  const toggleAiMenu = (anchor) => {
    if (aiMenuOpen && aiMenuAnchor === anchor) { setAiMenuOpen(false); setAiSub(null); }
    else { setAiMenuAnchor(anchor); setAiSub(null); setAiMenuOpen(true); }
  };
  const openAiChat = () => { setAiMenuOpen(false); setAiSub(null); setAssistantOpen(true); };
  const runSeoTags = () => {
    setAiMenuOpen(false); setAiSub(null); setAssistantOpen(true);
    askAssistant('Generate SEO meta tags for the project: for every page give a concise SEO page title (≤60 chars) and a meta description (≤155 chars). Reply grouped by page. Do not change the project (no operations).', { showUser: false });
  };
  const runColorChange = () => {
    const p = aiSubInput.trim(); if (!p || assistantBusy) return;
    setAiMenuOpen(false); setAiSub(null); setAiSubInput(''); setAssistantOpen(true);
    askAssistant(`Recolor the whole project to match this direction: "${p}". Use set_page_color and update_section color operations so the palette is cohesive and professional across all pages and sections.`, { showUser: false });
  };
  const runTranslate = () => {
    const p = aiSubInput.trim(); if (!p || assistantBusy) return;
    setAiMenuOpen(false); setAiSub(null); setAiSubInput(''); setAssistantOpen(true);
    askAssistant(`Translate the whole project into ${p}: translate every page name and every section's name and description. Use rename_page and update_section operations and keep the structure unchanged.`, { showUser: false });
  };

  // Clone the current project
  const doClone = async () => {
    setCloneState('busy');
    try {
      await onChange?.({ nodes, items, settings }); // make sure latest state is saved first
      const copy = await duplicateProject(project.id);
      setCloneState(null);
      setToast('Project copied — find it on your dashboard.');
      if (copy && copy.id && onBack) { /* stay; user can open from dashboard */ }
    } catch (e) {
      setCloneState(null);
      setToast('Could not copy the project.');
    }
  };

  // shared AI menu popup (used by both the main toolbar and the bottom-left pill)
  const renderAiMenu = (posClass) => (
    <>
      <div className="fixed inset-0 z-30" onClick={() => { setAiMenuOpen(false); setAiSub(null); }} />
      <div className={`absolute bottom-12 ${posClass} z-40 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5`}>
        {!aiSub && (
          <>
            <button onClick={openAiChat} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left">
              <Sparkles size={17} className="text-[#473AE0]" />
              <span className="text-sm font-medium text-gray-800 flex-1">AI Generate</span>
              <MoveUpRight size={15} className="text-gray-400" />
            </button>
            <div className="h-px bg-gray-100 my-1" />
            <button onClick={() => { setAiSub('colors'); setAiSubInput(''); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left">
              <Palette size={17} className="text-gray-600" /><span className="text-sm text-gray-800">Change colors</span>
            </button>
            <button onClick={runSeoTags} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left">
              <BarChart3 size={17} className="text-gray-600" /><span className="text-sm text-gray-800">Generate SEO tags</span>
            </button>
            <button onClick={() => { setAiSub('translate'); setAiSubInput(''); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left">
              <Languages size={17} className="text-gray-600" /><span className="text-sm text-gray-800">Translate to…</span>
            </button>
          </>
        )}
        {aiSub && (
          <div className="p-1">
            <button onClick={() => setAiSub(null)} className="flex items-center gap-1.5 px-1 py-1 text-sm font-medium text-gray-700 hover:text-gray-900"><ArrowLeft size={16} /> Back</button>
            <textarea autoFocus value={aiSubInput} onChange={(e) => setAiSubInput(e.target.value)} rows={3}
                      onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') (aiSub === 'colors' ? runColorChange() : runTranslate()); }}
                      placeholder={aiSub === 'colors' ? 'Try “Google brand colors”' : 'Language, e.g. Spanish'}
                      className="w-full mt-2 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-violet-300 placeholder-gray-400" />
            <button onClick={aiSub === 'colors' ? runColorChange : runTranslate} disabled={!aiSubInput.trim() || assistantBusy}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-purple-500 hover:bg-purple-50 disabled:opacity-50 disabled:hover:bg-transparent">
              <Sparkles size={15} className={assistantBusy ? 'animate-spin' : ''} /> {assistantBusy ? 'Generating…' : 'Generate'}
            </button>
          </div>
        )}
      </div>
    </>
  );

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
  const setBlockAttachments = (nodeId, blockId, attachments) => {
    setNodes((ns) => ns.map((n) => (n.id === nodeId
      ? { ...n, blocks: n.blocks.map((b) => (b.id === blockId ? { ...b, attachments } : b)) } : n)));
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

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/#/view/${project?.id || ''}`;
  const theme = THEMES[settings.theme] || THEMES.light;
  const isDark = settings.theme === 'dark';
  const cardBg = isDark ? '#1F2A44' : '#ffffff';     // page-card background (dark-aware)
  const dflFrame = frameDefaultFor(settings.frame);
  const visibleColorKeys = settings.colorList && settings.colorList.length ? settings.colorList : COLOR_KEYS;

  /* -------------------- Active Collab task sync -------------------- */
  // role gating: clients (and viewers) can't sync / configure Active Collab
  const canSyncAc = ['owner', 'pm', 'production', 'editor'].includes(project?.role || 'owner');
  // Build a descriptive task body (HTML) for one page: name, every section
  // (name / frame / description / status) and any comments on those sections.
  const buildTaskBody = (node) => {
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const blocks = node.blocks || [];
    let html = `<p><strong>Page:</strong> ${esc(node.label)}</p>`;
    if (node.link) html += `<p><strong>Link:</strong> ${esc(node.link)}</p>`;
    html += `<p><strong>Sections (${blocks.length}):</strong></p>`;
    if (!blocks.length) {
      html += '<p><em>No sections yet.</em></p>';
    } else {
      html += '<ol>';
      blocks.forEach((b) => {
        html += `<li><strong>${esc(b.name || 'Section')}</strong>`;
        const meta = [];
        if (b.frame) meta.push(`layout: ${esc(b.frame)}`);
        if (b.done) meta.push('done');
        if (meta.length) html += ` <em>(${meta.join(', ')})</em>`;
        if (b.description) html += `<br>${esc(b.description)}`;
        const cs = b.comments || [];
        if (cs.length) {
          html += '<br><strong>Comments:</strong><ul>';
          cs.forEach((c) => { html += `<li>${esc(c.author || 'User')}: ${esc(c.text)}</li>`; });
          html += '</ul>';
        }
        html += '</li>';
      });
      html += '</ol>';
    }
    html += '<p><em>Synced from Qoders sitemap.</em></p>';
    return html;
  };

  // Sync one page → create/update its AC task, then store the task id on the page + blocks.
  const syncPage = async (node) => {
    setSyncErr(''); setSyncBusy((s) => ({ ...s, [node.id]: true }));
    try {
      const { taskId, taskNumber } = await apiSyncProjectTask(project.id, { name: node.label || 'Page', body: buildTaskBody(node), taskId: node.acTaskId || '' });
      setNodes((ns) => ns.map((n) => (n.id === node.id
        ? { ...n, acTaskId: taskId, acTaskNumber: taskNumber || taskId, blocks: (n.blocks || []).map((b) => ({ ...b, acTaskId: taskId, acTaskNumber: taskNumber || taskId })) }
        : n)));
      return true;
    } catch (e) { setSyncErr(e.message || 'Sync failed'); return false; }
    finally { setSyncBusy((s) => { const c = { ...s }; delete c[node.id]; return c; }); }
  };

  // Sync a list of pages sequentially (so AC isn't hammered and rows update one by one).
  const syncPages = async (list) => {
    setSyncErr('');
    for (const n of list) { await syncPage(n); } // eslint-disable-line no-await-in-loop
  };
  // "Synchronize all" entry point: if there's a mix of synced + unsynced pages, ask
  // whether to sync everything or only the new (unsynced) ones; otherwise just run.
  const onSyncAll = () => {
    const unsynced = nodes.filter((n) => !n.acTaskId);
    if (unsynced.length > 0 && unsynced.length < nodes.length) { setAskScope(true); return; }
    syncPages(nodes);
  };

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
    <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 overflow-hidden select-none`}
         style={{ background: theme.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* ---------- Top bar ---------- */}
      {!embedded && (
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
                onLogout={onLogout ? () => { setProjMenuOpen(false); onLogout(); } : null}
                exportMenu={<ExportMenu nodes={nodes} childrenOf={childrenOf} onClose={() => setProjMenuOpen(false)} setNodes={setNodes} />}
              />
            )}
          </div>
          <input
            value={projectName}
            readOnly={readOnly}
            onChange={(e) => !readOnly && setProjectName(e.target.value)}
            onBlur={() => !readOnly && onChange?.({ name: projectName.trim() || 'Untitled project' })}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            className="text-[15px] font-semibold text-[#473AE0] bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded px-1 w-48"
          />
        </div>
        {readOnly ? (
          <div className="flex items-center gap-3 pointer-events-auto">
            <span className="text-xs font-semibold text-gray-400 bg-white/70 rounded-full px-3 py-1.5 border border-gray-100">View only</span>
            <a href="#/" className="flex items-center gap-1.5 bg-[#473AE0] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-indigo-600"><BrandStar size={16} bg="#ffffff33" color="#ffffff" /> Open Qoders</a>
          </div>
        ) : (
        <div className="flex items-center gap-2 pointer-events-auto">
          <button onClick={() => setShareOpen(true)} className="flex items-center gap-1 bg-[#473AE0] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-indigo-600">
            Share <Play size={13} className="ml-1" fill="white" />
          </button>
          <button onClick={() => { setSearchOpen((v) => !v); setSearchQ(''); }} className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Search size={16} /></button>
          {hasBackend() && canSyncAc && <button onClick={() => setSyncOpen(true)} title="Synchronize with Active Collab" className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-[#473AE0] hover:text-white transition-colors"><RefreshCw size={16} /></button>}
          <button onClick={() => setSettingsOpen(true)} title="Project settings" className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Settings size={16} /></button>
          <div className="relative">
            <button onClick={() => setAcctMenuOpen((v) => !v)} title={user?.name || 'Account'}
                    className="flex items-center gap-2 hover:bg-gray-50 rounded-full pl-1 pr-3 py-1">
              <span className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-bold">{initials(user?.name) || 'NP'}</span>
              <span className="text-sm text-gray-700 whitespace-nowrap">{user?.name || 'My account'}</span>
              <ChevronDown size={15} className="text-gray-400" />
            </button>
            {acctMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAcctMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-50 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5">
                  {user?.email && <div className="px-3 py-1.5 text-xs text-gray-400 truncate">{user.email}</div>}
                  <button onClick={() => { setAcctMenuOpen(false); setAcctModalOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left"><Settings size={15} /> Account settings</button>
                  {user?.teamRole === 'pm' && <button onClick={() => { setAcctMenuOpen(false); setTeamOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left"><Users size={15} /> Team</button>}
                  {user?.teamRole !== 'client' && <button onClick={() => { setAcctMenuOpen(false); setConnectAiOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left"><Bot size={15} /> Connect to AI</button>}
                  <div className="h-px bg-gray-100 my-1" />
                  <button onClick={() => { setAcctMenuOpen(false); onLogout && onLogout(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 text-left"><LogOut size={15} /> Logout</button>
                </div>
              </>
            )}
          </div>
        </div>
        )}

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
      )}

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
                      pointerEvents: readOnly ? 'none' : undefined,
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
                  <div className="absolute rounded-xl pointer-events-none"
                       style={{ inset: 0, background: cardBg, transform: 'translate(7px, 7px)', border: `2px solid ${col.solid}`, opacity: 0.45, zIndex: -1 }} />
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
                        onClearFrame={() => setBlockFrame(n.id, activeBlock.id, 'none')}
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
                      onApplyContentMap={(sections) => applyContentMap(n.id, sections)}
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
                  className={`w-full h-full flex flex-col overflow-hidden transition-shadow ${frame === 'phone' ? 'rounded-[28px]' : frame === 'pill' ? 'rounded-3xl' : 'rounded-xl'} ${arrowMode && arrowMode.nodeId !== n.id ? 'cursor-pointer' : ''}`}
                  style={{
                    background: cardBg,
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
                         onDragOver={(e) => { if (blockDragRef.current || dragId) e.preventDefault(); }}
                         onDrop={(e) => {
                           if (dragId && !blockDragRef.current) { if (dragId !== n.id) { e.preventDefault(); e.stopPropagation(); moveNode(dragId, n.id); } setDragId(null); setDropTargetId(null); return; }
                           const d = blockDragRef.current; if (d && d.nodeId !== n.id) moveBlockToPage(d.nodeId, d.blockId, n.id); blockDragRef.current = null;
                         }}>
                      {n.blocks.map((b) => {
                        const bc = resolveColor(b.color);
                        const blkSel = selectedBlock && selectedBlock.blockId === b.id;
                        return (
                          <div key={b.id} data-ui
                               draggable={!(editingBlock && editingBlock.blockId === b.id)}
                               onDragStart={(e) => { e.stopPropagation(); blockDragRef.current = { nodeId: n.id, blockId: b.id }; }}
                               onDragOver={(e) => { if (blockDragRef.current) { e.preventDefault(); e.stopPropagation(); } else if (dragId) { e.preventDefault(); } }}
                               onDrop={(e) => {
                                 if (dragId && !blockDragRef.current) { if (dragId !== n.id) { e.preventDefault(); e.stopPropagation(); moveNode(dragId, n.id); } setDragId(null); setDropTargetId(null); return; }
                                 e.stopPropagation(); const d = blockDragRef.current; if (d) { if (d.nodeId === n.id) moveBlock(n.id, d.blockId, b.id); else moveBlockToPage(d.nodeId, d.blockId, n.id, b.id); } blockDragRef.current = null;
                               }}
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
                         onDragOver={(e) => { if (blockDragRef.current || dragId) e.preventDefault(); }}
                         onDrop={(e) => {
                           if (dragId && !blockDragRef.current) { if (dragId !== n.id) { e.preventDefault(); e.stopPropagation(); moveNode(dragId, n.id); } setDragId(null); setDropTargetId(null); return; }
                           const d = blockDragRef.current; if (d && d.nodeId !== n.id) moveBlockToPage(d.nodeId, d.blockId, n.id); blockDragRef.current = null;
                         }}>
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
      {!readOnly && (
      <div data-ui className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white rounded-2xl shadow-lg border border-gray-100 px-2 py-1.5">
        <ToolBtn onClick={addRoot} title="Add page"><Plus size={18} /></ToolBtn>
        <div className="w-px h-6 bg-gray-200 mx-0.5" />
        <div className="relative">
          <ToolBtn active={(aiMenuOpen && aiMenuAnchor === 'center') || assistantOpen} onClick={() => toggleAiMenu('center')} title="AI assistant"><Sparkles size={18} className="text-purple-500" /></ToolBtn>
          {aiMenuOpen && aiMenuAnchor === 'center' && renderAiMenu('left-1/2 -translate-x-1/2')}
        </div>
        <ToolBtn onClick={addNote} title="Add note"><StickyNote size={18} /></ToolBtn>
        <button onClick={() => setFilesOpen(true)} title={projectFiles.length ? `Attached files (${projectFiles.length})` : 'Attach files'}
                className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-transform ${filesOpen || projectFiles.length ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'} ${filesPulse ? 'scale-110' : ''}`}>
          {filesPulse && <span className="absolute inset-0 rounded-xl ring-2 ring-[#473AE0] animate-ping" />}
          <Paperclip size={18} />
          {projectFiles.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#473AE0] text-white text-[10px] font-bold flex items-center justify-center shadow-sm ring-2 ring-white">{projectFiles.length}</span>
          )}
        </button>
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
      )}

      {/* ---------- AI + Clone + Undo/Redo (bottom-left) ---------- */}
      {!readOnly && (() => {
        const canUndo = undoStack.current.length > 0 && histTick >= 0;
        const canRedo = redoStack.current.length > 0;
        const btn = (enabled) => `w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center ${enabled ? 'text-gray-600 hover:bg-gray-50' : 'text-gray-300 cursor-default'}`;
        return (
          <div data-ui className="absolute bottom-5 left-5 z-30 flex items-center gap-2">
            {/* AI assistant pill */}
            <div className="relative">
              <button onClick={() => toggleAiMenu('left')} title="AI assistant"
                      className={`h-10 px-5 rounded-full shadow-lg flex items-center justify-center text-white bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:opacity-95 ${(aiMenuOpen && aiMenuAnchor === 'left') || assistantOpen ? 'ring-2 ring-violet-300' : ''}`}>
                <Sparkles size={18} />
              </button>
              {aiMenuOpen && aiMenuAnchor === 'left' && renderAiMenu('left-0')}
            </div>
            {/* Clone project */}
            <button onClick={() => setCloneState('confirm')} title="Clone project" className={btn(true)}><Copy size={18} /></button>
            <div className="w-px h-6 bg-gray-200 mx-0.5" />
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
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-bold text-gray-800">Share</span>
              <button onClick={() => setShareOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 flex items-center justify-center"><X size={16} /></button>
            </div>

            {/* tabs */}
            <div className="flex items-center gap-6 border-b border-gray-100 mb-4">
              <button onClick={() => setShareTab('link')} className={`pb-2 text-sm font-medium ${shareTab === 'link' ? 'text-[#473AE0] border-b-2 border-[#473AE0]' : 'text-gray-400'}`}>Share link</button>
              {hasBackend() && (
                <button onClick={() => setShareTab('invite')} className={`pb-2 text-sm font-medium flex items-center gap-1 ${shareTab === 'invite' ? 'text-[#473AE0] border-b-2 border-[#473AE0]' : 'text-gray-400'}`}>
                  <Users size={14} /> Invite people
                </button>
              )}
            </div>

            {shareTab === 'link' ? (
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
            ) : (
              <div>
                <p className="text-sm text-gray-500 mb-3">Invite people by email — they get access as soon as they sign up.</p>
                <InvitePanel projectId={project.id} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- Qoders Map Assistant (AI chat) ---------- */}
      {assistantOpen && !readOnly && (
        <div data-ui className="absolute top-0 right-0 bottom-0 w-80 bg-white border-l border-gray-100 shadow-xl z-40 flex flex-col">
          <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
            <span className="flex items-center gap-2 font-semibold text-gray-800">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center"><Sparkles size={15} /></span>
              Qoders Map Assistant
            </span>
            <button onClick={() => setAssistantOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 flex items-center justify-center"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chat.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-[#473AE0] text-white rounded-br-sm' : 'bg-gray-100 text-gray-700 rounded-bl-sm'}`}>{m.text}</div>
              </div>
            ))}
            {assistantBusy && (
              <div className="flex justify-start"><div className="bg-gray-100 text-gray-500 rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-1.5"><Sparkles size={14} className="animate-spin" /> Working…</div></div>
            )}
          </div>
          <div className="border-t border-gray-100 p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 px-3 py-2 focus-within:ring-1 focus-within:ring-violet-300">
              <textarea value={assistantInput}
                        onChange={(e) => { setAssistantInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 72) + 'px'; }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAssistant(); } }}
                        rows={1} placeholder="Ask the assistant to edit your project…" disabled={assistantBusy}
                        className="flex-1 resize-none overflow-y-auto max-h-[72px] outline-none text-sm text-gray-700 placeholder-gray-400 leading-6 disabled:opacity-60" />
              <button onClick={sendAssistant} disabled={assistantBusy || !assistantInput.trim()}
                      className="w-8 h-8 rounded-full bg-[#473AE0] text-white flex items-center justify-center shrink-0 hover:bg-[#3a2fc0] disabled:opacity-40"><Send size={15} /></button>
            </div>
            <div className="text-[10px] text-gray-400 mt-1.5 text-center">AI can add, edit, delete pages & sections, and link them.</div>
          </div>
        </div>
      )}

      {/* ---------- Connect to AI ---------- */}
      {connectAiOpen && <ConnectAI onClose={() => setConnectAiOpen(false)} />}

      {/* ---------- Clone project confirm ---------- */}
      {cloneState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={cloneState === 'busy' ? undefined : () => setCloneState(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center" onMouseDown={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-[#473AE0] flex items-center justify-center mx-auto mb-4"><Copy size={22} /></div>
            <h2 className="text-lg font-bold text-gray-800">Clone this project?</h2>
            <p className="text-sm text-gray-500 mt-1.5">A full copy of <span className="font-semibold text-gray-700">“{projectName}”</span> will be created on your dashboard.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setCloneState(null)} disabled={cloneState === 'busy'} className="flex-1 rounded-full py-2.5 font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">Cancel</button>
              <button onClick={doClone} disabled={cloneState === 'busy'} className="flex-1 rounded-full py-2.5 font-medium text-white bg-[#473AE0] hover:bg-[#3a2fc0] disabled:opacity-60">{cloneState === 'busy' ? 'Copying…' : 'Make a copy'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Account settings modal ---------- */}
      {acctModalOpen && (
        <Account user={user || {}} onClose={() => setAcctModalOpen(false)}
                 onUpdated={(u) => onUserChange && onUserChange(u)} onLogout={onLogout} />
      )}
      {teamOpen && <Team user={user} onClose={() => setTeamOpen(false)} />}

      {/* ---------- Project settings panel ---------- */}
      {settingsOpen && (
        <ProjectSettings settings={settings} setSettings={setSettings} onClose={() => setSettingsOpen(false)}
                         onAddColor={addProjectColor} onRemoveColor={removeProjectColor} project={project} isPM={user?.teamRole === 'pm'}
                         onAcLinked={(u) => setAcProject({ id: u?.acProjectId || '', name: u?.acProjectName || '' })} />
      )}

      {/* ---------- Active Collab sync modal ---------- */}
      {syncOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-6" onMouseDown={() => setSyncOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <RefreshCw size={18} className="text-[#473AE0]" />
                <h2 className="text-lg font-bold text-gray-800">Synchronize with Active Collab</h2>
              </div>
              <button onClick={() => setSyncOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
            </div>

            {!acProject.id ? (
              <div className="px-6 py-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3"><FolderOpen size={22} /></div>
                <div className="text-sm text-gray-600">No Active Collab project assigned.</div>
                <button onClick={() => { setSyncOpen(false); setSettingsOpen(true); }} className="mt-4 text-sm font-medium text-[#473AE0] hover:underline">Assign a project →</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
                  <div className="text-sm text-gray-500 truncate pr-3">Linked to <span className="font-medium text-gray-700">{acProject.name || acProject.id}</span></div>
                  <button onClick={onSyncAll} disabled={Object.keys(syncBusy).length > 0 || !nodes.length}
                          className="shrink-0 flex items-center gap-1.5 bg-[#473AE0] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-[#3a2fc0] disabled:opacity-50">
                    <RefreshCw size={14} /> Synchronize all
                  </button>
                </div>
                {askScope && (() => {
                  const unsynced = nodes.filter((n) => !n.acTaskId);
                  return (
                    <div className="mx-6 my-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                      <div className="text-sm text-gray-700 mb-2">Some pages are already synced. What do you want to sync?</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setAskScope(false); syncPages(nodes); }} className="flex-1 bg-[#473AE0] text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-[#3a2fc0]">All pages ({nodes.length})</button>
                        <button onClick={() => { setAskScope(false); syncPages(unsynced); }} className="flex-1 bg-white border border-gray-200 text-sm font-medium px-3 py-2 rounded-lg text-gray-700 hover:border-[#473AE0] hover:text-[#473AE0]">Only new ({unsynced.length})</button>
                        <button onClick={() => setAskScope(false)} className="text-xs text-gray-400 hover:text-gray-600 px-1">Cancel</button>
                      </div>
                    </div>
                  );
                })()}
                {syncErr && <div className="px-6 py-2 text-xs text-red-500">{syncErr}</div>}
                <div className="flex-1 overflow-y-auto px-3 py-2">
                  {nodes.length === 0 ? (
                    <div className="text-center text-sm text-gray-400 py-8">No pages to sync.</div>
                  ) : nodes.map((n) => {
                    const busy = !!syncBusy[n.id];
                    const synced = !!n.acTaskId;
                    return (
                      <div key={n.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{n.label || 'Untitled page'}</div>
                          <div className="text-[11px] text-gray-400">{(n.blocks || []).length} section{(n.blocks || []).length === 1 ? '' : 's'}{synced ? ` · Task #${n.acTaskNumber || n.acTaskId}` : ''}</div>
                        </div>
                        {synced && !busy && <Check size={15} className="text-green-500 shrink-0" />}
                        <button onClick={() => syncPage(n)} disabled={busy} title={synced ? 'Re-sync' : 'Sync'}
                                className="shrink-0 flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 hover:bg-white hover:border-[#473AE0] hover:text-[#473AE0] disabled:opacity-50">
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          {synced ? 'Re-sync' : 'Sync'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------- Files modal ---------- */}
      {filesOpen && (
        <FilesModal files={projectFiles} readOnly={readOnly} onSave={setProjectFiles}
          onSaved={() => { setFilesPulse(true); setTimeout(() => setFilesPulse(false), 1400); }}
          onClose={() => setFilesOpen(false)} />
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
            onAttachments={(a) => setBlockAttachments(n.id, b.id, a)}
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
