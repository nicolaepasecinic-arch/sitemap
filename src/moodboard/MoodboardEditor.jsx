import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, StickyNote, MessageSquare, Type, Image as ImageIcon, Plus, Minus, Maximize,
  Share2, X, Trash2, Check, Loader2, Send, Paperclip, CircleDot, Search, SlidersHorizontal, AtSign,
  Square, Circle, Triangle, Shapes, BringToFront, SendToBack,
} from 'lucide-react';
import BrandStar from '../components/Brand';
import InvitePanel from '../components/InvitePanel';
import {
  getApiBase, apiGetMoodboard, apiPatchMoodboard, apiUploadMoodboardImage,
  apiListMoodboardMembers, apiAddMoodboardMember, apiRemoveMoodboardMember, apiRemoveMoodboardInvite,
} from '../api';

const uid = () => Math.random().toString(36).slice(2, 10);
const NOTE_COLORS = ['#FEF3C7', '#DBEAFE', '#DCFCE7', '#FCE7F3', '#EDE9FE', '#FFE4E6'];
const TEXT_LEVELS = {
  h1: { size: 40, weight: 800, label: 'H1' },
  h2: { size: 30, weight: 700, label: 'H2' },
  h3: { size: 24, weight: 700, label: 'H3' },
  h4: { size: 20, weight: 600, label: 'H4' },
  h5: { size: 17, weight: 600, label: 'H5' },
  h6: { size: 15, weight: 600, label: 'H6' },
  p: { size: 14, weight: 400, label: 'P' },
};
const SHAPE_FILLS = ['#DBEAFE', '#DCFCE7', '#FEF3C7', '#FCE7F3', '#EDE9FE', '#111827'];
const SHAPE_TYPES = [['rect', Square, 'Rectangle'], ['circle', Circle, 'Circle'], ['triangle', Triangle, 'Triangle'], ['line', Minus, 'Line']];
const PRIO = {
  none: { label: 'No priority', color: '#6b7280', dot: '#cbd5e1' },
  low: { label: 'Low', color: '#0ea5e9', dot: '#0ea5e9' },
  medium: { label: 'Medium', color: '#f59e0b', dot: '#f59e0b' },
  high: { label: 'High', color: '#ef4444', dot: '#ef4444' },
};
const PRIO_ORDER = ['none', 'low', 'medium', 'high'];
const mbApi = {
  listMembers: apiListMoodboardMembers, addMember: apiAddMoodboardMember,
  removeMember: apiRemoveMoodboardMember, removeInvite: apiRemoveMoodboardInvite,
};
const imgSrc = (src) => (src && src.startsWith('/') ? `${getApiBase()}${src}` : src);
const initialsOf = (n) => (n || 'U').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const timeAgo = (ts) => {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'now'; const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`; const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`; return new Date(ts).toLocaleDateString();
};

export default function MoodboardEditor({ id, user, onBack }) {
  const [name, setName] = useState('Untitled moodboard');
  const [items, setItems] = useState([]);
  const [view, setView] = useState({ x: 120, y: 120, zoom: 1 });
  const [role, setRole] = useState('owner');
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('saved');
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [shapeMenu, setShapeMenu] = useState(false);

  // comments
  const [commentMode, setCommentMode] = useState(false);
  const [openCommentId, setOpenCommentId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('active'); // active | resolved
  const [panelPriority, setPanelPriority] = useState('all');
  const [panelMentionsMe, setPanelMentionsMe] = useState(false);
  const [panelSearch, setPanelSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [composer, setComposer] = useState({ text: '', files: [], mentions: [], priority: 'none' });
  const [reply, setReply] = useState({ text: '', files: [], mentions: [] });
  const [mention, setMention] = useState(null); // { for:'composer'|'reply', query }

  const containerRef = useRef(null);
  const saveTimer = useRef(null);
  const loaded = useRef(false);
  const movedRef = useRef(false);
  const readOnly = role === 'viewer';

  const me = user || {};
  const comments = items.filter((it) => it.type === 'comment').sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const numberOf = (cid) => comments.findIndex((c) => c.id === cid) + 1;

  /* ---------- load ---------- */
  useEffect(() => {
    let alive = true;
    apiGetMoodboard(id).then((b) => {
      if (!alive) return;
      setName(b.name || 'Untitled moodboard');
      setItems(Array.isArray(b.items) ? b.items : []);
      if (b.settings && b.settings.view) setView(b.settings.view);
      setRole(b.role || 'owner');
      setTimeout(() => { loaded.current = true; }, 0);
    }).catch(() => setToast('Could not open this moodboard.'));
    apiListMoodboardMembers(id).then(setMembers).catch(() => {});
    return () => { alive = false; };
  }, [id]);

  /* ---------- autosave ---------- */
  const persist = useCallback((nextItems, nextName, nextView) => {
    if (readOnly) return;
    setStatus('unsaved');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setStatus('saving');
      try { await apiPatchMoodboard(id, { items: nextItems, name: nextName, settings: { view: nextView } }); setStatus('saved'); }
      catch (e) { setStatus('unsaved'); }
    }, 900);
  }, [id, readOnly]);
  useEffect(() => { if (loaded.current) persist(items, name, view); }, [items, name, view, persist]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t); }, [toast]);

  /* ---------- helpers ---------- */
  const center = () => {
    const r = containerRef.current?.getBoundingClientRect();
    const cw = r ? r.width : 900, ch = r ? r.height : 600;
    return { x: (cw / 2 - view.x) / view.zoom, y: (ch / 2 - view.y) / view.zoom };
  };
  const addItem = (it) => { setItems((s) => [...s, it]); setSelectedId(it.id); };
  const updateItem = (iid, patch) => setItems((s) => s.map((i) => (i.id === iid ? { ...i, ...patch } : i)));
  const deleteItem = (iid) => { setItems((s) => s.filter((i) => i.id !== iid)); setSelectedId(null); setEditingId(null); };

  const addNote = () => { const c = center(); addItem({ id: uid(), type: 'note', x: c.x - 90, y: c.y - 70, w: 180, h: 140, color: NOTE_COLORS[0], text: '' }); };
  const addText = () => { const c = center(); const it = { id: uid(), type: 'text', x: c.x - 140, y: c.y - 20, w: 300, h: 44, text: '', level: 'h2' }; addItem(it); setEditingId(it.id); };
  const addShape = (shape) => { const c = center(); addItem({ id: uid(), type: 'shape', shape, x: c.x - 70, y: c.y - 50, w: 140, h: shape === 'line' ? 60 : 110, fill: shape === 'line' ? 'none' : '#DBEAFE', border: shape === 'line', borderColor: '#334155', borderWidth: 2 }); };
  // z-order: items render in array order (later = on top). Comments are drawn separately, always above.
  const bringToFront = (iid) => setItems((s) => { const it = s.find((x) => x.id === iid); return it ? [...s.filter((x) => x.id !== iid), it] : s; });
  const sendToBack = (iid) => setItems((s) => { const it = s.find((x) => x.id === iid); return it ? [it, ...s.filter((x) => x.id !== iid)] : s; });

  /* ---------- comment ops ---------- */
  const addCommentAt = (x, y) => {
    const c = { id: uid(), type: 'comment', x, y, text: '', author: me.name || 'Me', authorId: me.id || null, ts: Date.now(), priority: 'none', resolved: false, replies: [], mentions: [], attachments: [] };
    setItems((s) => [...s, c]);
    setOpenCommentId(c.id); setPanelOpen(true);
    setComposer({ text: '', files: [], mentions: [], priority: 'none' });
  };
  const updateComment = (cid, patch) => setItems((s) => s.map((i) => (i.id === cid ? { ...i, ...patch } : i)));
  const deleteComment = (cid) => { setItems((s) => s.filter((i) => i.id !== cid)); if (openCommentId === cid) setOpenCommentId(null); };
  const toggleResolved = (c) => updateComment(c.id, { resolved: !c.resolved });
  const cyclePriority = (c) => updateComment(c.id, { priority: PRIO_ORDER[(PRIO_ORDER.indexOf(c.priority || 'none') + 1) % 4] });

  const saveComposer = (c) => {
    const text = composer.text.trim();
    if (!text && !composer.files.length) return;
    updateComment(c.id, { text, attachments: composer.files, mentions: composer.mentions, priority: composer.priority });
    setComposer({ text: '', files: [], mentions: [], priority: 'none' });
  };
  const sendReply = (c) => {
    const text = reply.text.trim();
    if (!text && !reply.files.length) return;
    const r = { id: uid(), author: me.name || 'Me', authorId: me.id || null, ts: Date.now(), text, attachments: reply.files, mentions: reply.mentions };
    updateComment(c.id, { replies: [...(c.replies || []), r] });
    setReply({ text: '', files: [], mentions: [] });
  };
  const deleteReply = (c, rid) => updateComment(c.id, { replies: (c.replies || []).filter((r) => r.id !== rid) });

  /* ---------- image upload (items + comment attachments) ---------- */
  const uploadToServer = async (file) => {
    const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
    const out = await apiUploadMoodboardImage(id, dataUrl);
    return { dataUrl, out };
  };
  const uploadImage = useCallback(async (file, at) => {
    if (readOnly || !file) return;
    const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
    const dim = await new Promise((res) => { const im = new window.Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ w: 320, h: 240 }); im.src = dataUrl; });
    setToast('Uploading image…');
    try {
      const saved = await apiUploadMoodboardImage(id, dataUrl);
      const maxW = 360; const scale = dim.w > maxW ? maxW / dim.w : 1;
      const w = Math.round(dim.w * scale), h = Math.round(dim.h * scale);
      const p = at || center();
      addItem({ id: uid(), type: 'image', x: p.x - w / 2, y: p.y - h / 2, w, h, src: saved.url });
      setToast('');
    } catch (e) { setToast(e.message || 'Could not upload image.'); }
  }, [id, readOnly, view]);

  const attachFile = async (file, target) => { // target: 'composer' | 'reply'
    if (!file) return;
    try {
      const { out } = await uploadToServer(file);
      const f = { id: uid(), url: out.url, name: file.name, type: file.type };
      if (target === 'reply') setReply((r) => ({ ...r, files: [...r.files, f] }));
      else setComposer((c) => ({ ...c, files: [...c.files, f] }));
    } catch (e) { setToast(e.message || 'Could not attach image.'); }
  };

  // paste image: onto canvas (no open thread) or into the open composer
  useEffect(() => {
    const onPaste = (e) => {
      if (readOnly || editingId) return;
      const its = e.clipboardData?.items || [];
      for (const it of its) {
        if (it.type && it.type.startsWith('image/')) {
          const file = it.getAsFile();
          if (file) { e.preventDefault(); if (openCommentId) attachFile(file, 'composer'); else uploadImage(file); return; }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [uploadImage, readOnly, editingId, openCommentId]);

  /* ---------- @mentions ---------- */
  const mentionPeople = members.filter((m) => m.userId).map((m) => ({ id: m.userId, name: m.name || m.email }));
  const onComposerText = (which, value) => {
    const m = value.match(/@([\w]*)$/);
    setMention(m ? { for: which, query: m[1] } : null);
    if (which === 'reply') setReply((r) => ({ ...r, text: value })); else setComposer((c) => ({ ...c, text: value }));
  };
  const pickMention = (p) => {
    const repl = (v) => v.replace(/@([\w]*)$/, `@${p.name} `);
    if (mention?.for === 'reply') setReply((r) => ({ ...r, text: repl(r.text), mentions: [...new Set([...r.mentions, p.id])] }));
    else setComposer((c) => ({ ...c, text: repl(c.text), mentions: [...new Set([...c.mentions, p.id])] }));
    setMention(null);
  };
  const mentionList = mention ? mentionPeople.filter((p) => p.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6) : [];

  /* ---------- pan / zoom ---------- */
  const onBgMouseDown = (e) => {
    if (e.button !== 0) return;
    movedRef.current = false;
    setSelectedId(null);
    const sx = e.clientX, sy = e.clientY, ox = view.x, oy = view.y;
    const move = (ev) => { if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) movedRef.current = true; setView((v) => ({ ...v, x: ox + (ev.clientX - sx), y: oy + (ev.clientY - sy) })); };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  const onBgClick = (e) => {
    if (movedRef.current) return;
    setShapeMenu(false);
    if (commentMode && !readOnly) {
      const r = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - r.left - view.x) / view.zoom;
      const y = (e.clientY - r.top - view.y) / view.zoom;
      addCommentAt(x, y);
      setCommentMode(false);
      return;
    }
    setEditingId(null); setOpenCommentId(null);
  };
  const onWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      const r = containerRef.current.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      setView((v) => { const nz = Math.min(2, Math.max(0.3, v.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); const k = nz / v.zoom; return { zoom: nz, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k }; });
    } else { setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })); }
  };
  const zoomBy = (f) => setView((v) => ({ ...v, zoom: Math.min(2, Math.max(0.3, v.zoom * f)) }));
  const resetView = () => setView({ x: 120, y: 120, zoom: 1 });
  const focusComment = (c) => {
    const r = containerRef.current?.getBoundingClientRect();
    const cw = r ? r.width : 900, ch = r ? r.height : 600;
    setView((v) => ({ ...v, x: cw / 2 - c.x * v.zoom, y: ch / 2 - c.y * v.zoom }));
    setOpenCommentId(c.id);
  };

  /* ---------- drag / resize ---------- */
  const startItemDrag = (e, it) => {
    if (readOnly || editingId === it.id) return;
    e.stopPropagation();
    setSelectedId(it.id);
    const sx = e.clientX, sy = e.clientY, ox = it.x, oy = it.y, z = view.zoom;
    const move = (ev) => updateItem(it.id, { x: ox + (ev.clientX - sx) / z, y: oy + (ev.clientY - sy) / z });
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  const startResize = (e, it) => {
    if (readOnly) return;
    e.stopPropagation(); e.preventDefault();
    const sx = e.clientX, sy = e.clientY, ow = it.w, oh = it.h, z = view.zoom;
    const move = (ev) => updateItem(it.id, { w: Math.max(60, ow + (ev.clientX - sx) / z), h: Math.max(40, oh + (ev.clientY - sy) / z) });
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  const startPinDrag = (e, c) => {
    if (readOnly) return;
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, ox = c.x, oy = c.y, z = view.zoom;
    let moved = false;
    const move = (ev) => { if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) moved = true; updateComment(c.id, { x: ox + (ev.clientX - sx) / z, y: oy + (ev.clientY - sy) / z }); };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); if (!moved) setOpenCommentId(c.id); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (readOnly || editingId || openCommentId) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); deleteItem(selectedId); }
      if (e.key === 'Escape') { setCommentMode(false); setSelectedId(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, editingId, openCommentId, readOnly]);

  const statusEl = status === 'saving'
    ? <span className="flex items-center gap-1.5 text-gray-400"><Loader2 size={13} className="animate-spin" /> Saving…</span>
    : status === 'unsaved' ? <span className="text-amber-500">Unsaved</span>
      : <span className="flex items-center gap-1.5 text-green-500"><Check size={13} /> Saved</span>;

  const myId = me.id;
  const matchesFilter = (c) => (panelPriority === 'all' || (c.priority || 'none') === panelPriority)
    && (!panelMentionsMe || (c.mentions || []).includes(myId) || (c.replies || []).some((r) => (r.mentions || []).includes(myId)))
    && (() => { const q = panelSearch.trim().toLowerCase(); return !q || (c.text || '').toLowerCase().includes(q) || (c.author || '').toLowerCase().includes(q); })();
  const filtered = comments.filter(matchesFilter);
  const activeCount = filtered.filter((c) => !c.resolved).length;
  const resolvedCount = filtered.filter((c) => c.resolved).length;
  const panelList = filtered.filter((c) => (panelTab === 'resolved' ? c.resolved : !c.resolved));
  const filterActive = panelPriority !== 'all' || panelMentionsMe;
  const pinColor = (c) => (c.resolved ? '#22c55e' : (c.priority && c.priority !== 'none' ? PRIO[c.priority].dot : '#473AE0'));

  return (
    <div className="fixed inset-0 flex flex-col bg-[#FBFCFE]">
      {/* top bar */}
      <div className="h-14 shrink-0 bg-white border-b border-gray-100 flex items-center gap-2 px-3 sm:px-4">
        <button onClick={onBack} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center shrink-0" title="Back"><ArrowLeft size={17} /></button>
        <BrandStar size={22} />
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly}
               className="font-semibold text-gray-800 text-sm bg-transparent outline-none border-b border-transparent focus:border-indigo-300 px-1 min-w-0 max-w-[140px] sm:max-w-[220px] truncate" />
        <div className="text-xs shrink-0">{readOnly ? <span className="text-gray-400">View only</span> : statusEl}</div>
        <div className="flex-1" />
        <button onClick={() => setPanelOpen((v) => !v)} title="Comments"
                className={`relative flex items-center gap-1.5 text-sm font-medium rounded-full px-3 py-1.5 shrink-0 ${panelOpen ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-600 hover:bg-gray-100'}`}>
          <MessageSquare size={16} /> <span className="hidden sm:inline">Comments</span>
          {comments.filter((c) => !c.resolved).length > 0 && <span className="min-w-[17px] h-[17px] px-1 rounded-full bg-[#473AE0] text-white text-[10px] font-bold flex items-center justify-center">{comments.filter((c) => !c.resolved).length}</span>}
        </button>
        {role === 'owner' && (
          <button onClick={() => setShareOpen(true)} className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#473AE0] hover:bg-[#3a2fc0] rounded-full px-4 py-1.5 shrink-0"><Share2 size={15} /> <span className="hidden sm:inline">Share</span></button>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* canvas */}
        <div ref={containerRef}
             className={`flex-1 relative min-h-0 overflow-hidden ${commentMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
             onMouseDown={onBgMouseDown} onClick={onBgClick} onWheel={onWheel}
             onDragOver={(e) => { e.preventDefault(); }}
             onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f && f.type.startsWith('image/')) { const r = containerRef.current.getBoundingClientRect(); uploadImage(f, { x: (e.clientX - r.left - view.x) / view.zoom, y: (e.clientY - r.top - view.y) / view.zoom }); } }}
             style={{ backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '24px 24px' }}>

          <div style={{ position: 'absolute', transformOrigin: '0 0', transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
            {items.map((it) => {
              if (it.type === 'comment') return null; // pins rendered separately (unscaled)
              const sel = selectedId === it.id;
              const selRing = sel ? '0 0 0 2px #473AE0' : undefined;
              if (it.type === 'image') {
                return (
                  <div key={it.id} className="absolute group" style={{ left: it.x, top: it.y, width: it.w, height: it.h, boxShadow: selRing }}
                       onMouseDown={(e) => startItemDrag(e, it)} onClick={(e) => { e.stopPropagation(); setSelectedId(it.id); }}>
                    <img src={imgSrc(it.src)} alt="" draggable={false} className="w-full h-full object-cover rounded-lg shadow-sm select-none pointer-events-none" />
                    {sel && !readOnly && (
                      <div className="absolute -top-10 right-0 flex items-center gap-0.5 bg-white rounded-full shadow-md border border-gray-100 px-1 py-1 z-10" onMouseDown={(e) => e.stopPropagation()}>
                        <ZDel onFront={() => bringToFront(it.id)} onBack={() => sendToBack(it.id)} onDelete={() => deleteItem(it.id)} />
                      </div>
                    )}
                    {sel && !readOnly && <ItemControls onResize={(e) => startResize(e, it)} />}
                  </div>
                );
              }
              if (it.type === 'text') {
                const lv = TEXT_LEVELS[it.level] || { size: it.size || 20, weight: 600 };
                return (
                  <div key={it.id} className="absolute group" style={{ left: it.x, top: it.y, width: it.w, minHeight: it.h, boxShadow: selRing, borderRadius: 8 }}
                       onMouseDown={(e) => startItemDrag(e, it)}
                       onClick={(e) => { e.stopPropagation(); if (!readOnly && selectedId === it.id) setEditingId(it.id); else setSelectedId(it.id); }}>
                    {sel && !readOnly && (
                      <div className="absolute -top-10 left-0 flex items-center gap-0.5 bg-white rounded-full shadow-md border border-gray-100 px-1 py-1 z-10" onMouseDown={(e) => e.stopPropagation()}>
                        {Object.keys(TEXT_LEVELS).map((k) => (
                          <button key={k} onClick={(e) => { e.stopPropagation(); updateItem(it.id, { level: k, size: undefined }); }}
                                  className={`px-1.5 h-6 rounded-md text-[11px] font-semibold ${(it.level || 'h2') === k ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'}`}>{TEXT_LEVELS[k].label}</button>
                        ))}
                        <div className="w-px h-5 bg-gray-200 mx-0.5" />
                        <ZDel onFront={() => bringToFront(it.id)} onBack={() => sendToBack(it.id)} onDelete={() => deleteItem(it.id)} />
                      </div>
                    )}
                    {editingId === it.id ? (
                      <textarea autoFocus value={it.text} onMouseDown={(e) => e.stopPropagation()} onChange={(e) => updateItem(it.id, { text: e.target.value })}
                                onBlur={() => setEditingId(null)} className="w-full bg-transparent outline-none resize-none text-gray-800 leading-tight" style={{ fontSize: lv.size, fontWeight: lv.weight }} rows={2} placeholder="Type here…" />
                    ) : (
                      <div className="text-gray-800 whitespace-pre-wrap px-1 py-0.5 leading-tight" style={{ fontSize: lv.size, fontWeight: lv.weight }} onDoubleClick={() => !readOnly && setEditingId(it.id)}>{it.text || <span className="text-gray-300">Type here…</span>}</div>
                    )}
                    {sel && !readOnly && <ItemControls onDelete={() => deleteItem(it.id)} onResize={(e) => startResize(e, it)} onFront={() => bringToFront(it.id)} onBack={() => sendToBack(it.id)} />}
                  </div>
                );
              }
              if (it.type === 'shape') {
                const sw = it.border ? (it.borderWidth || 2) : 0;
                const stroke = it.border ? (it.borderColor || '#334155') : 'none';
                const fill = it.fill || 'none';
                return (
                  <div key={it.id} className="absolute group" style={{ left: it.x, top: it.y, width: it.w, height: it.h, boxShadow: selRing, borderRadius: it.shape === 'circle' ? 9999 : 6 }}
                       onMouseDown={(e) => startItemDrag(e, it)} onClick={(e) => { e.stopPropagation(); setSelectedId(it.id); }}>
                    <svg width={it.w} height={it.h} className="block pointer-events-none">
                      {it.shape === 'rect' && <rect x={sw / 2} y={sw / 2} width={Math.max(0, it.w - sw)} height={Math.max(0, it.h - sw)} rx={8} fill={fill} stroke={stroke} strokeWidth={sw} />}
                      {it.shape === 'circle' && <ellipse cx={it.w / 2} cy={it.h / 2} rx={Math.max(0, it.w / 2 - sw / 2)} ry={Math.max(0, it.h / 2 - sw / 2)} fill={fill} stroke={stroke} strokeWidth={sw} />}
                      {it.shape === 'triangle' && <polygon points={`${it.w / 2},${sw / 2} ${it.w - sw / 2},${it.h - sw / 2} ${sw / 2},${it.h - sw / 2}`} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />}
                      {it.shape === 'line' && <line x1="2" y1={it.h / 2} x2={it.w - 2} y2={it.h / 2} stroke={it.border ? (it.borderColor || '#334155') : (it.fill !== 'none' ? it.fill : '#334155')} strokeWidth={Math.max(2, it.borderWidth || 3)} strokeLinecap="round" />}
                    </svg>
                    {sel && !readOnly && (
                      <div className="absolute -top-10 left-0 flex items-center gap-0.5 bg-white rounded-full shadow-md border border-gray-100 px-1 py-1 z-10" onMouseDown={(e) => e.stopPropagation()}>
                        {SHAPE_TYPES.map(([s, Ic]) => (
                          <button key={s} onClick={(e) => { e.stopPropagation(); updateItem(it.id, { shape: s }); }} className={`w-6 h-6 rounded-md flex items-center justify-center ${it.shape === s ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'}`}><Ic size={14} /></button>
                        ))}
                        <div className="w-px h-5 bg-gray-200 mx-0.5" />
                        {SHAPE_FILLS.map((c2) => (<button key={c2} onClick={(e) => { e.stopPropagation(); updateItem(it.id, { fill: c2 }); }} className="w-4 h-4 rounded-full border border-black/10" style={{ background: c2 }} />))}
                        <button onClick={(e) => { e.stopPropagation(); updateItem(it.id, { fill: 'none' }); }} title="No fill" className="w-4 h-4 rounded-full border border-gray-300 bg-white text-[9px] text-red-400 flex items-center justify-center">⦸</button>
                        <div className="w-px h-5 bg-gray-200 mx-0.5" />
                        <button onClick={(e) => { e.stopPropagation(); updateItem(it.id, { border: !it.border }); }} title={it.border ? 'Remove border' : 'Add border'} className={`w-6 h-6 rounded-md flex items-center justify-center ${it.border ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'}`}><Square size={14} /></button>
                        <div className="w-px h-5 bg-gray-200 mx-0.5" />
                        <ZDel onFront={() => bringToFront(it.id)} onBack={() => sendToBack(it.id)} onDelete={() => deleteItem(it.id)} />
                      </div>
                    )}
                    {sel && !readOnly && <ItemControls onResize={(e) => startResize(e, it)} />}
                  </div>
                );
              }
              // note
              return (
                <div key={it.id} className="absolute group" style={{ left: it.x, top: it.y, width: it.w, height: it.h, background: it.color, boxShadow: selRing || '0 1px 3px rgba(0,0,0,0.12)', borderRadius: 10 }}
                     onMouseDown={(e) => startItemDrag(e, it)} onClick={(e) => { e.stopPropagation(); setSelectedId(it.id); }}>
                  {editingId === it.id ? (
                    <textarea autoFocus value={it.text} onMouseDown={(e) => e.stopPropagation()} onChange={(e) => updateItem(it.id, { text: e.target.value })}
                              onBlur={() => setEditingId(null)} className="w-full h-full bg-transparent outline-none resize-none p-2.5 text-sm text-gray-800" placeholder="Write a note…" />
                  ) : (
                    <div className="w-full h-full p-2.5 text-sm text-gray-800 whitespace-pre-wrap overflow-hidden" onDoubleClick={() => !readOnly && setEditingId(it.id)}>{it.text || <span className="text-gray-500/60">Double-click to write…</span>}</div>
                  )}
                  {sel && !readOnly && (
                    <div className="absolute -top-9 left-0 flex items-center gap-1 bg-white rounded-full shadow-md border border-gray-100 px-1.5 py-1" onMouseDown={(e) => e.stopPropagation()}>
                      {NOTE_COLORS.map((c) => (<button key={c} onClick={(e) => { e.stopPropagation(); updateItem(it.id, { color: c }); }} className="w-4 h-4 rounded-full border border-black/5" style={{ background: c }} />))}
                      <div className="w-px h-5 bg-gray-200 mx-0.5" />
                      <button onClick={(e) => { e.stopPropagation(); bringToFront(it.id); }} title="Bring to front" className="text-gray-500 hover:text-[#473AE0]"><BringToFront size={13} /></button>
                      <button onClick={(e) => { e.stopPropagation(); sendToBack(it.id); }} title="Send to back" className="text-gray-500 hover:text-[#473AE0]"><SendToBack size={13} /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteItem(it.id); }} className="ml-0.5 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  )}
                  {sel && !readOnly && <span onMouseDown={(e) => startResize(e, it)} className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize" style={{ background: 'rgba(0,0,0,0.18)', borderRadius: '0 0 10px 0' }} />}
                </div>
              );
            })}
          </div>

          {/* comment pins (unscaled, positioned from canvas coords) */}
          {comments.map((c) => {
            const left = c.x * view.zoom + view.x, top = c.y * view.zoom + view.y;
            const open = openCommentId === c.id;
            return (
              <div key={c.id} className="absolute" style={{ left, top, zIndex: open ? 45 : 20 }}>
                <button onMouseDown={(e) => startPinDrag(e, c)}
                        className="w-7 h-7 -ml-3.5 -mt-7 rounded-full rounded-bl-none shadow-md flex items-center justify-center text-white text-[11px] font-bold ring-2 ring-white"
                        style={{ background: pinColor(c), opacity: c.resolved ? 0.7 : 1 }} title={c.text || 'Comment'}>
                  {c.resolved ? <Check size={13} /> : numberOf(c.id)}
                </button>
                {open && (
                  <CommentThread
                    c={c} me={me} readOnly={readOnly} members={mentionPeople}
                    composer={composer} setComposer={setComposer} reply={reply} setReply={setReply}
                    mention={mention} mentionList={mentionList} onComposerText={onComposerText} pickMention={pickMention}
                    onClose={() => setOpenCommentId(null)} onResolve={() => toggleResolved(c)} onCyclePrio={() => cyclePriority(c)}
                    onDelete={() => deleteComment(c.id)} onSaveComposer={() => saveComposer(c)} onSendReply={() => sendReply(c)}
                    onDeleteReply={(rid) => deleteReply(c, rid)} onAttach={(f, t) => attachFile(f, t)}
                  />
                )}
              </div>
            );
          })}

          {/* empty hint */}
          {items.length === 0 && !readOnly && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2 pointer-events-none">
              <BrandStar size={30} />
              <div className="text-sm">Add notes, text, comments — or <span className="font-semibold">paste an image</span> (⌘/Ctrl+V) onto the canvas.</div>
            </div>
          )}

          {/* bottom add toolbar (floating pill — same style as Sitemap) */}
          {!readOnly && (
            <div onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
                 className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white rounded-2xl shadow-lg border border-gray-100 px-2 py-1.5">
              <ToolBtn onClick={addNote} title="Add note"><StickyNote size={18} /></ToolBtn>
              <ToolBtn onClick={addText} title="Add text"><Type size={18} /></ToolBtn>
              <div className="relative">
                <ToolBtn active={shapeMenu} onClick={() => setShapeMenu((v) => !v)} title="Add shape"><Shapes size={18} /></ToolBtn>
                {shapeMenu && (
                  <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white rounded-xl shadow-xl border border-gray-100 p-1" onMouseDown={(e) => e.stopPropagation()}>
                    {SHAPE_TYPES.map(([s, Ic, lbl]) => (
                      <button key={s} onClick={() => { addShape(s); setShapeMenu(false); }} title={lbl} className="w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100 flex items-center justify-center"><Ic size={18} /></button>
                    ))}
                  </div>
                )}
              </div>
              <ToolBtn active={commentMode} onClick={() => { setCommentMode((v) => !v); setPanelOpen(true); }} title="Add comment (click on the board)"><MessageSquare size={18} /></ToolBtn>
              <div className="w-px h-6 bg-gray-200 mx-0.5" />
              <label title="Add image" className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 cursor-pointer">
                <ImageIcon size={18} />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />
              </label>
            </div>
          )}

          {commentMode && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white text-xs rounded-full px-3 py-1.5 shadow-lg pointer-events-none">Click anywhere to place a comment</div>}

          {/* zoom controls */}
          <div onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
               className="absolute bottom-4 right-4 z-30 flex items-center gap-1 bg-white rounded-full shadow-md border border-gray-100 px-1.5 py-1">
            <button onClick={() => zoomBy(0.9)} className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center"><Minus size={15} /></button>
            <button onClick={resetView} className="px-2 text-xs text-gray-500 w-12 text-center">{Math.round(view.zoom * 100)}%</button>
            <button onClick={() => zoomBy(1.1)} className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center"><Plus size={15} /></button>
            <button onClick={resetView} className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center" title="Reset view"><Maximize size={14} /></button>
          </div>
        </div>

        {/* comments panel */}
        {panelOpen && (
          <div className="w-full sm:w-80 shrink-0 bg-white border-l border-gray-100 flex flex-col absolute sm:relative inset-0 sm:inset-auto z-40">
            <div className="h-12 shrink-0 flex items-center justify-between px-3 border-b border-gray-100">
              <span className="font-semibold text-gray-800 text-sm">Comments</span>
              <div className="flex items-center gap-1">
                <div className="relative">
                  <button onClick={() => setFilterOpen((v) => !v)} className={`w-8 h-8 rounded-full flex items-center justify-center ${filterActive ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-400 hover:bg-gray-100'}`} title="Filter"><SlidersHorizontal size={15} /></button>
                  {filterOpen && (
                    <div className="absolute right-0 top-9 z-30 w-52 bg-white rounded-xl shadow-xl border border-gray-100 p-2">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase px-1 pb-1">Priority</div>
                      {['all', ...PRIO_ORDER].map((p) => (
                        <button key={p} onClick={() => setPanelPriority(p)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left ${panelPriority === p ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-700 hover:bg-gray-50'}`}>
                          {p !== 'all' && <span className="w-2.5 h-2.5 rounded-full" style={{ background: PRIO[p].dot }} />} {p === 'all' ? 'All priorities' : PRIO[p].label}
                        </button>
                      ))}
                      <div className="h-px bg-gray-100 my-1.5" />
                      <button onClick={() => setPanelMentionsMe((v) => !v)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left ${panelMentionsMe ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-700 hover:bg-gray-50'}`}><AtSign size={14} /> Mentions me</button>
                    </div>
                  )}
                </div>
                <button onClick={() => setPanelOpen(false)} className="w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center"><X size={16} /></button>
              </div>
            </div>

            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">
                <Search size={14} className="text-gray-400" />
                <input value={panelSearch} onChange={(e) => setPanelSearch(e.target.value)} placeholder="Search comments…" className="flex-1 bg-transparent outline-none text-sm min-w-0" />
                {panelSearch && <button onClick={() => setPanelSearch('')}><X size={13} className="text-gray-400" /></button>}
              </div>
              <div className="flex items-center gap-1 mt-2 bg-gray-100 rounded-full p-0.5 text-xs">
                <button onClick={() => setPanelTab('active')} className={`flex-1 px-2 py-1 rounded-full ${panelTab === 'active' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500'}`}>Active{activeCount ? ` (${activeCount})` : ''}</button>
                <button onClick={() => setPanelTab('resolved')} className={`flex-1 px-2 py-1 rounded-full ${panelTab === 'resolved' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500'}`}>Resolved{resolvedCount ? ` (${resolvedCount})` : ''}</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {panelList.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-10">{panelTab === 'resolved' ? 'No resolved comments.' : 'No comments yet. Click the comment tool, then click the board.'}</div>
              ) : panelList.map((c) => (
                <button key={c.id} onClick={() => focusComment(c)} className={`w-full text-left rounded-xl border p-2.5 hover:border-indigo-300 ${openCommentId === c.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: pinColor(c) }}>{c.resolved ? <Check size={12} /> : numberOf(c.id)}</span>
                    <span className="text-xs font-semibold text-gray-700 truncate">{c.author || 'Me'}</span>
                    <span className="text-[10px] text-gray-400 ml-auto shrink-0">{timeAgo(c.ts)}</span>
                  </div>
                  <div className={`text-sm mt-1 line-clamp-2 ${c.resolved ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{c.text || <span className="text-gray-300">No text</span>}</div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400">
                    {c.priority && c.priority !== 'none' && <span className="inline-flex items-center gap-1" style={{ color: PRIO[c.priority].color }}><CircleDot size={11} /> {PRIO[c.priority].label}</span>}
                    {(c.replies || []).length > 0 && <span className="inline-flex items-center gap-1"><MessageSquare size={11} /> {c.replies.length}</span>}
                    {(c.attachments || []).length > 0 && <span className="inline-flex items-center gap-1"><Paperclip size={11} /> {c.attachments.length}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg z-50">{toast}</div>}

      {/* share modal */}
      {shareOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-6" onMouseDown={() => setShareOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-[92vw] p-6" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">Share “{name}”</h3>
              <button onClick={() => setShareOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <InvitePanel projectId={id} api={mbApi} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- comment thread popover ---------------- */
function Attachments({ files, onRemove }) {
  if (!files || !files.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {files.map((f) => (
        <div key={f.id} className="relative">
          {(f.type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(f.url || '')
            ? <img src={imgSrc(f.url)} alt={f.name} className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
            : <a href={imgSrc(f.url)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-[#473AE0] underline px-2 py-1"><Paperclip size={12} />{f.name}</a>}
          {onRemove && <button onClick={() => onRemove(f.id)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white shadow border text-gray-500 flex items-center justify-center"><X size={9} /></button>}
        </div>
      ))}
    </div>
  );
}

function Composer({ value, mentions, files, onText, onAttach, onRemoveFile, onSend, mention, mentionList, pickMention, which, placeholder, prio, onPrio }) {
  return (
    <div className="relative">
      {mention && mention.for === which && mentionList.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-50">
          {mentionList.map((p) => (
            <button key={p.id} onClick={() => pickMention(p)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-[#473AE0] flex items-center justify-center text-[9px] font-bold">{(p.name || 'U').slice(0, 1).toUpperCase()}</span>{p.name}
            </button>
          ))}
        </div>
      )}
      <Attachments files={files} onRemove={onRemoveFile} />
      <div className="flex items-end gap-1.5 mt-1.5 border border-gray-200 rounded-xl px-2 py-1.5 focus-within:border-indigo-300">
        <textarea value={value} onChange={(e) => onText(which, e.target.value)} onMouseDown={(e) => e.stopPropagation()} rows={1} placeholder={placeholder}
                  className="flex-1 bg-transparent outline-none text-sm resize-none max-h-24 min-w-0" />
        {onPrio && (
          <button onClick={onPrio} title="Priority" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100" style={{ color: PRIO[prio || 'none'].color }}><CircleDot size={15} /></button>
        )}
        <label className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 cursor-pointer" title="Attach image">
          <Paperclip size={15} />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttach(f, which); e.target.value = ''; }} />
        </label>
        <button onClick={onSend} disabled={!value.trim() && !(files || []).length} className="w-7 h-7 rounded-full bg-[#473AE0] text-white flex items-center justify-center disabled:opacity-40"><Send size={13} /></button>
      </div>
    </div>
  );
}

function CommentThread({ c, me, readOnly, members, composer, setComposer, reply, setReply, mention, mentionList, onComposerText, pickMention, onClose, onResolve, onCyclePrio, onDelete, onSaveComposer, onSendReply, onDeleteReply, onAttach }) {
  const needsBody = !c.text && !(c.attachments || []).length; // brand-new comment → show composer for the body
  return (
    <div className="absolute left-2 top-1 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 z-50" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-pink-500 text-white flex items-center justify-center text-[11px] font-bold shrink-0">{(c.author || 'M').slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-700 truncate">{c.author || 'Me'}</div>
          <div className="text-[10px] text-gray-400">{timeAgo(c.ts)}</div>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          {!readOnly && <button onClick={onCyclePrio} title="Priority" className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100" style={{ color: PRIO[c.priority || 'none'].color }}><CircleDot size={14} /></button>}
          {!readOnly && <button onClick={onResolve} title={c.resolved ? 'Reopen' : 'Resolve'} className={`w-7 h-7 rounded-full flex items-center justify-center ${c.resolved ? 'text-green-500 bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}><Check size={15} /></button>}
          {!readOnly && <button onClick={onDelete} title="Delete" className="w-7 h-7 rounded-full text-gray-400 hover:text-red-500 hover:bg-gray-100 flex items-center justify-center"><Trash2 size={14} /></button>}
          <button onClick={onClose} className="w-7 h-7 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center"><X size={14} /></button>
        </div>
      </div>

      {/* body */}
      {!needsBody && (
        <div className="mt-2">
          {c.priority && c.priority !== 'none' && <span className="inline-flex items-center gap-1 text-[11px] mb-1" style={{ color: PRIO[c.priority].color }}><CircleDot size={11} /> {PRIO[c.priority].label}</span>}
          <div className={`text-sm whitespace-pre-wrap ${c.resolved ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{c.text}</div>
          <Attachments files={c.attachments} />
        </div>
      )}

      {/* replies */}
      {(c.replies || []).length > 0 && (
        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border-t border-gray-100 pt-2">
          {(c.replies || []).map((r) => (
            <div key={r.id} className="flex items-start gap-2 group">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-[#473AE0] flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{(r.author || 'U').slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-gray-500"><span className="font-semibold text-gray-700">{r.author}</span> · {timeAgo(r.ts)}</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{r.text}</div>
                <Attachments files={r.attachments} />
              </div>
              {!readOnly && <button onClick={() => onDeleteReply(r.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>}
            </div>
          ))}
        </div>
      )}

      {/* composer: body (new) or reply */}
      {!readOnly && (
        needsBody ? (
          <Composer which="composer" value={composer.text} files={composer.files} mentions={composer.mentions}
                    onText={onComposerText} onAttach={onAttach} onRemoveFile={(fid) => setComposer((c2) => ({ ...c2, files: c2.files.filter((f) => f.id !== fid) }))}
                    onSend={onSaveComposer} mention={mention} mentionList={mentionList} pickMention={pickMention}
                    placeholder="Write a comment… (@ to mention)" prio={composer.priority} onPrio={() => setComposer((c2) => ({ ...c2, priority: PRIO_ORDER[(PRIO_ORDER.indexOf(c2.priority || 'none') + 1) % 4] }))} />
        ) : (
          <Composer which="reply" value={reply.text} files={reply.files} mentions={reply.mentions}
                    onText={onComposerText} onAttach={onAttach} onRemoveFile={(fid) => setReply((r2) => ({ ...r2, files: r2.files.filter((f) => f.id !== fid) }))}
                    onSend={onSendReply} mention={mention} mentionList={mentionList} pickMention={pickMention}
                    placeholder="Reply… (@ to mention)" />
        )
      )}
    </div>
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

// front / back / delete buttons — appended inside an element's style toolbar
function ZDel({ onFront, onBack, onDelete }) {
  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); onFront(); }} title="Bring to front" className="w-6 h-6 rounded-md text-gray-500 hover:bg-gray-100 flex items-center justify-center"><BringToFront size={13} /></button>
      <button onClick={(e) => { e.stopPropagation(); onBack(); }} title="Send to back" className="w-6 h-6 rounded-md text-gray-500 hover:bg-gray-100 flex items-center justify-center"><SendToBack size={13} /></button>
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete" className="w-6 h-6 rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-100 flex items-center justify-center"><Trash2 size={13} /></button>
    </>
  );
}

// resize handle only (style/z-order controls live in each element's toolbar)
function ItemControls({ onResize }) {
  return onResize ? <span onMouseDown={onResize} className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize bg-[#473AE0]/30 rounded-br-lg" /> : null;
}
