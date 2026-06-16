import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Copy, Link2, LayoutGrid, ArrowLeft,
  Download, Upload, Save, MousePointer2, Sparkles, StickyNote, Share2,
  MessageSquare, DollarSign, Tag, Search, Menu, Play, X
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Color system                                                       */
/* ------------------------------------------------------------------ */
const COLORS = {
  blue:   { key: 'blue',   name: 'Blue',   solid: '#2D6BFF', soft: '#3B7BFF' },
  topaz:  { key: 'topaz',  name: 'Topaz',  solid: '#10B981', soft: '#13C08A' },
  purple: { key: 'purple', name: 'Purple', solid: '#8B5CF6', soft: '#9B6BFA' },
};
const COLOR_KEYS = ['blue', 'topaz', 'purple'];

/* ------------------------------------------------------------------ */
/*  Geometry constants                                                 */
/* ------------------------------------------------------------------ */
const CARD_W = 224;
const HEADER_H = 46;
const BLOCK_H = 50;
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
  const [projectName, setProjectName] = useState(project?.name || 'Untitled project');
  const [exportOpen, setExportOpen] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);

  const [view, setView] = useState({ zoom: 0.9, x: 60, y: 90 });
  const panRef = useRef(null);
  const containerRef = useRef(null);
  const blockDragRef = useRef(null);
  const firstSave = useRef(true);

  // persist node changes back to the project (skip the very first render)
  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return; }
    onChange?.({ nodes });
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const node = { id: uid(), label: 'Page', parentId: null, group: 'main', color: 'blue', blocks: [] };
    setNodes((ns) => [...ns, node]);
    setSelectedId(node.id);
  };
  const addSection = () => {
    const node = { id: uid(), label: 'New Page', parentId: null, group: 'section', color: 'blue', blocks: [] };
    setNodes((ns) => [...ns, node]);
    setSelectedId(node.id);
  };
  const duplicateNode = (id) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    const copy = { ...n, id: uid(), blocks: n.blocks.map((b) => ({ ...b, id: uid() })) };
    setNodes((ns) => [...ns, copy]);
    setSelectedId(copy.id);
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
    setColorOpenId(null);
  };
  const setLink = (id, link) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, link } : n)));
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
  const addBlock = (id) => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === id
          ? { ...n, blocks: [...n.blocks, { id: uid(), name: 'New block', color: n.color }] }
          : n
      )
    );
  };
  const deleteBlock = (nodeId, blockId) => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId ? { ...n, blocks: n.blocks.filter((b) => b.id !== blockId) } : n
      )
    );
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
    setSelectedId(null);
    setColorOpenId(null);
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
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
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

  /* -------------------- connectors -------------------- */
  const connectors = [];
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
      connectors.push({ key: p.id + c.id, d: `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}` });
    });
  });

  const svgW = layout.width + MARGIN * 2 + CARD_W;
  const svgH = layout.bottom + MARGIN * 2 + 80;

  /* ================================================================ */
  return (
    <div className="fixed inset-0 bg-[#FBFCFE] overflow-hidden select-none"
         style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* ---------- Top bar ---------- */}
      <div data-ui className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-30 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onBack}
            title="Back to dashboard"
            className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-50"
          ><ArrowLeft size={17} /></button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-lg">🐙</div>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={() => onChange?.({ name: projectName.trim() || 'Untitled project' })}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            className="text-[15px] font-semibold text-[#2D6BFF] bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-blue-200 rounded px-1 w-48"
          />
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button className="flex items-center gap-1 bg-[#2D6BFF] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-blue-600">
            Share <Play size={13} className="ml-1" fill="white" />
          </button>
          <button className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Search size={16} /></button>
          <button className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Menu size={16} /></button>
          <div className="w-9 h-9 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-bold">PU</div>
        </div>
      </div>

      {/* ---------- Canvas ---------- */}
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseDown={onBgMouseDown}
        onWheel={onWheel}
        style={{ backgroundImage: 'radial-gradient(#E5EAF2 1px, transparent 1px)', backgroundSize: '24px 24px' }}
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
            {connectors.map((c) => (
              <path key={c.key} d={c.d} fill="none" stroke="#2D6BFF" strokeWidth="2" />
            ))}
          </svg>

          {/* nodes */}
          {nodes.map((n) => {
            const p = layout.pos[n.id];
            if (!p) return null;
            const col = COLORS[n.color] || COLORS.blue;
            const isSel = selectedId === n.id;
            return (
              <div key={n.id} data-node
                   style={{ position: 'absolute', left: p.x + MARGIN, top: p.y + MARGIN, width: CARD_W, height: p.h }}>

                {/* contextual toolbar */}
                {isSel && (
                  <Toolbar
                    zoom={view.zoom}
                    node={n}
                    colorOpen={colorOpenId === n.id}
                    linkOpen={linkOpenId === n.id}
                    onAddBlock={() => addBlock(n.id)}
                    onColor={() => { setColorOpenId(colorOpenId === n.id ? null : n.id); setLinkOpenId(null); }}
                    onPickColor={(c) => setColor(n.id, c)}
                    onLink={() => { setLinkOpenId(linkOpenId === n.id ? null : n.id); setColorOpenId(null); }}
                    onSetLink={(v) => setLink(n.id, v)}
                    onDuplicate={() => duplicateNode(n.id)}
                    onDelete={() => deleteNode(n.id)}
                  />
                )}

                {/* card */}
                <div
                  draggable={editingTitleId !== n.id && !editingBlock}
                  onDragStart={(e) => { e.stopPropagation(); setDragId(n.id); }}
                  onDragEnd={() => { setDragId(null); setDropTargetId(null); }}
                  onDragOver={(e) => { if (dragId && dragId !== n.id) { e.preventDefault(); setDropTargetId(n.id); } }}
                  onDragLeave={() => { if (dropTargetId === n.id) setDropTargetId(null); }}
                  onDrop={(e) => { if (dragId && dragId !== n.id) { e.preventDefault(); e.stopPropagation(); moveNode(dragId, n.id); } setDragId(null); setDropTargetId(null); }}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(n.id); }}
                  className="w-full h-full rounded-xl bg-white flex flex-col overflow-hidden transition-shadow"
                  style={{
                    border: `2px solid ${dropTargetId === n.id ? '#10B981' : col.solid}`,
                    opacity: dragId === n.id ? 0.4 : 1,
                    boxShadow: dropTargetId === n.id
                      ? '0 0 0 3px #10B98155, 0 8px 24px rgba(0,0,0,0.12)'
                      : isSel ? `0 0 0 3px ${col.solid}33, 0 8px 24px rgba(0,0,0,0.08)` : '0 4px 14px rgba(0,0,0,0.05)',
                  }}
                >
                  {/* header */}
                  <div className="flex items-center px-3 shrink-0" style={{ height: HEADER_H }}>
                    <div className="flex gap-1 absolute" >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: col.solid, opacity: .5 }} />
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: col.solid, opacity: .5 }} />
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: col.solid, opacity: .5 }} />
                    </div>
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
                    <div className="px-2.5 pb-2.5 flex flex-col" style={{ gap: BLOCK_GAP }}>
                      {n.blocks.map((b) => {
                        const bc = COLORS[b.color] || col;
                        return (
                          <div key={b.id} data-ui
                               draggable={!(editingBlock && editingBlock.blockId === b.id)}
                               onDragStart={(e) => { e.stopPropagation(); blockDragRef.current = { nodeId: n.id, blockId: b.id }; }}
                               onDragOver={(e) => { if (blockDragRef.current) { e.preventDefault(); e.stopPropagation(); } }}
                               onDrop={(e) => { e.stopPropagation(); const d = blockDragRef.current; if (d && d.nodeId === n.id) moveBlock(n.id, d.blockId, b.id); blockDragRef.current = null; }}
                               onDragEnd={() => { blockDragRef.current = null; }}
                               className="relative group rounded-md flex flex-col justify-center px-2 text-white cursor-move"
                               style={{ height: BLOCK_H, background: bc.soft }}>
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
                              <div className="flex items-center justify-between"
                                   onDoubleClick={(e) => { e.stopPropagation(); setEditingBlock({ nodeId: n.id, blockId: b.id }); setDraft(b.name); }}>
                                <span className="text-[11px] font-semibold leading-none">{b.name}</span>
                                <div className="flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-white/70" />
                                  <span className="w-1 h-1 rounded-full bg-white/70" />
                                </div>
                              </div>
                            )}
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
                    <div className="flex-1 flex items-center justify-center px-2.5 pb-2.5">
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
                      className="absolute top-1/2 -translate-y-1/2 -left-3.5 w-7 h-7 rounded-full bg-[#2D6BFF] text-white flex items-center justify-center shadow-md hover:bg-blue-600 z-10"
                      title="Add page on the left"
                    ><Plus size={15} /></button>
                    <button
                      data-ui
                      onClick={(e) => { e.stopPropagation(); addSibling(n, 'right'); }}
                      className="absolute top-1/2 -translate-y-1/2 -right-3.5 w-7 h-7 rounded-full bg-[#2D6BFF] text-white flex items-center justify-center shadow-md hover:bg-blue-600 z-10"
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
                      className={`w-7 h-7 rounded-full bg-[#2D6BFF] text-white flex items-center justify-center shadow-md hover:bg-blue-600 transition-opacity ${isSel ? 'opacity-100' : 'opacity-0'}`}
                      title="Add sub-page"
                    ><Plus size={15} /></button>
                  </div>
                )}
              </div>
            );
          })}

          {/* color legend */}
          <div className="absolute flex items-center gap-8"
               style={{ left: layout.rootCx + MARGIN - 90, top: layout.bottom + MARGIN + 20 }}>
            {COLOR_KEYS.map((k) => (
              <div key={k} className="flex flex-col items-center gap-1">
                <span className="w-3.5 h-3.5 rounded-full" style={{ background: COLORS[k].solid }} />
                <span className="text-[11px] text-gray-500">{COLORS[k].name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Bottom toolbar ---------- */}
      <div data-ui className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white rounded-2xl shadow-lg border border-gray-100 px-2 py-1.5">
        <ToolBtn active title="Select"><MousePointer2 size={18} /></ToolBtn>
        <ToolBtn onClick={addRoot} title="Add page"><Plus size={18} /></ToolBtn>
        <ToolBtn onClick={addSection} title="Add section page"><LayoutGrid size={18} /></ToolBtn>
        <ToolBtn title="AI"><Sparkles size={18} /></ToolBtn>
        <ToolBtn title="Note"><StickyNote size={18} /></ToolBtn>
        <ToolBtn title="Link"><Link2 size={18} /></ToolBtn>
        <ToolBtn title="Share"><Share2 size={18} /></ToolBtn>
        <ToolBtn title="Comment"><MessageSquare size={18} /></ToolBtn>
        <ToolBtn title="Price"><DollarSign size={18} /></ToolBtn>
        <ToolBtn title="Tag"><Tag size={18} /></ToolBtn>
        <div className="relative">
          <ToolBtn onClick={() => setExportOpen((v) => !v)} title="Import / Export"><Download size={18} /></ToolBtn>
          {exportOpen && (
            <div className="absolute bottom-12 right-0 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5 w-52">
              <ExportMenu nodes={nodes} childrenOf={childrenOf} onClose={() => setExportOpen(false)} setNodes={setNodes} />
            </div>
          )}
        </div>
      </div>

      {/* ---------- Zoom control ---------- */}
      <div data-ui className="absolute bottom-5 right-5 z-30 flex items-center gap-1 bg-white rounded-full shadow-lg border border-gray-100 px-1.5 py-1">
        <button onClick={() => zoomBy(1 / 1.15)} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-600 flex items-center justify-center text-lg">−</button>
        <button onClick={fitView} className="px-2 text-sm text-gray-600 tabular-nums min-w-[52px]">{Math.round(view.zoom * 100)}%</button>
        <button onClick={() => zoomBy(1.15)} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-600 flex items-center justify-center text-lg">+</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Contextual toolbar (floats above a selected card)                  */
/* ------------------------------------------------------------------ */
function Toolbar({ zoom, node, colorOpen, linkOpen, onAddBlock, onColor, onPickColor, onLink, onSetLink, onDuplicate, onDelete }) {
  return (
    <div data-ui
         className="absolute left-1/2 z-20"
         style={{ top: -12, transform: `translate(-50%, -100%) scale(${1 / zoom})`, transformOrigin: 'bottom center' }}
         onClick={(e) => e.stopPropagation()}>
      <div className="relative flex items-center gap-0.5 bg-white rounded-xl shadow-xl border border-gray-100 px-1.5 py-1.5">
        <TBtn onClick={onAddBlock} title="Add section"><Plus size={16} /></TBtn>
        <button onClick={onColor} title="Color" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100">
          <span className="w-4 h-4 rounded-full" style={{ background: COLORS[node.color].solid }} />
        </button>
        <button onClick={onLink} title="Link to this page"
                className={`w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 ${node.link ? 'text-[#2D6BFF]' : 'text-gray-600'}`}>
          <Link2 size={16} />
        </button>
        <div className="w-px h-5 bg-gray-200 mx-0.5" />
        <TBtn onClick={onDuplicate} title="Duplicate"><Copy size={16} /></TBtn>
        <button onClick={onDelete} title="Delete" className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>

        {colorOpen && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 flex gap-2 bg-white rounded-xl shadow-xl border border-gray-100 px-3 py-2">
            {COLOR_KEYS.map((k) => (
              <button key={k} onClick={() => onPickColor(k)} title={COLORS[k].name}
                      className="w-5 h-5 rounded-full ring-offset-2 hover:ring-2 ring-gray-300"
                      style={{ background: COLORS[k].solid }} />
            ))}
          </div>
        )}

        {linkOpen && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-100 px-2 py-2 w-56">
            <div className="text-[10px] font-semibold text-gray-400 px-1 pb-1 uppercase tracking-wide">Link to this page</div>
            <input
              autoFocus
              value={node.link || ''}
              onChange={(e) => onSetLink(e.target.value)}
              placeholder="Enter link URL"
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TBtn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-[#2D6BFF]">
      {children}
    </button>
  );
}

function ToolBtn({ children, onClick, title, active }) {
  return (
    <button onClick={onClick} title={title}
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-blue-50 text-[#2D6BFF]' : 'text-gray-500 hover:bg-gray-100'}`}>
      {children}
    </button>
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
