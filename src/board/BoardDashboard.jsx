import React, { useState, useEffect, useRef } from 'react';
import { Settings, Copy, Trash2, Pencil, X, ChevronDown, LogOut, CheckCircle2, Circle, Share2, Users, FilePlus2, Search, Archive, ArchiveRestore, FileText } from 'lucide-react';
import {
  listBoards, createBoard, duplicateBoard, deleteBoard, renameBoard, archiveBoard, completeBoard,
} from './boardStore';
import { hasBackend, apiListBoardMembers, apiAddBoardMember, apiRemoveBoardMember, apiRemoveBoardInvite, apiVerifyBoardActiveCollab } from './boardApi';
import InvitePanel from '../components/InvitePanel';
import ActiveCollabField from '../components/ActiveCollabField';

const BOARD_MEMBER_API = {
  listMembers: apiListBoardMembers,
  addMember: apiAddBoardMember,
  removeMember: apiRemoveBoardMember,
  removeInvite: apiRemoveBoardInvite,
};

function relTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return new Date(ts).toLocaleDateString();
}

// number of pages in a board (new page model, or legacy text-element count)
const pagesOf = (items) => {
  const list = Array.isArray(items) ? items : [];
  return list.length && list.every((i) => i && !('type' in i)) ? list.length : Math.max(1, list.filter((i) => i && i.type === 'text').length);
};
const fmtDate = (ts) => { try { return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };

function CardMenu({ onRename, onDuplicate, onShare, canShare, onComplete, completed, onArchive, archived, onDelete, shared, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [onClose]);
  const item = 'w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-gray-50 text-left whitespace-nowrap';
  return (
    <div ref={ref} className="absolute right-2 top-9 z-20 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5"
         onClick={(e) => e.stopPropagation()}>
      <button className={item + ' text-gray-700'} onClick={onRename}><Pencil size={15} /> Rename</button>
      {canShare && <button className={item + ' text-gray-700'} onClick={onShare}><Share2 size={15} /> Share</button>}
      <button className={item + ' text-gray-700'} onClick={onDuplicate}><Copy size={15} /> Duplicate</button>
      <button className={item + ' text-gray-700'} onClick={onComplete}>
        {completed ? <><Circle size={15} /> Mark as active</> : <><CheckCircle2 size={15} /> Mark as complete</>}
      </button>
      <button className={item + ' text-gray-700'} onClick={onArchive}>
        {archived ? <><ArchiveRestore size={15} /> Restore</> : <><Archive size={15} /> Archive</>}
      </button>
      <div className="h-px bg-gray-100 my-1" />
      <button className={item + ' text-red-500'} onClick={onDelete}>
        {shared ? <><LogOut size={15} /> Leave project</> : <><Trash2 size={15} /> Delete</>}
      </button>
    </div>
  );
}

/* New-project popup: asks for a Name and (optionally) links an existing Active Collab
   project by ID. The AC field reuses the shared ActiveCollabField + AC backend client. */
function NewProjectModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [ac, setAc] = useState({ acProjectId: '', acProjectName: '' });
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try { await onCreate(name.trim() || 'Untitled project', ac); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={busy ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">New project</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1.5">Project name</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
               placeholder="e.g. Acme website redesign"
               className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-300 mb-5" />

        {hasBackend() ? (
          <ActiveCollabField
            acProjectId={ac.acProjectId}
            acProjectName={ac.acProjectName}
            onSave={async (acId) => {
              const r = await apiVerifyBoardActiveCollab(acId);
              setAc({ acProjectId: r.acProjectId || '', acProjectName: r.acProjectName || '' });
              return r;
            }}
          />
        ) : (
          <p className="text-xs text-gray-400">Active Collab linking needs the backend running.</p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} disabled={busy} className="px-5 py-2.5 rounded-full text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">Cancel</button>
          <button onClick={create} disabled={busy} className="px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-[#473AE0] hover:bg-[#3a2fc0] disabled:opacity-50">Create project</button>
        </div>
      </div>
    </div>
  );
}

/* Share a board with other Qoders accounts (by email). Owner-only. */
function ShareModal({ board, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-bold text-gray-800">Share “{board.name}”</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Invite people by email — they get access as soon as they sign up.</p>
        <InvitePanel projectId={board.id} api={BOARD_MEMBER_API} />
      </div>
    </div>
  );
}

export default function BoardDashboard({ onOpen }) {
  const [boards, setBoards] = useState([]);
  const [menuId, setMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('boards-sort') || 'updated');
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState('active'); // active | completed | archived
  const [scope, setScope] = useState('all'); // all | mine | shared
  const [query, setQuery] = useState('');
  const [shareBoard, setShareBoard] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const setSort = (s) => { setSortBy(s); setSortOpen(false); try { localStorage.setItem('boards-sort', s); } catch (e) {} };
  const SORT_LABEL = { name: 'Alphabetically', created: 'Date created', updated: 'Last updated' };

  const inView = (p) => {
    if (viewMode === 'archived') return !!p.archived;
    if (p.archived) return false;
    if (viewMode === 'completed') return !!p.completed;
    return !p.completed;
  };
  const sortedBoards = [...boards]
    .filter(inView)
    .filter((p) => (scope === 'all' ? true : scope === 'shared' ? !!p.shared : !p.shared))
    .filter((p) => (query.trim() ? (p.name || '').toLowerCase().includes(query.trim().toLowerCase()) : true))
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'created') return (b.createdAt || b.updatedAt || 0) - (a.createdAt || a.updatedAt || 0);
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  const archivedCount = boards.filter((p) => p.archived).length;
  const completedCount = boards.filter((p) => p.completed && !p.archived).length;

  const refresh = () => listBoards().then(setBoards).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const handleCreate = async (name, ac) => {
    const p = await createBoard(name, ac);
    setNewOpen(false);
    onOpen(p.id);
  };
  const handleDuplicate = async (id) => { await duplicateBoard(id); setMenuId(null); refresh(); };
  const handleArchive = async (id, archived) => { await archiveBoard(id, archived); setMenuId(null); refresh(); };
  const handleComplete = async (id, completed) => { await completeBoard(id, completed); setMenuId(null); refresh(); };
  const handleDelete = (id) => {
    const p = boards.find((x) => x.id === id);
    setDeleteTarget(p || { id, name: 'this project' });
    setMenuId(null);
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteBoard(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  };
  const startRename = (p) => { setRenamingId(p.id); setDraft(p.name); setMenuId(null); };
  const commitRename = async (id) => {
    await renameBoard(id, draft.trim() || 'Untitled project');
    setRenamingId(null);
    refresh();
  };

  return (
    <div className="absolute inset-0 flex bg-[#FBFCFE]"
         style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* left sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="px-3 pt-1 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Create</div>
          <button onClick={() => setNewOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 text-left">
            <FilePlus2 size={18} className="text-gray-500" /> New blank project
          </button>
        </nav>
      </aside>

      {/* content */}
      <div className="flex-1 overflow-auto">
        <div className="px-10 py-10 max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="flex items-center gap-3 mr-auto">
            <h2 className="text-xl font-bold text-gray-800">Projects</h2>
            <div className="flex items-center bg-indigo-50 rounded-full p-0.5 text-[11px]">
              {[['all', 'All'], ['mine', 'Mine'], ['shared', 'Shared']].map(([k, label]) => (
                <button key={k} onClick={() => setScope(k)} className={`px-2 py-0.5 rounded-full ${scope === k ? 'bg-[#473AE0] text-white font-medium' : 'text-[#473AE0]'}`}>{label}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2 w-56">
            <Search size={15} className="text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects…"
                   className="flex-1 bg-transparent outline-none text-sm" />
            {query && <button onClick={() => setQuery('')}><X size={14} className="text-gray-400" /></button>}
          </div>

          <div className="flex items-center bg-gray-100 rounded-full p-1 text-sm">
            <button onClick={() => setViewMode('active')}
                    className={`px-3 py-1.5 rounded-full ${viewMode === 'active' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500'}`}>Active</button>
            <button onClick={() => setViewMode('completed')}
                    className={`px-3 py-1.5 rounded-full ${viewMode === 'completed' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500'}`}>
              Complete{completedCount ? ` (${completedCount})` : ''}
            </button>
            <button onClick={() => setViewMode('archived')}
                    className={`px-3 py-1.5 rounded-full ${viewMode === 'archived' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500'}`}>
              Archived{archivedCount ? ` (${archivedCount})` : ''}
            </button>
          </div>

          <div className="relative">
            <button onClick={() => setSortOpen((v) => !v)}
                    className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full px-4 py-2">
              {SORT_LABEL[sortBy]} <ChevronDown size={15} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-11 z-20 w-44 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5">
                {Object.entries(SORT_LABEL).map(([k, label]) => (
                  <button key={k} onClick={() => setSort(k)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm ${sortBy === k ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {boards.length === 0 ? (
          <div className="text-gray-400 text-sm">No projects yet — create your first one.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* table header */}
            <div className="flex items-center px-5 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              <div className="flex-1 min-w-0">Name</div>
              <div className="w-20 text-center hidden sm:block">Pages</div>
              <div className="w-36 hidden md:block">Created</div>
              <div className="w-32">Updated</div>
              <div className="w-10" />
            </div>
            {/* rows */}
            {sortedBoards.map((p) => (
              <div key={p.id} onClick={() => onOpen(p.id)}
                   className="group relative flex items-center px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/70 cursor-pointer">
                <div className="flex-1 min-w-0 flex items-center gap-2.5">
                  <FileText size={16} className="text-gray-300 shrink-0" />
                  {renamingId === p.id ? (
                    <input autoFocus value={draft} onClick={(e) => e.stopPropagation()}
                           onChange={(e) => setDraft(e.target.value)} onBlur={() => commitRename(p.id)}
                           onKeyDown={(e) => { if (e.key === 'Enter') commitRename(p.id); if (e.key === 'Escape') setRenamingId(null); }}
                           className="font-medium text-gray-800 border-b border-indigo-300 outline-none bg-transparent min-w-[160px]" />
                  ) : (
                    <span className="font-medium text-gray-800 truncate">{p.name}</span>
                  )}
                  {p.completed ? (
                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-600 text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0"><CheckCircle2 size={11} /> Complete</span>
                  ) : p.shared ? (
                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-[#473AE0] text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0"><Users size={11} /> Shared</span>
                  ) : null}
                </div>
                <div className="w-20 text-center text-sm text-gray-500 hidden sm:block">{pagesOf(p.items)}</div>
                <div className="w-36 text-sm text-gray-500 hidden md:block">{fmtDate(p.createdAt)}</div>
                <div className="w-32 text-sm text-gray-400">{relTime(p.updatedAt)}</div>
                <div className="w-10 flex justify-end relative">
                  <button onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }}
                          className="w-7 h-7 rounded-full text-gray-400 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-gray-100"
                          title="Project options"><Settings size={15} /></button>
                  {menuId === p.id && (
                    <CardMenu
                      onRename={() => startRename(p)}
                      onShare={() => { setShareBoard(p); setMenuId(null); }}
                      canShare={hasBackend() && !p.shared}
                      onDuplicate={() => handleDuplicate(p.id)}
                      onComplete={() => handleComplete(p.id, !p.completed)}
                      completed={!!p.completed}
                      onArchive={() => handleArchive(p.id, !p.archived)}
                      archived={!!p.archived}
                      onDelete={() => handleDelete(p.id)}
                      shared={!!p.shared}
                      onClose={() => setMenuId(null)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center" onMouseDown={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">{deleteTarget.shared ? <LogOut size={22} /> : <Trash2 size={22} />}</div>
            <h2 className="text-lg font-bold text-gray-800">{deleteTarget.shared ? 'Leave project' : 'Delete project'}</h2>
            <p className="text-sm text-gray-500 mt-1.5">
              {deleteTarget.shared
                ? <>Remove <span className="font-semibold text-gray-700">“{deleteTarget.name}”</span> from your list? You’ll lose access, but the owner keeps the project.</>
                : <>Are you sure you want to delete <span className="font-semibold text-gray-700">“{deleteTarget.name}”</span>? This can’t be undone.</>}
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-full py-2.5 font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 rounded-full py-2.5 font-medium text-white bg-red-500 hover:bg-red-600">{deleteTarget.shared ? 'Leave' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {shareBoard && <ShareModal board={shareBoard} onClose={() => setShareBoard(null)} />}

      {newOpen && <NewProjectModal onClose={() => setNewOpen(false)} onCreate={handleCreate} />}
    </div>
  );
}
