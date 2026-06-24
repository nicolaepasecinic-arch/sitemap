import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Plus, Copy, Trash2, ChevronDown, Settings, Users, Bot, LogOut, Play, Download, Pencil,
} from 'lucide-react';
import BrandStar from '../components/Brand';
import Account from '../components/Account';
import Team from '../components/Team';
import ConnectAI from '../components/ConnectAI';
import InvitePanel from '../components/InvitePanel';
import ActiveCollabField from '../components/ActiveCollabField';
import { initials } from '../auth';
import { getBoard, saveBoard } from './boardStore';
import { hasBackend, apiListBoardMembers, apiAddBoardMember, apiRemoveBoardMember, apiRemoveBoardInvite, apiSetBoardActiveCollab, downloadBoardPdf } from './boardApi';
import BlockEditor from './BlockEditor';

const uid = () => Math.random().toString(36).slice(2, 9);

// A4 portrait at 96dpi (210 × 297 mm). Default page size; the aspect ratio is kept on resize.
const A4_W = 794;
const A4_RATIO = 297 / 210;
const clampW = (w) => Math.round(Math.max(420, Math.min(1400, w)));

const BOARD_MEMBER_API = {
  listMembers: apiListBoardMembers,
  addMember: apiAddBoardMember,
  removeMember: apiRemoveBoardMember,
  removeInvite: apiRemoveBoardInvite,
};

// Convert a legacy free-canvas element into BlockNote blocks (used when migrating old boards).
function elementToBlocks(el) {
  if (!el) return [];
  if (el.type === 'image' && el.url) return [{ type: 'image', props: { url: el.url, previewWidth: 512 } }];
  if (el.type === 'note') return [{ type: 'callout', props: {}, content: el.text ? [{ type: 'text', text: el.text, styles: {} }] : [] }];
  if (el.type === 'link') return [{ type: 'bookmark', props: { url: el.url || '', title: el.title || el.url || '', host: el.host || el.url || '' } }];
  if (el.type === 'file') return (el.files || []).map((f) => ({ type: 'bookmark', props: { url: f.url || '', title: f.name || 'File', host: '' } }));
  return [];
}

// Normalize a board's stored items into the new page model: [{ id, name, doc }].
function normalizePages(items) {
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return [{ id: uid(), name: 'Page 1', doc: undefined }];
  // already pages?
  if (arr.every((p) => p && typeof p === 'object' && !('type' in p) && ('doc' in p || 'name' in p))) {
    return arr.map((p) => ({ id: p.id || uid(), name: p.name || 'Page', doc: Array.isArray(p.doc) ? p.doc : undefined }));
  }
  // legacy free-canvas → pages (text elements become pages; other elements append as blocks)
  const texts = arr.filter((e) => e && e.type === 'text').sort((a, b) => (a.y || 0) - (b.y || 0));
  const media = arr.filter((e) => e && e.type && e.type !== 'text').sort((a, b) => (a.y || 0) - (b.y || 0));
  const pages = texts.map((t, i) => ({ id: t.id || uid(), name: `Page ${i + 1}`, doc: Array.isArray(t.doc) ? t.doc : undefined }));
  if (!pages.length) pages.push({ id: uid(), name: 'Page 1', doc: undefined });
  const extra = [];
  for (const m of media) extra.push(...elementToBlocks(m));
  if (extra.length) { const p0 = pages[0]; p0.doc = [...(Array.isArray(p0.doc) ? p0.doc : []), ...extra]; }
  return pages;
}

function PageCard({ page, index, total, readOnly, onRename, onChange, onDuplicate, onDelete, onResizeWidth }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(page.name || '');
  const commit = () => { setRenaming(false); onRename((draft.trim() || `Page ${index + 1}`)); };
  const width = page.w || A4_W;
  const minHeight = Math.round(width * A4_RATIO);
  const isA4 = Math.abs(width - A4_W) < 2;

  const startResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    const card = e.currentTarget.closest('[data-page-card]');
    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const move = (ev) => onResizeWidth(clampW(2 * (ev.clientX - centerX)));
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); document.body.style.cursor = ''; };
    document.body.style.cursor = 'ew-resize';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className="mx-auto mb-8 group/page" style={{ width }} data-page-card>
      {/* page header */}
      <div className="flex items-center gap-2 mb-2 px-1 group">
        <span className="text-xs font-semibold text-gray-400">{index + 1}</span>
        {renaming && !readOnly ? (
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
                 onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(page.name || ''); setRenaming(false); } }}
                 className="text-sm font-medium text-gray-700 bg-white border border-indigo-300 rounded px-2 py-0.5 outline-none" />
        ) : (
          <button onClick={() => { if (!readOnly) { setDraft(page.name || ''); setRenaming(true); } }}
                  className="text-sm font-medium text-gray-700 hover:text-[#473AE0] flex items-center gap-1">
            {page.name || `Page ${index + 1}`}
            {!readOnly && <Pencil size={12} className="text-gray-300 group-hover:text-gray-400" />}
          </button>
        )}
        {!readOnly && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-gray-300 group-hover:text-gray-400">{isA4 ? 'A4' : `${width}px`}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
              {!isA4 && <button onClick={() => onResizeWidth(A4_W)} title="Reset to A4" className="text-[11px] px-2 h-6 rounded-lg text-gray-500 hover:bg-gray-100">A4</button>}
              <button onClick={onDuplicate} title="Duplicate page" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Copy size={15} /></button>
              <button onClick={onDelete} disabled={total <= 1} title="Delete page" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"><Trash2 size={15} /></button>
            </div>
          </div>
        )}
      </div>
      {/* page body */}
      <div className="relative">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden board-rte" style={{ minHeight }}>
          <BlockEditor initialContent={page.doc} editable={!readOnly} onChange={(doc) => onChange(doc)} />
        </div>
        {!readOnly && (
          <div onMouseDown={startResize} title="Drag to resize page"
               className="absolute top-0 -right-2.5 h-full w-5 flex items-center justify-center cursor-ew-resize opacity-0 group-hover/page:opacity-100">
            <span className="w-1.5 h-14 rounded-full bg-gray-300 hover:bg-[#473AE0] transition-colors" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PageEditor({ id, board: boardProp, user, onBack, onLogout, onUserChange, readOnly = false, embedded = false }) {
  const [board, setBoard] = useState(boardProp || null);
  const [pages, setPages] = useState(() => normalizePages(boardProp?.items));
  const [name, setName] = useState(boardProp?.name || 'Untitled project');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [acctMenuOpen, setAcctMenuOpen] = useState(false);
  const [acctModalOpen, setAcctModalOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [connectAiOpen, setConnectAiOpen] = useState(false);
  const firstSave = useRef(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (boardProp) return;
    let active = true;
    getBoard(id).then((b) => {
      if (!active || !b) return;
      setBoard(b); setPages(normalizePages(b.items)); setName(b.name || 'Untitled project');
    });
    return () => { active = false; };
  }, [id, boardProp]);

  // debounced persist
  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return; }
    if (readOnly || !board) return;
    const t = setTimeout(() => saveBoard(board.id, { items: pages }), 600);
    return () => clearTimeout(t);
  }, [pages]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPageDoc = (pid, doc) => setPages((ps) => ps.map((p) => (p.id === pid ? { ...p, doc } : p)));
  const setPageName = (pid, nm) => setPages((ps) => ps.map((p) => (p.id === pid ? { ...p, name: nm } : p)));
  const setPageWidth = (pid, w) => setPages((ps) => ps.map((p) => (p.id === pid ? { ...p, w } : p)));
  const addPage = () => {
    setPages((ps) => [...ps, { id: uid(), name: `Page ${ps.length + 1}`, doc: undefined }]);
    setTimeout(() => bottomRef.current && bottomRef.current.scrollIntoView({ behavior: 'smooth' }), 60);
  };
  const duplicatePage = (idx) => setPages((ps) => {
    const src = ps[idx]; if (!src) return ps;
    const copy = { id: uid(), name: `${src.name} copy`, doc: src.doc ? JSON.parse(JSON.stringify(src.doc)) : undefined };
    const next = [...ps]; next.splice(idx + 1, 0, copy); return next;
  });
  const deletePage = (idx) => setPages((ps) => (ps.length <= 1 ? ps : ps.filter((_, i) => i !== idx)));

  const commitName = () => {
    const n = name.trim() || 'Untitled project';
    setName(n);
    if (!readOnly && board) saveBoard(board.id, { name: n });
  };
  const handlePdf = async () => {
    if (!board || pdfBusy) return;
    setPdfBusy(true);
    try { await downloadBoardPdf(board.id); }
    catch (e) { window.alert(e.message || 'Could not generate the PDF'); }
    setPdfBusy(false);
  };

  return (
    <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 bg-[#F1F3F7] flex flex-col`}
         style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* ---------- Top bar ---------- */}
      {!embedded && (
      <div className="h-14 shrink-0 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-2">
          <button onClick={onBack} title="Back to projects" className="w-9 h-9 rounded-full hover:bg-gray-50 flex items-center justify-center text-gray-600"><ArrowLeft size={17} /></button>
          <button onClick={onBack} className="w-9 h-9 rounded-lg hover:bg-gray-50 flex items-center justify-center"><BrandStar size={22} /></button>
          <input value={name} readOnly={readOnly}
                 onChange={(e) => !readOnly && setName(e.target.value)} onBlur={commitName}
                 onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                 className="text-[15px] font-semibold text-[#473AE0] bg-transparent outline-none focus:bg-gray-50 focus:ring-1 focus:ring-indigo-200 rounded px-1 w-56" />
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2">
            {hasBackend() && (
              <button onClick={() => setShareOpen(true)} className="flex items-center gap-1 bg-[#473AE0] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-indigo-600">
                Share <Play size={13} className="ml-1" fill="white" />
              </button>
            )}
            {hasBackend() && (
              <button onClick={handlePdf} disabled={pdfBusy} title="Download all pages as PDF"
                      className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-50"><Download size={16} className={pdfBusy ? 'animate-pulse' : ''} /></button>
            )}
            {hasBackend() && (
              <button onClick={() => setSettingsOpen(true)} title="Project settings"
                      className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Settings size={16} /></button>
            )}
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
      </div>
      )}

      {/* ---------- Pages ---------- */}
      <div className="flex-1 overflow-y-auto py-10 px-4">
        {pages.map((p, i) => (
          <PageCard key={p.id} page={p} index={i} total={pages.length} readOnly={readOnly}
            onRename={(nm) => setPageName(p.id, nm)}
            onChange={(doc) => setPageDoc(p.id, doc)}
            onResizeWidth={(w) => setPageWidth(p.id, w)}
            onDuplicate={() => duplicatePage(i)}
            onDelete={() => deletePage(i)} />
        ))}
        {!readOnly && (
          <div className="w-full max-w-[820px] mx-auto" ref={bottomRef}>
            <button onClick={addPage}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-gray-300 bg-white/60 text-gray-600 hover:border-[#473AE0] hover:text-[#473AE0] hover:bg-white transition text-sm font-medium">
              <Plus size={17} /> Add page
            </button>
          </div>
        )}
      </div>

      {/* ---------- Project settings (right drawer) ---------- */}
      {settingsOpen && board && (
        <div className="fixed inset-0 z-50" onMouseDown={() => setSettingsOpen(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <style>{`@keyframes qdrawer{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
          <div className="absolute top-0 right-0 h-full w-[380px] max-w-[92vw] bg-white shadow-2xl flex flex-col"
               style={{ animation: 'qdrawer .22s ease-out' }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-14 shrink-0 px-5 flex items-center justify-between border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Project settings</h2>
              <button onClick={() => setSettingsOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center shrink-0"><Plus size={16} className="rotate-45" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 truncate">{name}</div>
              <ActiveCollabField
                acProjectId={board.acProjectId || ''}
                acProjectName={board.acProjectName || ''}
                onSave={async (acId) => { const updated = await apiSetBoardActiveCollab(board.id, acId); setBoard((b) => (b ? { ...b, ...updated } : b)); return updated; }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ---------- Share modal ---------- */}
      {shareOpen && board && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={() => setShareOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-xl font-bold text-gray-800">Share “{name}”</h2>
              <button onClick={() => setShareOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><Plus size={16} className="rotate-45" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Invite people by email — they get access as soon as they sign up.</p>
            <InvitePanel projectId={board.id} api={BOARD_MEMBER_API} />
          </div>
        </div>
      )}

      {acctModalOpen && <Account user={user || {}} onClose={() => setAcctModalOpen(false)} onUpdated={(u) => onUserChange && onUserChange(u)} onLogout={onLogout} />}
      {teamOpen && <Team user={user} onClose={() => setTeamOpen(false)} />}
      {connectAiOpen && <ConnectAI onClose={() => setConnectAiOpen(false)} />}
    </div>
  );
}
