import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, MessageSquare, ChevronDown, Check, Trash2, Send, Plus, Upload, X, History, MousePointerClick, Play, Smile, CircleDot, Monitor, Tablet, Smartphone, Copy, Users, User, LogOut, Bot, Pencil, Undo2, Redo2, ArrowUpDown, Filter, Search, Paperclip, FileText, Image as ImageIcon, Download, Settings, RefreshCw, Loader2, SlidersHorizontal } from 'lucide-react';
import BrandStar from '../components/Brand';
import InvitePanel from '../components/InvitePanel';
import Account from '../components/Account';
import ConnectAI from '../components/ConnectAI';
import Team from '../components/Team';
import ActiveCollabField, { AcIcon } from '../components/ActiveCollabField';
import { initials } from '../auth';
import {
  getMarkupProject, listMarkupVersions,
  listMarkupComments, addMarkupComment, updateMarkupComment, deleteMarkupComment, markupFileUrl, markupProxyUrl,
  patchMarkupProject,
  getPublicMarkupProject, listPublicMarkupVersions, listPublicMarkupComments, addPublicMarkupComment,
  listMarkupProjectComments, listPublicMarkupProjectComments, addMarkupReply, addPublicMarkupReply,
  uploadMarkupAttachment, uploadPublicMarkupAttachment, setMarkupActiveCollab, syncMarkupPage, syncMarkupComment,
  deleteMarkupReply, listMarkupPeople, saveMarkupPage,
} from './markupApi';

import {
  ATTACH_ACCEPT, fileToDataUrl, isImageAtt, prettySize, MEMBER_API, PRIO, DRAW_TOOLS, DRAW_COLORS,
  EMOJIS, C_TYPES, C_SCOPES, commentMeta, describeElement, stampMkIds, ensureH2C, AddVersionModal,
  relTime, shortPage, pinBg, captureShot,
} from './markupHelpers';

export default function MarkupEditor({ id, onBack, user, onLogout, onUserChange, pub = false, focusCommentId = '' }) {
  const Api = pub
    ? { getProject: getPublicMarkupProject, listVersions: listPublicMarkupVersions, listComments: listPublicMarkupComments, listAll: listPublicMarkupProjectComments, addComment: addPublicMarkupComment, addReply: addPublicMarkupReply, uploadAttachment: uploadPublicMarkupAttachment }
    : { getProject: getMarkupProject, listVersions: listMarkupVersions, listComments: listMarkupComments, listAll: listMarkupProjectComments, addComment: addMarkupComment, addReply: addMarkupReply, uploadAttachment: uploadMarkupAttachment, deleteReply: deleteMarkupReply };
  const [guestName, setGuestName] = useState(() => { try { return localStorage.getItem('qoders-markup-name') || ''; } catch (e) { return ''; } });
  const [nameGate, setNameGate] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [project, setProject] = useState(null);
  const [versions, setVersions] = useState([]);
  const [versionId, setVersionId] = useState('');
  const [page, setPage] = useState('');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState('comment'); // 'comment' | 'browse'
  const [draft, setDraft] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [draftType, setDraftType] = useState('other');
  const [draftScope, setDraftScope] = useState('element');
  const [draftDesired, setDraftDesired] = useState('');
  // "Advanced" mode (session-only, default off): shows the AI metadata fields on the composer
  // and the per-comment meta chips. Hidden from clients unless they turn it on.
  const [advanced, setAdvanced] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [pageTitles, setPageTitles] = useState({}); // url projects: sub-page -> real <title>, captured on load
  const [verMenuOpen, setVerMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [name, setName] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTab, setShareTab] = useState('link');
  const [linkCopied, setLinkCopied] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [acctModalOpen, setAcctModalOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [acSettingsOpen, setAcSettingsOpen] = useState(false);
  const [acSyncOpen, setAcSyncOpen] = useState(false);
  const [acSyncBusy, setAcSyncBusy] = useState({}); // key -> true (page key or comment id)
  const [acSyncErr, setAcSyncErr] = useState('');
  const [connectOpen, setConnectOpen] = useState(false);
  const acctRef = useRef(null);
  useEffect(() => {
    const h = (e) => { if (acctRef.current && !acctRef.current.contains(e.target)) setAcctOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const [draftPriority, setDraftPriority] = useState('none');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [prioOpen, setPrioOpen] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [tool, setTool] = useState('pen');
  const [drawColor, setDrawColor] = useState('#2C2CE0');
  const [draftShapes, setDraftShapes] = useState([]);
  const [redoShapes, setRedoShapes] = useState([]);
  const [liveShape, setLiveShape] = useState(null);
  const [draftFiles, setDraftFiles] = useState([]); // attachments staged on the comment being written
  const [draftMentions, setDraftMentions] = useState([]); // @-mentioned user ids (shared draft/reply)
  const [people, setPeople] = useState([]); // mentionable project people
  const [mentionFor, setMentionFor] = useState(null); // 'draft' | 'reply' | null (which composer is @-typing)
  const [mentionQuery, setMentionQuery] = useState('');
  const [panelMentionsMe, setPanelMentionsMe] = useState(false); // filter: comments that @-tag me
  const [attachOpen, setAttachOpen] = useState(false); // the "Attach Files" modal
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachErr, setAttachErr] = useState('');
  const [flashId, setFlashId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [panelTab, setPanelTab] = useState('active'); // 'active' | 'resolved'
  const [panelScope, setPanelScope] = useState('all'); // 'page' | 'version' | 'all' (default: all)
  const [panelPriority, setPanelPriority] = useState('all');
  const [panelSearch, setPanelSearch] = useState('');
  const [panelSearchOpen, setPanelSearchOpen] = useState(false);
  const [panelFilterOpen, setPanelFilterOpen] = useState(false);
  const [panelSort, setPanelSort] = useState('newest'); // 'newest' | 'oldest'
  const [sameOrigin, setSameOrigin] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [colorOpen, setColorOpen] = useState(false);
  const [device, setDevice] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [frame, setFrame] = useState({ scrollTop: 0, scrollLeft: 0, w: 1, h: 1 });
  const surfaceRef = useRef(null);
  const iframeRef = useRef(null);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  const pendingScrollRef = useRef(null); // comment to scroll to once the iframe (re)loads
  const draftElRef = useRef(null); // the DOM element the in-progress comment is anchored to (for screenshot)

  const version = versions.find((v) => v.id === versionId) || null;

  // load project + versions
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([Api.getProject(id), Api.listVersions(id)])
      .then(([p, vs]) => {
        if (!active) return;
        setProject(p); setName(p.name || ''); setVersions(vs);
        const latest = vs[vs.length - 1];
        if (latest) { setVersionId(latest.id); setPage(latest.type === 'zip' && (latest.pages || []).length ? latest.pages[0].path : ''); }
        setLoading(false);
      })
      .catch((e) => { if (active) { setErr(e.message || 'Could not load'); setLoading(false); } });
    return () => { active = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // load ALL comments for the project (every version) once
  const refreshComments = () => Api.listAll(id).then(setComments).catch(() => {});
  useEffect(() => { refreshComments(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // mentionable people (authed only)
  useEffect(() => { if (!pub) listMarkupPeople(id).then(setPeople).catch(() => {}); }, [id, pub]);

  const switchVersion = (v) => {
    setVersionId(v.id);
    setPage(v.type === 'zip' && (v.pages || []).length ? v.pages[0].path : '');
    setSelectedId(null); setDraft(null); setVerMenuOpen(false);
  };

  const reloadVersions = async (selectNewest = true) => {
    const vs = await Api.listVersions(id);
    setVersions(vs);
    if (selectNewest && vs.length) switchVersion(vs[vs.length - 1]);
  };

  // pins on the canvas = current version + current page, respecting the Active/Resolved tab
  const pageComments = comments.filter((c) => c.versionId === versionId && (c.page || '') === (page || '') && (panelTab === 'resolved' ? c.resolved : !c.resolved));
  // base = everything matching the current scope / priority / search (NOT the active
  // /resolved tab). The tab counts and the list both derive from this so the numbers
  // are "real" — they reflect exactly what the current filter shows.
  const panelBase = comments
    .filter((c) => {
      if (panelScope === 'page') return c.versionId === versionId && (c.page || '') === (page || '');
      if (panelScope === 'version') return c.versionId === versionId;
      return true;
    })
    .filter((c) => panelPriority === 'all' || (c.priority || 'none') === panelPriority)
    .filter((c) => {
      if (!panelMentionsMe || !user?.id) return true;
      const me = user.id;
      return (c.mentions || []).includes(me) || (c.replies || []).some((r) => (r.mentions || []).includes(me));
    })
    .filter((c) => { const q = panelSearch.trim().toLowerCase(); return !q || (c.text || '').toLowerCase().includes(q) || (c.author || '').toLowerCase().includes(q); });
  const activeCount = panelBase.filter((c) => !c.resolved).length;
  const resolvedCount = panelBase.filter((c) => c.resolved).length;
  // panel list = base, narrowed to the active/resolved tab, then sorted
  const panelList = panelBase
    .filter((c) => (panelTab === 'resolved' ? c.resolved : !c.resolved))
    .sort((a, b) => (panelSort === 'oldest' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt));
  // a non-default filter is active (drives the dot indicator on the Filter button)
  const filterActive = panelScope !== 'all' || panelPriority !== 'all' || panelMentionsMe;
  // how many comments were left on each device (within the current filter scope)
  const deviceCounts = { desktop: 0, tablet: 0, mobile: 0 };
  panelBase.forEach((c) => { const d = c.device || 'desktop'; if (deviceCounts[d] != null) deviceCounts[d] += 1; });
  const src = version ? (version.type === 'zip' ? markupFileUrl(version.id, page) : markupProxyUrl(version.id)) : '';

  // pin doc-fraction → on-screen px (relative to the surface viewport)
  const pinScreen = (cx, cy) => ({ left: cx * frame.w - frame.scrollLeft, top: cy * frame.h - frame.scrollTop });

  // --- drawing ---
  const toFrac = (clientX, clientY) => {
    const rect = surfaceRef.current.getBoundingClientRect();
    return { x: ((clientX - rect.left) + frame.scrollLeft) / frame.w, y: ((clientY - rect.top) + frame.scrollTop) / frame.h };
  };
  const closeDraft = () => { setDraft(null); setDraftText(''); setDraftPriority('none'); setDrawMode(false); setDraftShapes([]); setRedoShapes([]); setLiveShape(null); setEmojiOpen(false); setPrioOpen(false); setDraftFiles([]); setAttachOpen(false); setAttachErr(''); setDraftMentions([]); setMentionFor(null); setDraftType('other'); setDraftScope('element'); setDraftDesired(''); draftElRef.current = null; };

  // upload one or more chosen files as attachments on the comment being written
  const addAttachments = async (fileList) => {
    const files = Array.from(fileList || []); if (!files.length) return;
    if (pub && !guestName) { setNameInput(''); setNameGate(true); return; }
    setAttachErr(''); setAttachBusy(true);
    try {
      for (const file of files) {
        if (file.size > 30 * 1024 * 1024) { setAttachErr(`${file.name} is too large (max 30MB).`); continue; }
        const dataUrl = await fileToDataUrl(file);
        const saved = await Api.uploadAttachment(file.name, dataUrl);
        setDraftFiles((fs) => [...fs, saved]);
      }
    } catch (e) { setAttachErr(e.message || 'Upload failed'); }
    setAttachBusy(false);
  };
  const removeDraftFile = (fid) => setDraftFiles((fs) => fs.filter((f) => f.id !== fid));

  // render a comment's saved attachments (image thumbnails + file chips) — used in the
  // pin popup and the sidebar. Files open in a new tab.
  const renderAttachments = (list) => ((list && list.length > 0) ? (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {list.map((f) => (isImageAtt(f) ? (
        <div key={f.id} className="relative group">
          <a href={f.url} target="_blank" rel="noreferrer" title={`Open ${f.name}`} className="block">
            <img src={f.url} alt={f.name} className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
          </a>
          <a href={f.url} download={f.name} title={`Download ${f.name}`} className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-md bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Download size={11} /></a>
        </div>
      ) : (
        <a key={f.id} href={f.url} download={f.name} title={`Download ${f.name}${f.size ? ` · ${prettySize(f.size)}` : ''}`} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] text-gray-700 hover:bg-gray-100 max-w-[170px]">
          <FileText size={13} className="text-indigo-500 shrink-0" />
          <span className="truncate flex-1">{f.name}</span>
          <Download size={12} className="text-gray-400 shrink-0" />
        </a>
      )))}
    </div>
  ) : null);
  const startDraw = (e) => {
    e.preventDefault();
    const start = toFrac(e.clientX, e.clientY);
    const freehand = tool === 'pen' || tool === 'highlight';
    const shape = freehand ? { type: tool, color: drawColor, points: [start] } : { type: tool, color: drawColor, x1: start.x, y1: start.y, x2: start.x, y2: start.y };
    setLiveShape(freehand ? { ...shape, points: [...shape.points] } : { ...shape });
    const move = (ev) => {
      const p = toFrac(ev.clientX, ev.clientY);
      if (shape.points) { shape.points.push(p); setLiveShape({ ...shape, points: [...shape.points] }); }
      else { shape.x2 = p.x; shape.y2 = p.y; setLiveShape({ ...shape }); }
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setDraftShapes((s) => [...s, shape]); setRedoShapes([]); setLiveShape(null);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const undoShape = () => setDraftShapes((s) => { if (!s.length) return s; setRedoShapes((r) => [...r, s[s.length - 1]]); return s.slice(0, -1); });
  const redoShape = () => setRedoShapes((r) => { if (!r.length) return r; setDraftShapes((s) => [...s, r[r.length - 1]]); return r.slice(0, -1); });

  // render one shape as an SVG element (coords mapped through the current scroll/frame)
  const shapeEl = (sh, i) => {
    const hl = sh.type === 'highlight';
    const sw = hl ? 14 : 3, op = hl ? 0.4 : 1;
    if (sh.points) {
      const d = sh.points.map((p, idx) => `${idx ? 'L' : 'M'}${(p.x * frame.w - frame.scrollLeft).toFixed(1)} ${(p.y * frame.h - frame.scrollTop).toFixed(1)}`).join(' ');
      return <path key={i} d={d} stroke={sh.color} strokeWidth={sw} strokeOpacity={op} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    }
    const a = pinScreen(sh.x1, sh.y1), b = pinScreen(sh.x2, sh.y2);
    if (sh.type === 'rect') return <rect key={i} x={Math.min(a.left, b.left)} y={Math.min(a.top, b.top)} width={Math.abs(b.left - a.left)} height={Math.abs(b.top - a.top)} stroke={sh.color} strokeWidth={3} fill="none" rx="3" />;
    if (sh.type === 'ellipse') return <ellipse key={i} cx={(a.left + b.left) / 2} cy={(a.top + b.top) / 2} rx={Math.abs(b.left - a.left) / 2} ry={Math.abs(b.top - a.top) / 2} stroke={sh.color} strokeWidth={3} fill="none" />;
    return <line key={i} x1={a.left} y1={a.top} x2={b.left} y2={b.top} stroke={sh.color} strokeWidth={3} strokeLinecap="round" markerEnd={sh.type === 'arrow' ? 'url(#mk-arrow)' : undefined} />;
  };
  const selectedComment = comments.find((c) => c.id === selectedId);

  // read the (same-origin) iframe's scroll + document size
  const measureFrame = useCallback(() => {
    const ifr = iframeRef.current; if (!ifr) return;
    try {
      const win = ifr.contentWindow, doc = ifr.contentDocument; if (!doc || !win) return;
      const de = doc.documentElement, b = doc.body;
      setFrame({
        scrollTop: win.scrollY || de.scrollTop || 0,
        scrollLeft: win.scrollX || de.scrollLeft || 0,
        w: Math.max(de.scrollWidth || 0, b ? b.scrollWidth : 0) || ifr.clientWidth || 1,
        h: Math.max(de.scrollHeight || 0, b ? b.scrollHeight : 0) || ifr.clientHeight || 1,
      });
    } catch (e) { /* cross-origin */ }
  }, []);

  // re-measure when the device width changes (iframe reflows)
  useEffect(() => {
    if (!sameOrigin) return;
    const t1 = setTimeout(measureFrame, 60); const t2 = setTimeout(measureFrame, 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [device, sameOrigin, measureFrame]);

  // When the iframe loads, if it's same-origin (via proxy / our static files) we can
  // read its scroll and capture clicks inside it → live site + scroll + pins that stick.
  // show a preloader whenever the displayed version changes
  useEffect(() => { if (versionId) setIframeLoading(true); }, [versionId]);

  // reset the (shared) composer tools whenever the open comment changes, so the reply
  // box starts clean each time.
  useEffect(() => {
    setReplyText(''); setDraftShapes([]); setRedoShapes([]); setLiveShape(null);
    setDraftPriority('none'); setDraftFiles([]); setDrawMode(false);
    setEmojiOpen(false); setPrioOpen(false); setColorOpen(false);
    setDraftMentions([]); setMentionFor(null);
  }, [selectedId]);

  // Esc closes whatever comment UI is open (without saving): attach modal → draft → selected pin.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (attachOpen) { setAttachOpen(false); return; }
      if (draft) { closeDraft(); return; }
      if (selectedId) { setSelectedId(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attachOpen, draft, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // while drawing, stop the embedded site from swallowing pointer events
  useEffect(() => { try { if (iframeRef.current) iframeRef.current.style.pointerEvents = drawMode ? 'none' : ''; } catch (e) {} }, [drawMode]);

  // keep the in-iframe comment-mode flag in sync (used by the proxy nav script)
  useEffect(() => { try { if (iframeRef.current?.contentWindow) iframeRef.current.contentWindow.__markupCommentMode = (mode === 'comment'); } catch (e) {} }, [mode]);

  const onIframeLoad = () => {
    setIframeLoading(false);
    const ifr = iframeRef.current;
    if (!ifr) return;
    try {
      const win = ifr.contentWindow; const doc = ifr.contentDocument;
      if (!doc || !win) throw new Error('cross-origin');
      setSameOrigin(true);
      win.__markupCommentMode = (modeRef.current === 'comment');
      // give elements stable ids (once) so comment fixes can target them across reloads,
      // then make a screenshot rasterizer available. Compute the HTML BEFORE injecting h2c.
      if (!pub && version?.type === 'zip') {
        try { const added = stampMkIds(doc); if (added) { const htmlOut = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML; saveMarkupPage(versionId, page, htmlOut).catch(() => {}); } } catch (e) {}
      }
      ensureH2C(doc);
      // for URL projects, the comment "page" key = the current sub-page being viewed
      if (version?.type === 'url') {
        try {
          const sub = new URL(win.location.href).searchParams.get('url') || '';
          setPage(sub);
          if (doc.title) setPageTitles((t) => ({ ...t, [sub]: doc.title }));
        } catch (e) {}
      }
      measureFrame();
      win.addEventListener('scroll', measureFrame, { passive: true });
      win.addEventListener('resize', measureFrame);
      setTimeout(measureFrame, 400); setTimeout(measureFrame, 1200);
      // if a comment was clicked in the sidebar before this (re)load, scroll to it now
      if (pendingScrollRef.current) { const pc = pendingScrollRef.current; pendingScrollRef.current = null; setTimeout(() => scrollToComment(pc), 350); }
      doc.addEventListener('click', (e) => {
        if (modeRef.current !== 'comment') return;
        e.preventDefault(); e.stopPropagation();
        const de = doc.documentElement, b = doc.body;
        const w = Math.max(de.scrollWidth || 0, b ? b.scrollWidth : 0) || 1;
        const h = Math.max(de.scrollHeight || 0, b ? b.scrollHeight : 0) || 1;
        draftElRef.current = e.target;
        setDraft({ x: (e.clientX + (win.scrollX || 0)) / w, y: (e.clientY + (win.scrollY || 0)) / h, anchor: describeElement(e.target, doc) });
        setDraftText(''); setSelectedId(null);
      }, true);
    } catch (err) {
      // cross-origin fallback: pins are relative to the viewport (no scroll tracking)
      setSameOrigin(false);
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (rect) setFrame({ scrollTop: 0, scrollLeft: 0, w: rect.width, h: rect.height });
    }
  };

  // fallback placement (cross-origin iframe only); same-origin is handled inside the iframe
  const onSurfaceClick = (e) => {
    if (mode !== 'comment' || sameOrigin) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    setDraft({
      x: Math.min(1, Math.max(0, ((e.clientX - rect.left) + frame.scrollLeft) / frame.w)),
      y: Math.min(1, Math.max(0, ((e.clientY - rect.top) + frame.scrollTop) / frame.h)),
    });
    setDraftText(''); setSelectedId(null);
  };
  const saveDraft = async () => {
    const text = draftText.trim();
    if ((!text && !draftShapes.length && !draftFiles.length) || !draft || !versionId) return;
    if (pub && !guestName) { setNameInput(''); setNameGate(true); return; } // ask for a name first
    try {
      const author = pub ? guestName : (user?.name || 'You');
      let screenshot = '';
      try { if (sameOrigin) screenshot = await captureShot(iframeRef.current?.contentWindow, draftElRef.current); } catch (e) {}
      const c = await Api.addComment(versionId, { page: page || '', x: draft.x, y: draft.y, text: text || (draftFiles.length ? '(file)' : '(drawing)'), author, priority: draftPriority, drawing: draftShapes, attachments: draftFiles, device, mentions: draftMentions, anchor: draft.anchor || {}, type: draftType, scope: draftScope, desiredValue: draftDesired.trim(), screenshot });
      setComments((cs) => [...cs, { ...c, versionLabel: version?.label }]); closeDraft(); setSelectedId(c.id);
    } catch (e) { setErr(e.message || 'Could not save comment'); }
  };
  const toggleResolved = async (c) => { try { const u = await updateMarkupComment(c.id, { resolved: !c.resolved }); setComments((cs) => cs.map((x) => (x.id === c.id ? { ...u, versionLabel: x.versionLabel } : x))); } catch (e) {} };
  const removeComment = async (c) => { try { await deleteMarkupComment(c.id); setComments((cs) => cs.filter((x) => x.id !== c.id)); if (selectedId === c.id) setSelectedId(null); } catch (e) {} };
  const setPriority = async (c, priority) => { try { const u = await updateMarkupComment(c.id, { priority }); setComments((cs) => cs.map((x) => (x.id === c.id ? { ...u, versionLabel: x.versionLabel } : x))); } catch (e) {} };

  // drag a pin to reposition it (click without moving = select/focus)
  const startPinDrag = (e, c) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (pub) { setSelectedId((s) => (s === c.id ? null : c.id)); return; } // public can't move pins
    const rect = surfaceRef.current.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY; let moved = false; let last = null; let raf = 0;
    const ifr = iframeRef.current;
    // While dragging, stop the iframe from swallowing mouse events (otherwise the drag
    // freezes/stutters the moment the cursor passes over the embedded site).
    if (ifr) ifr.style.pointerEvents = 'none';
    document.body.style.userSelect = 'none';
    const frac = (ev) => ({
      x: Math.min(1, Math.max(0, ((ev.clientX - rect.left) + frame.scrollLeft) / frame.w)),
      y: Math.min(1, Math.max(0, ((ev.clientY - rect.top) + frame.scrollTop) / frame.h)),
    });
    const apply = () => {
      raf = 0; if (!last) return;
      const p = frac(last);
      setComments((cs) => cs.map((x) => (x.id === c.id ? { ...x, x: p.x, y: p.y } : x)));
    };
    const move = (ev) => {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) moved = true;
      if (!moved) return;
      last = ev;
      if (!raf) raf = requestAnimationFrame(apply); // coalesce to one update per frame
    };
    const cleanup = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      if (raf) cancelAnimationFrame(raf);
      if (ifr) ifr.style.pointerEvents = '';
      document.body.style.userSelect = '';
    };
    const up = (ev) => {
      cleanup();
      if (!moved) { setSelectedId((s) => (s === c.id ? null : c.id)); return; }
      const p = frac(ev);
      setComments((cs) => cs.map((x) => (x.id === c.id ? { ...x, x: p.x, y: p.y } : x)));
      updateMarkupComment(c.id, { x: p.x, y: p.y }).catch(() => {});
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };

  const sendReply = async (c) => {
    const t = replyText.trim();
    if (!t && !draftShapes.length && !draftFiles.length) return; // nothing to send
    if (pub && !guestName) { setNameInput(''); setNameGate(true); return; }
    const author = pub ? guestName : (user?.name || 'You');
    try {
      const u = await Api.addReply(c.id, { text: t, author, priority: draftPriority, drawing: draftShapes, attachments: draftFiles, mentions: draftMentions });
      setComments((cs) => cs.map((x) => (x.id === u.id ? { ...u, versionLabel: x.versionLabel } : x)));
      setReplyText(''); setDraftShapes([]); setRedoShapes([]); setLiveShape(null); setDraftPriority('none'); setDraftFiles([]); setDrawMode(false); setDraftMentions([]); setMentionFor(null);
    } catch (e) { setErr(e.message || 'Could not reply'); }
  };

  const removeReply = async (c, r) => {
    try { const u = await Api.deleteReply(c.id, r.id); setComments((cs) => cs.map((x) => (x.id === u.id ? { ...u, versionLabel: x.versionLabel } : x))); } catch (e) {}
  };

  // --- @mentions ---
  const detectMention = (v) => { const m = /@([\p{L}0-9_.]*)$/u.exec(v || ''); return m ? m[1] : null; };
  const onComposerType = (which, value) => {
    if (which === 'reply') setReplyText(value); else setDraftText(value);
    if (pub) return;
    const q = detectMention(value);
    if (q === null) { setMentionFor(null); return; }
    setMentionFor(which); setMentionQuery(q);
  };
  const mentionList = (people || []).filter((p) => (p.name || '').toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6);
  const pickMention = (p) => {
    const repl = (v) => v.replace(/@([\p{L}0-9_.]*)$/u, `@${p.name} `);
    if (mentionFor === 'reply') setReplyText((v) => repl(v)); else setDraftText((v) => repl(v));
    setDraftMentions((m) => (m.includes(p.id) ? m : [...m, p.id]));
    setMentionFor(null); setMentionQuery('');
  };
  // render a mention dropdown anchored above the composer toolbar
  const mentionDropdown = (which) => (mentionFor === which && mentionList.length > 0 ? (
    <div className="absolute bottom-9 left-0 z-40 w-60 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5">
      {mentionList.map((p) => (
        <button key={p.id} onClick={() => pickMention(p)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left">
          <span className="w-6 h-6 rounded-full bg-pink-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">{initials(p.name)}</span>
          <span className="text-sm text-gray-700 truncate">{p.name}</span>
        </button>
      ))}
    </div>
  ) : null);

  // smoothly scroll the (same-origin) iframe so the comment's pin is centered in view
  const scrollToComment = (c) => {
    try {
      const win = iframeRef.current?.contentWindow; const doc = iframeRef.current?.contentDocument;
      if (!win || !doc) return;
      const de = doc.documentElement, b = doc.body;
      const h = Math.max(de.scrollHeight || 0, b ? b.scrollHeight : 0) || 1;
      const w = Math.max(de.scrollWidth || 0, b ? b.scrollWidth : 0) || 1;
      win.scrollTo({ left: Math.max(0, c.x * w - win.innerWidth / 2), top: Math.max(0, c.y * h - win.innerHeight / 2), behavior: 'smooth' });
    } catch (e) {}
  };

  // focus a comment from the panel: jump to its version/page, scroll the page to its
  // pin, then select + flash. If the page must (re)load first, the scroll is deferred
  // to onIframeLoad via pendingScrollRef.
  const focusComment = (c) => {
    let willReload = false;
    if (c.versionId !== versionId) { const v = versions.find((x) => x.id === c.versionId); if (v) { setVersionId(v.id); if (v.type === 'zip') setPage(c.page || ''); willReload = true; } }
    else if ((c.page || '') !== (page || '')) {
      if (version?.type === 'zip') setPage(c.page || '');
      else { try { const win = iframeRef.current?.contentWindow; if (win) win.location.href = win.location.origin + markupProxyUrl(versionId) + (c.page ? `&url=${encodeURIComponent(c.page)}` : ''); } catch (e) {} }
      willReload = true;
    }
    if (willReload) pendingScrollRef.current = c; else scrollToComment(c);
    setSelectedId(c.id); setFlashId(c.id);
    setTimeout(() => setFlashId((f) => (f === c.id ? null : f)), 1500);
  };

  // deep link: when opened with ?comment=<id>, jump to + open that comment once loaded
  const didFocusRef = useRef(false);
  useEffect(() => {
    if (didFocusRef.current || !focusCommentId || !comments.length || !versions.length) return;
    const c = comments.find((x) => x.id === focusCommentId);
    if (c) { didFocusRef.current = true; setMode('comment'); setTimeout(() => focusComment(c), 300); }
  }, [focusCommentId, comments, versions]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-[#FBFCFE]"><BrandStar size={40} /></div>;
  if (!project) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#FBFCFE] text-gray-500 gap-3">
      <BrandStar size={40} /><div className="text-sm">{err || 'Markup project not found.'}</div>
      <button onClick={onBack} className="text-sm text-[#473AE0]">Back</button>
    </div>
  );

  const pages = version?.pages || [];
  // A readable page name: the real <title> captured on load, else the last path
  // segment prettified ("/collections/super-foods" -> "Super Foods"), else "Home".
  const prettyPage = (p) => {
    if (!p) return 'Home';
    let path; try { path = new URL(p).pathname; } catch (e) { path = p; }
    const seg = (path || '').split('/').filter(Boolean).pop();
    if (!seg) return 'Home';
    return seg.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };
  const titleFor = (p) => (pageTitles[p] && pageTitles[p].trim()) ? pageTitles[p].trim() : prettyPage(p);
  // unresolved comment count for a page in the current version (shown as a badge)
  const openCount = (p) => comments.filter((c) => c.versionId === versionId && (c.page || '') === (p || '') && !c.resolved).length;
  // For URL projects there's no fixed page list. Build one from the sub-pages that
  // have at least one comment (any status) — plus Home and the current page — so you
  // can jump straight back to any page you've commented on from the dropdown.
  const urlPages = (() => {
    if (version?.type !== 'url') return [];
    const set = new Set(['', page || '']);
    comments.forEach((c) => { if (c.versionId === versionId) set.add(c.page || ''); });
    return Array.from(set).map((p) => ({ path: p, title: titleFor(p) }));
  })();
  const dropdownPages = version?.type === 'zip' ? pages : urlPages;
  const showPages = version?.type === 'zip' ? pages.length > 0 : dropdownPages.length > 1;
  const currentTitle = version?.type === 'zip'
    ? (pages.find((p) => p.path === page)?.title || 'Page')
    : titleFor(page);

  // jump the editor to a page: zip = swap static file; url = navigate the iframe to the
  // sub-page (absolute origin URL so the injected <base href> can't hijack it).
  const goToPage = (path) => {
    setPageMenuOpen(false); setSelectedId(null); setDraft(null);
    if (version?.type === 'zip') { setPage(path); return; }
    try {
      const win = iframeRef.current?.contentWindow;
      if (win) win.location.href = win.location.origin + markupProxyUrl(versionId) + (path ? `&url=${encodeURIComponent(path)}` : '');
    } catch (e) {}
  };

  /* -------------------- Active Collab sync (pages = tasks, comments = subtasks) -------------------- */
  const canSyncAc = ['owner', 'pm', 'production', 'editor'].includes(project?.role || 'owner'); // clients can't sync/configure AC
  const acTasks = project?.acTasks || {};
  // group all comments by page key (across versions) for the sync tree
  const acPages = (() => {
    const map = new Map();
    comments.forEach((c) => { const k = c.page || ''; if (!map.has(k)) map.set(k, []); map.get(k).push(c); });
    return Array.from(map.entries()).map(([key, list]) => ({ key, title: key ? titleFor(key) : 'Home', comments: list }));
  })();
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const buildAcPageBody = (page) => {
    let html = `<p><strong>Page:</strong> ${esc(page.title)}</p><p><strong>Comments:</strong> ${page.comments.length}</p>`;
    html += '<p><em>Each comment is a subtask. Synced from Qoders Markup.</em></p>';
    return html;
  };
  // a unique link that opens this exact comment in the public viewer (anyone can open it)
  const commentLink = (c) => `${window.location.origin}${window.location.pathname}#/markup/view/${id}?comment=${c.id}`;
  const buildAcCommentBody = (c) => {
    let s = `${c.author || 'User'}: ${c.text || ''}`;
    if (c.priority && c.priority !== 'none') s += ` [${c.priority}]`;
    (c.replies || []).forEach((r) => { s += `\n↳ ${r.author || 'User'}: ${r.text}`; });
    s += `\n\n🔗 Open comment: ${commentLink(c)}`;
    return s;
  };
  const syncAcPage = async (page) => {
    setAcSyncErr(''); setAcSyncBusy((s) => ({ ...s, ['p:' + page.key]: true }));
    try {
      const out = await syncMarkupPage(project.id, { pageKey: page.key, name: page.title, body: buildAcPageBody(page), taskId: acTasks[page.key]?.taskId || '' });
      setProject((p) => (p ? { ...p, acTasks: { ...(p.acTasks || {}), [page.key]: { taskId: out.taskId, taskNumber: out.taskNumber } } } : p));
      return out.taskId;
    } catch (e) { setAcSyncErr(e.message || 'Sync failed'); return null; }
    finally { setAcSyncBusy((s) => { const c = { ...s }; delete c['p:' + page.key]; return c; }); }
  };
  const syncAcComment = async (page, c, taskIdOverride) => {
    setAcSyncErr(''); setAcSyncBusy((s) => ({ ...s, ['c:' + c.id]: true }));
    try {
      let taskId = taskIdOverride || acTasks[page.key]?.taskId || '';
      if (!taskId) { taskId = await syncAcPage(page); if (!taskId) return; }
      const out = await syncMarkupComment(c.id, { taskId, body: buildAcCommentBody(c), subtaskId: c.acSubtaskId || '', completed: !!c.resolved });
      setComments((cs) => cs.map((x) => (x.id === c.id ? { ...x, acSubtaskId: out.subtaskId, acSubtaskNumber: out.subtaskNumber, versionLabel: x.versionLabel } : x)));
    } catch (e) { setAcSyncErr(e.message || 'Sync failed'); }
    finally { setAcSyncBusy((s) => { const cc = { ...s }; delete cc['c:' + c.id]; return cc; }); }
  };
  // Sync a page AND every comment on it (so "Sync page" updates the whole task tree).
  const syncAcPageWithComments = async (page) => {
    const taskId = await syncAcPage(page);
    if (!taskId) return;
    for (const c of page.comments) { await syncAcComment(page, c, taskId); } // eslint-disable-line no-await-in-loop
  };
  const syncAcAll = async () => {
    setAcSyncErr('');
    for (const page of acPages) { await syncAcPageWithComments(page); } // eslint-disable-line no-await-in-loop
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[#FBFCFE]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* header */}
      <div className="h-14 shrink-0 bg-white border-b border-gray-100 flex items-center gap-3 px-4 relative">
        {/* left: back, brand icon, editable name, version + page dropdowns */}
        {!pub && <button onClick={onBack} className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-600 flex items-center justify-center"><ArrowLeft size={18} /></button>}
        <div className="flex items-center gap-2">
          <BrandStar size={22} />
          {pub ? (
            <span className="text-[15px] font-semibold text-[#473AE0] max-w-[200px] truncate">{project.name}</span>
          ) : (
            <input value={name} onChange={(e) => setName(e.target.value)}
                   onBlur={() => { const n = name.trim() || 'Markup'; setName(n); if (n !== project.name) { patchMarkupProject(id, { name: n }).catch(() => {}); setProject((p) => ({ ...p, name: n })); } }}
                   onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                   style={{ width: `${Math.min(Math.max((name || '').length, 3) + 1, 30)}ch` }}
                   className="text-[15px] font-semibold text-[#473AE0] bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded px-1" />
          )}
          {/* version dropdown (close to the title) */}
          <div className="relative">
            <button onClick={() => setVerMenuOpen((v) => !v)} className="flex items-center gap-1 text-sm text-[#473AE0] bg-indigo-50 hover:bg-indigo-100 rounded-full px-2.5 py-1 font-medium leading-none">
              <History size={13} /> {version?.label || 'v1'} <ChevronDown size={13} />
            </button>
          {verMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setVerMenuOpen(false)} />
              <div className="absolute left-0 top-11 z-40 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5">
                {versions.map((v) => (
                  <button key={v.id} onClick={() => switchVersion(v)} className={`w-full text-left px-3 py-2 rounded-lg ${v.id === versionId ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                    <div className={`text-sm font-medium ${v.id === versionId ? 'text-[#473AE0]' : 'text-gray-700'}`}>{v.label}</div>
                    <div className="text-[11px] text-gray-400">Added {new Date(v.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </button>
                ))}
                {!pub && <>
                  <div className="h-px bg-gray-100 my-1" />
                  <button onClick={() => { setVerMenuOpen(false); setAddOpen(true); }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><Plus size={15} /> Add version</button>
                </>}
              </div>
            </>
          )}
          </div>
        </div>

        {/* page dropdown — zip: static pages; url: sub-pages that have comments */}
        {showPages && (
          <div className="relative">
            <button onClick={() => setPageMenuOpen((v) => !v)} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1.5 max-w-[220px]">
              <span className="truncate">{currentTitle}</span><ChevronDown size={14} />
            </button>
            {pageMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setPageMenuOpen(false)} />
                <div className="absolute left-0 top-11 z-40 w-72 max-h-80 overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-100 p-1.5">
                  {version?.type === 'url' && (
                    <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Pages with comments</div>
                  )}
                  {dropdownPages.map((p) => {
                    const n = openCount(p.path);
                    return (
                      <button key={p.path} onClick={() => goToPage(p.path)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${p.path === (page || '') ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-700 hover:bg-gray-50'}`}>
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium flex-1">{p.title}</span>
                          {n > 0 && (
                            <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#473AE0] text-white text-[10px] font-semibold" title={`${n} open comment${n > 1 ? 's' : ''}`}>{n}</span>
                          )}
                        </div>
                        <div className="truncate text-[11px] text-gray-400">{p.path || (version?.url || '/')}</div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* center: Comment/Browse + device toggle */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-full p-1 text-sm">
            <button onClick={() => setMode('comment')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium ${mode === 'comment' ? 'bg-[#473AE0] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <MessageSquare size={15} /> Comment
            </button>
            <button onClick={() => { setMode('browse'); setDraft(null); setSelectedId(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium ${mode === 'browse' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <MousePointerClick size={15} /> Browse
            </button>
          </div>
          <div className="flex items-center bg-gray-100 rounded-full p-1">
            {[['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]].map(([d, Icon]) => (
              <button key={d} onClick={() => setDevice(d)} title={d}
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${device === d ? 'bg-white shadow-sm text-[#473AE0]' : 'text-gray-500 hover:text-gray-700'}`}>
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>

        {/* right: Share (owner) / name (guest) */}
        <div className="ml-auto flex items-center gap-2">
          {pub ? (
            <button onClick={() => { setNameInput(guestName); setNameGate(true); }} className="flex items-center gap-2 text-sm text-gray-600 hover:bg-gray-50 rounded-full px-3 py-1.5">
              <span className="w-7 h-7 rounded-full bg-pink-500 text-white flex items-center justify-center text-[11px] font-bold">{(guestName || '?').slice(0, 2).toUpperCase()}</span>
              {guestName || 'Set your name'}
            </button>
          ) : (
            <>
              <button onClick={() => setShareOpen(true)} className="flex items-center gap-1 bg-[#473AE0] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-indigo-600">
                Share <Play size={13} className="ml-1" fill="white" />
              </button>
              {canSyncAc && <button onClick={() => setAcSyncOpen(true)} title="Synchronize with Active Collab" className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 hover:bg-[#473AE0] hover:text-white transition-colors flex items-center justify-center"><RefreshCw size={16} /></button>}
              {user?.teamRole === 'pm' && <button onClick={() => setAcSettingsOpen(true)} title="Assign AC Project" className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 hover:bg-[#473AE0] hover:text-white transition-colors flex items-center justify-center"><Settings size={17} /></button>}
              <div className="relative" ref={acctRef}>
                <button onClick={() => setAcctOpen((v) => !v)} className="flex items-center gap-2 hover:bg-gray-50 rounded-full pl-1 pr-3 py-1">
                  <span className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-bold">{initials(user?.name) || 'NV'}</span>
                  <span className="text-sm text-gray-700 whitespace-nowrap max-w-[120px] truncate">{user?.name || 'My account'}</span>
                  <ChevronDown size={15} className="text-gray-400" />
                </button>
                {acctOpen && (
                  <div className="absolute right-0 top-12 z-50 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5">
                    {user?.email && <div className="px-3 py-1.5 text-xs text-gray-400 truncate">{user.email}</div>}
                    <button onClick={() => { setAcctOpen(false); setAcctModalOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left"><User size={15} /> Account settings</button>
                    {user?.teamRole === 'pm' && <button onClick={() => { setAcctOpen(false); setTeamOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left"><Users size={15} /> Team</button>}
                    {user?.teamRole !== 'client' && <button onClick={() => { setAcctOpen(false); setConnectOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left"><Bot size={15} /> Connect to AI</button>}
                    <div className="h-px bg-gray-100 my-1" />
                    <button onClick={() => { setAcctOpen(false); onLogout && onLogout(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 text-left"><LogOut size={15} /> Logout</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* body */}
      <div className="flex-1 min-h-0 flex">
        <div className={`flex-1 relative min-w-0 ${device === 'desktop' ? '' : 'bg-gray-100 flex justify-center'}`}>
          <div ref={surfaceRef} className={device === 'desktop' ? 'absolute inset-0' : 'relative h-full bg-white shadow-xl overflow-hidden'}
               style={device === 'desktop' ? undefined : { width: device === 'tablet' ? 834 : 390, maxWidth: '100%' }} onClick={onSurfaceClick}>
            <iframe ref={iframeRef} onLoad={onIframeLoad} title={project.name} src={src} className="w-full h-full border-0 bg-white" />
            {iframeLoading && (
              <div className="absolute inset-0 z-40 bg-[#FBFCFE] flex flex-col items-center justify-center">
                <style>{`@keyframes mlpulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.65}}@keyframes mlbar{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}`}</style>
                <div style={{ animation: 'mlpulse 1.1s ease-in-out infinite' }}><BrandStar size={46} /></div>
                <div className="mt-6 w-48 h-1.5 rounded-full bg-gray-200 overflow-hidden"><div className="h-full w-2/5 rounded-full bg-[#473AE0]" style={{ animation: 'mlbar 1.1s ease-in-out infinite' }} /></div>
                <div className="mt-4 text-sm text-gray-400">Loading the site…</div>
              </div>
            )}
            {mode === 'comment' && !sameOrigin && !drawMode && <div className="absolute inset-0 cursor-crosshair" />}
            {/* drawing display layer */}
            {mode === 'comment' && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
                <defs><marker id="mk-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke" /></marker></defs>
                {(Array.isArray(selectedComment?.drawing) ? selectedComment.drawing : []).map(shapeEl)}
                {(selectedComment?.replies || []).flatMap((r) => (Array.isArray(r.drawing) ? r.drawing : [])).map(shapeEl)}
                {(draft || selectedComment) && draftShapes.map(shapeEl)}
                {liveShape && shapeEl(liveShape, 'live')}
              </svg>
            )}
            {/* draw catcher (on top) while drawing — for a new comment or a reply */}
            {mode === 'comment' && (draft || selectedComment) && drawMode && (
              <div className="absolute inset-0 z-10 cursor-crosshair" style={{ touchAction: 'none' }} onPointerDown={startDraw} onClick={(e) => e.stopPropagation()} />
            )}
            {mode === 'comment' && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {pageComments.map((c, i) => {
                const pos = pinScreen(c.x, c.y);
                return (
                <button key={c.id} onMouseDown={(e) => startPinDrag(e, c)}
                        style={{ left: pos.left, top: pos.top, background: pinBg(c) }}
                        className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-full w-7 h-7 rounded-full rounded-bl-none flex items-center justify-center text-white text-[11px] font-bold shadow-lg cursor-move transition-transform ${selectedId === c.id ? 'ring-2 ring-offset-1 ring-[#473AE0]' : ''} ${flashId === c.id ? 'scale-125 animate-pulse' : ''}`}>
                  {c.resolved ? <Check size={13} /> : i + 1}
                </button>
                );
              })}
              {draft && (
                <div className="pointer-events-auto absolute -translate-x-1/2 z-30" style={{ left: pinScreen(draft.x, draft.y).left, top: pinScreen(draft.x, draft.y).top }} onClick={(e) => e.stopPropagation()}>
                  <div className="mt-1 w-80 bg-white rounded-xl shadow-xl border border-gray-100 p-2.5">
                    {drawMode && (
                      <div className="flex items-center gap-1 mb-2 pb-2 border-b border-gray-100 flex-wrap">
                        {DRAW_TOOLS.map(([t, Icon]) => (
                          <button key={t} onClick={() => setTool(t)} title={t} className={`w-7 h-7 rounded-lg flex items-center justify-center ${tool === t ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'}`}><Icon size={15} /></button>
                        ))}
                        <div className="w-px h-5 bg-gray-200 mx-0.5" />
                        <div className="relative">
                          <button onClick={() => setColorOpen((v) => !v)} title="Color" className="w-6 h-6 rounded-full border-2 border-white ring-1 ring-gray-300" style={{ background: drawColor }} />
                          {colorOpen && (
                            <div className="absolute bottom-8 left-0 z-40 bg-white rounded-xl shadow-xl border border-gray-100 p-2 grid grid-cols-6 gap-1.5 w-44">
                              {DRAW_COLORS.map((col) => (
                                <button key={col} onClick={() => { setDrawColor(col); setColorOpen(false); }} className={`w-6 h-6 rounded-full ${drawColor === col ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`} style={{ background: col }} />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="w-px h-5 bg-gray-200 mx-0.5" />
                        <button onClick={undoShape} disabled={!draftShapes.length} title="Undo" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30"><Undo2 size={15} /></button>
                        <button onClick={redoShape} disabled={!redoShapes.length} title="Redo" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30"><Redo2 size={15} /></button>
                      </div>
                    )}
                    <div className="relative">
                      <textarea autoFocus value={draftText} onChange={(e) => onComposerType('draft', e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && mentionFor !== 'draft') { e.preventDefault(); saveDraft(); } if (e.key === 'Escape') closeDraft(); }}
                                rows={2} placeholder="Add comment here  ( @ to mention )" className="w-full resize-none outline-none text-sm placeholder-gray-400" />
                      {mentionDropdown('draft')}
                    </div>
                    {advanced && (
                      <>
                        <div className="flex items-center gap-1.5 mt-2">
                          <select value={draftType} onChange={(e) => setDraftType(e.target.value)} title="Type of change" className="flex-1 text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 outline-none text-gray-600 bg-white capitalize">
                            {C_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <select value={draftScope} onChange={(e) => setDraftScope(e.target.value)} title="How far it applies" className="flex-1 text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 outline-none text-gray-600 bg-white">
                            {C_SCOPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                        <input value={draftDesired} onChange={(e) => setDraftDesired(e.target.value)} placeholder="Desired value (optional) — e.g. padding-top: 120px, #6D28D9"
                               className="mt-1.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#473AE0] placeholder-gray-400" />
                      </>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5 relative">
                      <button onClick={() => { setEmojiOpen((v) => !v); setPrioOpen(false); }} title="Emoji" className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"><Smile size={16} /></button>
                      {emojiOpen && (
                        <div className="absolute bottom-9 left-0 bg-white rounded-xl shadow-xl border border-gray-100 p-2 grid grid-cols-8 gap-0.5 w-60 z-30">
                          {EMOJIS.map((em) => <button key={em} onClick={() => { setDraftText((t) => t + em); setEmojiOpen(false); }} className="text-lg hover:bg-gray-100 rounded">{em}</button>)}
                        </div>
                      )}
                      <button onClick={() => setDrawMode((v) => !v)} title="Draw" className={`w-7 h-7 rounded-lg flex items-center justify-center ${drawMode ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'}`}><Pencil size={16} /></button>
                      <button onClick={() => { setPrioOpen((v) => !v); setEmojiOpen(false); }} title="Priority" className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center"><CircleDot size={16} style={{ color: PRIO[draftPriority].color }} /></button>
                      {prioOpen && (
                        <div className="absolute bottom-9 left-16 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5 w-36 z-30">
                          {['high', 'medium', 'low', 'none'].map((k) => (
                            <button key={k} onClick={() => { setDraftPriority(k); setPrioOpen(false); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm text-gray-700"><span className="w-2.5 h-2.5 rounded-full" style={{ background: PRIO[k].color }} /> {PRIO[k].label}</button>
                          ))}
                        </div>
                      )}
                      {!pub && (
                        <button onClick={() => { setAttachOpen(true); setEmojiOpen(false); setPrioOpen(false); }} title="Attach files" className={`relative w-7 h-7 rounded-lg flex items-center justify-center ${draftFiles.length ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'}`}>
                          <Paperclip size={16} />
                          {draftFiles.length > 0 && <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#473AE0] text-white text-[9px] font-bold flex items-center justify-center">{draftFiles.length}</span>}
                        </button>
                      )}
                      <button onClick={() => setAdvanced((v) => !v)} title={advanced ? 'Hide advanced (AI) fields' : 'Advanced — add AI fix details'} className={`w-7 h-7 rounded-lg flex items-center justify-center ${advanced ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'}`}><SlidersHorizontal size={16} /></button>
                      <div className="ml-auto flex items-center gap-2">
                        <button onClick={closeDraft} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        <button onClick={saveDraft} disabled={!draftText.trim() && !draftShapes.length && !draftFiles.length} className="w-7 h-7 rounded-full bg-[#473AE0] text-white flex items-center justify-center disabled:opacity-40"><Send size={14} /></button>
                      </div>
                    </div>
                    {draftFiles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {draftFiles.map((f) => (
                          <div key={f.id} className="flex items-center gap-1 bg-gray-100 rounded-lg pl-1.5 pr-1 py-1 text-[11px] text-gray-700 max-w-[150px]">
                            {isImageAtt(f) ? <ImageIcon size={12} className="text-indigo-500 shrink-0" /> : <FileText size={12} className="text-indigo-500 shrink-0" />}
                            <span className="truncate">{f.name}</span>
                            <button onClick={() => removeDraftFile(f.id)} className="text-gray-400 hover:text-red-500 shrink-0"><X size={11} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* pin detail popup */}
              {!draft && selectedComment && pageComments.some((c) => c.id === selectedId) && (
                <div className="pointer-events-auto absolute -translate-x-1/2 z-20" style={{ left: pinScreen(selectedComment.x, selectedComment.y).left, top: pinScreen(selectedComment.x, selectedComment.y).top }} onClick={(e) => e.stopPropagation()}>
                  <div className="mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-3">
                    <div className="flex items-center justify-end gap-1 mb-1">
                      {!pub && <button onClick={() => toggleResolved(selectedComment)} title={selectedComment.resolved ? 'Reopen' : 'Mark done'} className={`w-7 h-7 rounded-full flex items-center justify-center ${selectedComment.resolved ? 'text-green-500 bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}><Check size={15} /></button>}
                      {!pub && <button onClick={() => { removeComment(selectedComment); }} title="Delete" className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-gray-100"><Trash2 size={14} /></button>}
                      <button onClick={() => setSelectedId(null)} title="Close" className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={15} /></button>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-gray-800">{selectedComment.author || 'You'}</span>
                      <span className="text-xs text-gray-400">{relTime(selectedComment.createdAt)}</span>
                      {!pub ? (
                        <button onClick={() => { const order = ['none', 'low', 'medium', 'high']; setPriority(selectedComment, order[(order.indexOf(selectedComment.priority || 'none') + 1) % 4]); }}
                                title="Change status" className="inline-flex items-center gap-1 text-[11px] hover:opacity-70" style={{ color: PRIO[selectedComment.priority || 'none'].color }}>
                          <CircleDot size={11} /> {PRIO[selectedComment.priority || 'none'].label}
                        </button>
                      ) : (selectedComment.priority && selectedComment.priority !== 'none' && <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: PRIO[selectedComment.priority].color }}><CircleDot size={11} /> {PRIO[selectedComment.priority].label}</span>)}
                    </div>
                    <div className={`text-sm mt-1 ${selectedComment.resolved ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{selectedComment.text}</div>
                    {advanced && commentMeta(selectedComment)}
                    {Array.isArray(selectedComment.drawing) && selectedComment.drawing.length > 0 && <div className="mt-2 text-[11px] text-indigo-500 flex items-center gap-1"><Pencil size={12} /> {selectedComment.drawing.length} annotation{selectedComment.drawing.length === 1 ? '' : 's'}</div>}
                    {renderAttachments(Array.isArray(selectedComment.attachments) ? selectedComment.attachments : [])}
                    {(selectedComment.replies || []).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100 space-y-2 max-h-40 overflow-y-auto">
                        {selectedComment.replies.map((r) => (
                          <div key={r.id} className="group/reply">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-semibold text-gray-800">{r.author || 'You'}</span>
                              <span className="text-[11px] text-gray-400">{relTime(r.createdAt)}</span>
                              {r.priority && r.priority !== 'none' && <span className="inline-flex items-center gap-0.5 text-[10px]" style={{ color: PRIO[r.priority].color }}><CircleDot size={10} /> {PRIO[r.priority].label}</span>}
                              {!pub && <button onClick={() => removeReply(selectedComment, r)} title="Delete reply" className="ml-auto text-gray-300 hover:text-red-500 opacity-0 group-hover/reply:opacity-100"><Trash2 size={12} /></button>}
                            </div>
                            {r.text && <div className="text-sm text-gray-700">{r.text}</div>}
                            {Array.isArray(r.drawing) && r.drawing.length > 0 && <div className="text-[11px] text-indigo-500 flex items-center gap-1"><Pencil size={11} /> {r.drawing.length} annotation{r.drawing.length === 1 ? '' : 's'}</div>}
                            {renderAttachments(Array.isArray(r.attachments) ? r.attachments : [])}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* reply composer — same tools as the comment composer */}
                    <div className="mt-2 rounded-lg bg-gray-50 px-2 py-1.5">
                      {drawMode && (
                        <div className="flex items-center gap-1 mb-2 pb-2 border-b border-gray-200 flex-wrap">
                          {DRAW_TOOLS.map(([t, Icon]) => (
                            <button key={t} onClick={() => setTool(t)} title={t} className={`w-7 h-7 rounded-lg flex items-center justify-center ${tool === t ? 'bg-indigo-100 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'}`}><Icon size={15} /></button>
                          ))}
                          <div className="w-px h-5 bg-gray-200 mx-0.5" />
                          <div className="relative">
                            <button onClick={() => setColorOpen((v) => !v)} title="Color" className="w-6 h-6 rounded-full border-2 border-white ring-1 ring-gray-300" style={{ background: drawColor }} />
                            {colorOpen && (
                              <div className="absolute bottom-8 left-0 z-40 bg-white rounded-xl shadow-xl border border-gray-100 p-2 grid grid-cols-6 gap-1.5 w-44">
                                {DRAW_COLORS.map((col) => (<button key={col} onClick={() => { setDrawColor(col); setColorOpen(false); }} className={`w-6 h-6 rounded-full ${drawColor === col ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`} style={{ background: col }} />))}
                              </div>
                            )}
                          </div>
                          <div className="w-px h-5 bg-gray-200 mx-0.5" />
                          <button onClick={undoShape} disabled={!draftShapes.length} title="Undo" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30"><Undo2 size={15} /></button>
                          <button onClick={redoShape} disabled={!redoShapes.length} title="Redo" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30"><Redo2 size={15} /></button>
                        </div>
                      )}
                      <div className="relative">
                        <textarea value={replyText} onChange={(e) => onComposerType('reply', e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && mentionFor !== 'reply') { e.preventDefault(); sendReply(selectedComment); } }}
                                  rows={1} placeholder="Add a reply…  ( @ to mention )" className="w-full resize-none outline-none text-sm bg-transparent placeholder-gray-400" />
                        {mentionDropdown('reply')}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 relative">
                        <button onClick={() => { setEmojiOpen((v) => !v); setPrioOpen(false); }} title="Emoji" className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"><Smile size={16} /></button>
                        {emojiOpen && (
                          <div className="absolute bottom-9 left-0 bg-white rounded-xl shadow-xl border border-gray-100 p-2 grid grid-cols-8 gap-0.5 w-60 z-30">
                            {EMOJIS.map((em) => <button key={em} onClick={() => { setReplyText((t) => t + em); setEmojiOpen(false); }} className="text-lg hover:bg-gray-100 rounded">{em}</button>)}
                          </div>
                        )}
                        <button onClick={() => setDrawMode((v) => !v)} title="Draw" className={`w-7 h-7 rounded-lg flex items-center justify-center ${drawMode ? 'bg-indigo-100 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'}`}><Pencil size={16} /></button>
                        <button onClick={() => { setPrioOpen((v) => !v); setEmojiOpen(false); }} title="Priority" className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center"><CircleDot size={16} style={{ color: PRIO[draftPriority].color }} /></button>
                        {prioOpen && (
                          <div className="absolute bottom-9 left-16 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5 w-36 z-30">
                            {['high', 'medium', 'low', 'none'].map((k) => (<button key={k} onClick={() => { setDraftPriority(k); setPrioOpen(false); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm text-gray-700"><span className="w-2.5 h-2.5 rounded-full" style={{ background: PRIO[k].color }} /> {PRIO[k].label}</button>))}
                          </div>
                        )}
                        {!pub && (
                          <button onClick={() => { setAttachOpen(true); setEmojiOpen(false); setPrioOpen(false); }} title="Attach files" className={`relative w-7 h-7 rounded-lg flex items-center justify-center ${draftFiles.length ? 'bg-indigo-100 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <Paperclip size={16} />
                            {draftFiles.length > 0 && <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#473AE0] text-white text-[9px] font-bold flex items-center justify-center">{draftFiles.length}</span>}
                          </button>
                        )}
                        <button onClick={() => sendReply(selectedComment)} disabled={!replyText.trim() && !draftShapes.length && !draftFiles.length} className="ml-auto w-7 h-7 rounded-full bg-[#473AE0] text-white flex items-center justify-center disabled:opacity-40"><Send size={13} /></button>
                      </div>
                      {draftFiles.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {draftFiles.map((f) => (
                            <div key={f.id} className="flex items-center gap-1 bg-gray-100 rounded-lg pl-1.5 pr-1 py-1 text-[11px] text-gray-700 max-w-[150px]">
                              {isImageAtt(f) ? <ImageIcon size={12} className="text-indigo-500 shrink-0" /> : <FileText size={12} className="text-indigo-500 shrink-0" />}
                              <span className="truncate">{f.name}</span>
                              <button onClick={() => removeDraftFile(f.id)} className="text-gray-400 hover:text-red-500 shrink-0"><X size={11} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>

        {/* comments panel (comment mode only) */}
        {mode === 'comment' && (
        <div className="w-72 shrink-0 bg-white border-l border-gray-100 flex flex-col">
          {/* tabs + toolbar */}
          <div className="px-4 pt-3 border-b border-gray-100">
            <div className="flex items-center">
              <button onClick={() => setPanelTab('active')} className={`pb-2 mr-4 text-sm ${panelTab === 'active' ? 'text-gray-800 font-semibold border-b-2 border-gray-800' : 'text-gray-400'}`}>{activeCount} Active</button>
              <button onClick={() => setPanelTab('resolved')} className={`pb-2 text-sm ${panelTab === 'resolved' ? 'text-gray-800 font-semibold border-b-2 border-gray-800' : 'text-gray-400'}`}>{resolvedCount} Resolved</button>
              <div className="ml-auto flex items-center gap-1 pb-1.5 relative">
                <button onClick={() => setPanelSort((s) => (s === 'newest' ? 'oldest' : 'newest'))} title={`Sort: ${panelSort}`} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100"><ArrowUpDown size={15} /></button>
                <button onClick={() => { setPanelFilterOpen((v) => !v); setPanelSearchOpen(false); }} title={filterActive ? 'Filter (active)' : 'Filter'} className={`relative w-7 h-7 rounded-lg flex items-center justify-center ${panelFilterOpen || filterActive ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'}`}>
                  <Filter size={15} />
                  {filterActive && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#473AE0] ring-2 ring-white" />}
                </button>
                <button onClick={() => { setPanelSearchOpen((v) => !v); setPanelFilterOpen(false); }} title="Search" className={`w-7 h-7 rounded-lg flex items-center justify-center ${panelSearchOpen ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'}`}><Search size={15} /></button>
                {panelFilterOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setPanelFilterOpen(false)} />
                    <div className="absolute right-0 top-9 z-40 w-52 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5 text-sm">
                      <div className="px-2 py-1 text-[11px] font-semibold text-gray-400 uppercase">Show</div>
                      {[['page', 'On this page'], ['version', 'This version'], ['all', 'All versions']].map(([k, label]) => (
                        <button key={k} onClick={() => setPanelScope(k)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left">
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${panelScope === k ? 'border-[#473AE0] bg-[#473AE0]' : 'border-gray-300'}`}>{panelScope === k && <Check size={11} className="text-white" />}</span>{label}
                        </button>
                      ))}
                      <div className="h-px bg-gray-100 my-1" />
                      <div className="px-2 py-1 text-[11px] font-semibold text-gray-400 uppercase">Priority</div>
                      <div className="flex flex-wrap gap-1 px-1 pb-1">
                        {['all', 'high', 'medium', 'low', 'none'].map((k) => (
                          <button key={k} onClick={() => setPanelPriority(k)} className={`px-2 py-1 rounded-full text-xs capitalize ${panelPriority === k ? 'bg-[#473AE0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{k}</button>
                        ))}
                      </div>
                      {!pub && user?.id && (
                        <>
                          <div className="h-px bg-gray-100 my-1" />
                          <button onClick={() => setPanelMentionsMe((v) => !v)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left text-sm">
                            <span className={`w-4 h-4 rounded border flex items-center justify-center ${panelMentionsMe ? 'border-[#473AE0] bg-[#473AE0]' : 'border-gray-300'}`}>{panelMentionsMe && <Check size={11} className="text-white" />}</span>
                            Mentions me
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            {(deviceCounts.desktop + deviceCounts.tablet + deviceCounts.mobile) > 0 && (
              <div className="flex items-center gap-3 pb-2 text-[11px] text-gray-400">
                {[['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]].map(([d, Icon]) => (
                  <span key={d} title={`${deviceCounts[d]} comment${deviceCounts[d] === 1 ? '' : 's'} on ${d}`} className={`flex items-center gap-1 ${deviceCounts[d] ? 'text-gray-500' : 'opacity-40'}`}><Icon size={13} /> {deviceCounts[d]}</span>
                ))}
              </div>
            )}
            {panelSearchOpen && (
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2 py-1.5 mb-2">
                <Search size={14} className="text-gray-400" />
                <input autoFocus value={panelSearch} onChange={(e) => setPanelSearch(e.target.value)} placeholder="Search comments…" className="flex-1 bg-transparent outline-none text-sm" />
                {panelSearch && <button onClick={() => setPanelSearch('')}><X size={13} className="text-gray-400" /></button>}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {panelList.length === 0 && <div className="text-center text-sm text-gray-400 mt-10"><MessageSquare size={20} className="mx-auto mb-2 opacity-50" />No {panelTab} comments.</div>}
            {panelList.map((c) => (
              <div key={c.id} onClick={() => focusComment(c)} className={`rounded-xl border p-2.5 cursor-pointer ${selectedId === c.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-100 hover:border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: pinBg(c) }}>{c.resolved ? '✓' : (c.priority && c.priority !== 'none' ? '!' : '•')}</span>
                  <span className="text-xs font-semibold text-gray-700 truncate">{c.author || 'You'}</span>
                  <span className="text-[11px] text-gray-400 shrink-0">{relTime(c.createdAt)}</span>
                  {(() => { const I = c.device === 'mobile' ? Smartphone : c.device === 'tablet' ? Tablet : Monitor; return <I size={11} className="text-gray-300 shrink-0" title={`Left on ${c.device || 'desktop'}`} />; })()}
                  {(c.attachments || []).length > 0 && <span className="flex items-center gap-0.5 text-[10px] text-gray-400 shrink-0"><Paperclip size={10} />{c.attachments.length}</span>}
                  {!pub && (
                    <div className="ml-auto flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); const order = ['none', 'low', 'medium', 'high']; setPriority(c, order[(order.indexOf(c.priority || 'none') + 1) % 4]); }}
                              title={`Status: ${PRIO[c.priority || 'none'].label}`} className="hover:opacity-70"><CircleDot size={13} style={{ color: PRIO[c.priority || 'none'].color }} /></button>
                      <button onClick={(e) => { e.stopPropagation(); toggleResolved(c); }} title={c.resolved ? 'Reopen' : 'Mark done'} className={c.resolved ? 'text-green-500' : 'text-gray-300 hover:text-green-500'}><Check size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); removeComment(c); }} title="Delete" className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
                <div className={`text-sm ${c.resolved ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{c.text}</div>
                {advanced && commentMeta(c)}
                {panelScope !== 'page' && <div className="text-[11px] text-gray-400 mt-1 truncate">{c.versionLabel || ''}{c.page ? ` · ${shortPage(c.page)}` : ''}</div>}
                {selectedId === c.id && (
                  <div onClick={(e) => e.stopPropagation()}>
                    {(c.drawing || []).length > 0 && <div className="mt-2 text-[11px] text-indigo-500 flex items-center gap-1"><Pencil size={12} /> {c.drawing.length} annotation{c.drawing.length === 1 ? '' : 's'}</div>}
                    {renderAttachments(c.attachments)}
                    {(c.replies || []).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100 space-y-2 max-h-44 overflow-y-auto">
                        {c.replies.map((r) => (
                          <div key={r.id}>
                            <div className="flex items-baseline gap-2"><span className="text-xs font-semibold text-gray-800">{r.author || 'You'}</span><span className="text-[11px] text-gray-400">{relTime(r.createdAt)}</span></div>
                            <div className="text-sm text-gray-700">{r.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
                      <input value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendReply(c); }}
                             placeholder="Add a reply…" className="flex-1 bg-transparent outline-none text-sm placeholder-gray-400" />
                      <button onClick={() => sendReply(c)} disabled={!replyText.trim()} className="w-7 h-7 rounded-full bg-[#473AE0] text-white flex items-center justify-center disabled:opacity-40"><Send size={13} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {acctModalOpen && <Account user={user || {}} onClose={() => setAcctModalOpen(false)} onUpdated={(u) => onUserChange && onUserChange(u)} onLogout={onLogout} />}
      {teamOpen && <Team user={user} onClose={() => setTeamOpen(false)} />}

      {acSettingsOpen && project && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setAcSettingsOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-80 bg-white border-l border-gray-100 shadow-xl z-[60] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
              <span className="font-semibold text-gray-800">Project settings</span>
              <button onClick={() => setAcSettingsOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="flex items-center gap-8 px-5 border-b border-gray-100">
              <button title="Active Collab" className="py-3 text-gray-800 border-b-2 border-gray-800"><AcIcon size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ActiveCollabField
                acProjectId={project.acProjectId || ''}
                acProjectName={project.acProjectName || ''}
                onSave={async (acId) => { const updated = await setMarkupActiveCollab(project.id, acId); setProject((p) => (p ? { ...p, ...updated } : p)); return updated; }}
              />
            </div>
          </div>
        </>
      )}

      {/* Active Collab sync modal (pages = tasks, comments = subtasks) */}
      {acSyncOpen && project && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-6" onMouseDown={() => setAcSyncOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <RefreshCw size={18} className="text-[#473AE0]" />
                <h2 className="text-lg font-bold text-gray-800">Synchronize with Active Collab</h2>
              </div>
              <button onClick={() => setAcSyncOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
            </div>
            {!project.acProjectId ? (
              <div className="px-6 py-10 text-center">
                <div className="text-sm text-gray-600">No Active Collab project assigned.</div>
                <button onClick={() => { setAcSyncOpen(false); setAcSettingsOpen(true); }} className="mt-3 text-sm font-medium text-[#473AE0] hover:underline">Assign a project →</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
                  <div className="text-xs text-gray-500 truncate pr-2">Each page → task, each comment → subtask.</div>
                  <button onClick={syncAcAll} disabled={Object.keys(acSyncBusy).length > 0 || !acPages.length}
                          className="shrink-0 flex items-center gap-1.5 bg-[#473AE0] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-[#3a2fc0] disabled:opacity-50"><RefreshCw size={14} /> Sync all</button>
                </div>
                {acSyncErr && <div className="px-6 py-2 text-xs text-red-500">{acSyncErr}</div>}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {acPages.length === 0 && <div className="text-center text-sm text-gray-400 py-8">No comments to sync yet.</div>}
                  {acPages.map((pg) => {
                    const t = acTasks[pg.key];
                    const pBusy = !!acSyncBusy['p:' + pg.key];
                    return (
                      <div key={pg.key || '_home'} className="rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-t-xl">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{pg.title}</div>
                            <div className="text-[11px] text-gray-400">{pg.comments.length} comment{pg.comments.length === 1 ? '' : 's'}{t ? ` · Task #${t.taskNumber || t.taskId}` : ''}</div>
                          </div>
                          {t && !pBusy && <Check size={14} className="text-green-500 shrink-0" />}
                          <button onClick={() => syncAcPageWithComments(pg)} disabled={pBusy} title={t ? 'Re-sync page + comments' : 'Sync page + comments'}
                                  className="shrink-0 flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700 hover:border-[#473AE0] hover:text-[#473AE0] disabled:opacity-50">
                            {pBusy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}{t ? 'Re-sync' : 'Sync'}
                          </button>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {pg.comments.map((c) => {
                            const cBusy = !!acSyncBusy['c:' + c.id];
                            const cSynced = !!c.acSubtaskId;
                            return (
                              <div key={c.id} className="flex items-center gap-2 px-3 py-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0 ml-1" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-gray-700 truncate">{c.text || '(drawing)'}</div>
                                  <div className="text-[10px] text-gray-400">{c.author || 'User'}{cSynced ? ` · Subtask #${c.acSubtaskNumber || c.acSubtaskId}` : ''}</div>
                                </div>
                                {cSynced && !cBusy && <Check size={13} className="text-green-500 shrink-0" />}
                                <button onClick={() => syncAcComment(pg, c)} disabled={cBusy} title={cSynced ? 'Re-sync comment' : 'Sync comment'}
                                        className="shrink-0 text-gray-400 hover:text-[#473AE0] disabled:opacity-50">
                                  {cBusy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {connectOpen && <ConnectAI onClose={() => setConnectOpen(false)} />}

      {/* Attach Files modal — drag-drop / browse, then stage on the current comment draft */}
      {attachOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-6" onMouseDown={() => setAttachOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-7 relative" onMouseDown={(e) => e.stopPropagation()}>
            <button onClick={() => setAttachOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
            <h2 className="text-xl font-bold text-gray-800 text-center">{draftFiles.length ? `${draftFiles.length} Attached File${draftFiles.length === 1 ? '' : 's'}` : 'Attach Files'}</h2>
            {draftFiles.length > 0 && <p className="text-center text-sm text-gray-500 mt-1">Heads up: Larger files can take longer to process.</p>}

            {draftFiles.length === 0 ? (
              <label
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); addAttachments(e.dataTransfer.files); }}
                className="mt-5 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl py-14 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
                <input type="file" multiple accept={ATTACH_ACCEPT} className="hidden" onChange={(e) => { addAttachments(e.target.files); e.target.value = ''; }} />
                {attachBusy ? <BrandStar size={34} /> : <Upload size={34} className="text-gray-400" />}
                <div className="mt-3 text-sm text-gray-500">{attachBusy ? 'Uploading…' : 'Drag & drop files here, or click to browse'}</div>
              </label>
            ) : (
              <div className="mt-5 space-y-2">
                {draftFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3">
                    <Check size={18} className="text-green-500 shrink-0" />
                    <span className="flex-1 truncate text-sm text-gray-700">{f.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{prettySize(f.size)}</span>
                    <button onClick={() => removeDraftFile(f.id)} className="text-gray-400 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
                  </div>
                ))}
                <label className="mt-2 inline-flex items-center gap-2 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
                  <input type="file" multiple accept={ATTACH_ACCEPT} className="hidden" onChange={(e) => { addAttachments(e.target.files); e.target.value = ''; }} />
                  <Plus size={16} /> Add More Files
                </label>
              </div>
            )}

            {attachErr && <div className="mt-3 text-center text-xs text-red-500">{attachErr}</div>}
            <p className="mt-5 text-center text-xs text-gray-400">Supports: JPG, JPEG, PNG, SVG, BMP, GIF, PDF, PSD, AI, EPS, TIFF, RTF, TXT, DOCX, PAGES, ODT, PPTX, ODP, KEY, XLSX, CSV, MP4</p>

            {draftFiles.length > 0 && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <button onClick={() => { setDraftFiles([]); setAttachOpen(false); }} className="border border-gray-300 rounded-xl px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={() => setAttachOpen(false)} className="bg-[#473AE0] text-white rounded-xl px-7 py-2.5 text-sm font-medium hover:bg-[#3a2fc0]">Save</button>
              </div>
            )}
          </div>
        </div>
      )}

      {nameGate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-6" onMouseDown={() => guestName && setNameGate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800">What's your name?</h2>
            <p className="text-sm text-gray-500 mt-1 mb-4">It'll be shown on the comments you leave.</p>
            <input autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter' && nameInput.trim()) { const n = nameInput.trim(); try { localStorage.setItem('qoders-markup-name', n); } catch (er) {} setGuestName(n); setNameGate(false); } }}
                   placeholder="Your name" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-300" />
            <button onClick={() => { const n = nameInput.trim(); if (!n) return; try { localStorage.setItem('qoders-markup-name', n); } catch (er) {} setGuestName(n); setNameGate(false); }}
                    disabled={!nameInput.trim()} className="mt-4 w-full bg-[#473AE0] text-white rounded-full py-2.5 text-sm font-medium hover:bg-[#3a2fc0] disabled:opacity-50">Continue</button>
          </div>
        </div>
      )}

      {shareOpen && (() => {
        const shareLink = `${window.location.origin}/#/markup/view/${id}`;
        const copyLink = () => { try { navigator.clipboard?.writeText(shareLink); } catch (e) {} setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1500); };
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={() => setShareOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">Share</h2>
              <button onClick={() => setShareOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center shrink-0"><X size={16} /></button>
            </div>
            <div className="px-6 pt-4 pb-6">
            <div className="flex items-center gap-5 border-b border-gray-100">
              <button onClick={() => setShareTab('link')} className={`pb-2 text-sm font-medium ${shareTab === 'link' ? 'text-[#473AE0] border-b-2 border-[#473AE0]' : 'text-gray-500'}`}>Share link</button>
              <button onClick={() => setShareTab('people')} className={`pb-2 text-sm font-medium flex items-center gap-1.5 ${shareTab === 'people' ? 'text-[#473AE0] border-b-2 border-[#473AE0]' : 'text-gray-500'}`}><Users size={14} /> Invite people</button>
            </div>
            {shareTab === 'link' ? (
              <div className="mt-5">
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Share link</div>
                  <div className="flex items-center gap-2">
                    <input readOnly value={shareLink} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 outline-none" />
                    <button onClick={copyLink} className="shrink-0 w-10 h-10 rounded-lg bg-[#473AE0] text-white flex items-center justify-center hover:bg-[#3a2fc0]">{linkCopied ? <Check size={16} /> : <Copy size={16} />}</button>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">Anyone with the link can comment using just their name — no account needed.</div>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <p className="text-sm text-gray-500 mb-4">Invite people by email — they get access as soon as they sign up.</p>
                <InvitePanel projectId={id} api={MEMBER_API} />
              </div>
            )}
            </div>
          </div>
        </div>
        );
      })()}

      {addOpen && (
        <AddVersionModal projectId={id} onClose={() => setAddOpen(false)} setBusy={setBusy}
                         onAdded={async () => { setAddOpen(false); await reloadVersions(true); }} />
      )}
      {busy && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center">
            <style>{`@keyframes vpulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.7}}`}</style>
            <div style={{ animation: 'vpulse 1.1s ease-in-out infinite' }}><BrandStar size={40} /></div>
            <div className="mt-4 text-sm font-medium text-gray-700">{busy}</div>
          </div>
        </div>
      )}
      {err && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white text-sm rounded-full px-4 py-2 shadow-lg">{err}</div>}
    </div>
  );
}

