import React, { useState, useEffect, useRef } from 'react';
import { Settings, Trash2, X, ChevronDown, CheckCircle2, Users, FilePlus2, Search, LayoutGrid, Copy, Share2, Archive, CheckSquare } from 'lucide-react';
import {
  hasBackend, apiListMoodboards, apiCreateMoodboard, apiPatchMoodboard, apiDeleteMoodboard, apiDuplicateMoodboard,
  apiListMoodboardMembers, apiAddMoodboardMember, apiRemoveMoodboardMember, apiRemoveMoodboardInvite,
} from '../api';
import InvitePanel from '../components/InvitePanel';

const SORT_LABEL = { name: 'Alphabetically', created: 'Date created', updated: 'Last updated' };

function relTime(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

const mbApi = {
  listMembers: apiListMoodboardMembers, addMember: apiAddMoodboardMember,
  removeMember: apiRemoveMoodboardMember, removeInvite: apiRemoveMoodboardInvite,
};

function CardMenu({ board, onRename, onShare, onDuplicate, onComplete, onArchive, onDelete, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const Item = ({ icon: Icon, label, onClick, danger }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}>
      <Icon size={15} /> {label}
    </button>
  );
  return (
    <div ref={ref} className="absolute right-2 top-9 z-20 w-44 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5" onClick={(e) => e.stopPropagation()}>
      <Item icon={Settings} label="Rename" onClick={onRename} />
      <Item icon={Copy} label="Duplicate" onClick={onDuplicate} />
      <Item icon={Share2} label="Share" onClick={onShare} />
      <Item icon={CheckSquare} label={board.completed ? 'Mark active' : 'Mark complete'} onClick={onComplete} />
      <Item icon={Archive} label={board.archived ? 'Unarchive' : 'Archive'} onClick={onArchive} />
      <div className="h-px bg-gray-100 my-1" />
      <Item icon={Trash2} label={board.shared ? 'Leave' : 'Delete'} onClick={onDelete} danger />
    </div>
  );
}

export default function MoodboardDashboard({ onOpen }) {
  const [boards, setBoards] = useState([]);
  const [menuId, setMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('moodboards-sort') || 'updated');
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState('active');
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');
  const [shareBoard, setShareBoard] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const setSort = (s) => { setSortBy(s); setSortOpen(false); try { localStorage.setItem('moodboards-sort', s); } catch (e) {} };

  const inView = (p) => {
    if (viewMode === 'archived') return !!p.archived;
    if (p.archived) return false;
    if (viewMode === 'completed') return !!p.completed;
    return !p.completed;
  };
  const sorted = [...boards]
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

  const refresh = () => { if (hasBackend()) apiListMoodboards().then(setBoards).catch(() => {}); };
  useEffect(() => { refresh(); }, []);

  const handleCreate = async () => {
    setBusy(true);
    try { const p = await apiCreateMoodboard({ name: 'Untitled moodboard' }); onOpen(p.id); }
    finally { setBusy(false); }
  };
  const handleDuplicate = async (id) => { await apiDuplicateMoodboard(id); setMenuId(null); refresh(); };
  const handleArchive = async (id, archived) => { await apiPatchMoodboard(id, { archived }); setMenuId(null); refresh(); };
  const handleComplete = async (id, completed) => { await apiPatchMoodboard(id, { completed }); setMenuId(null); refresh(); };
  const handleDelete = (id) => { setDeleteTarget(boards.find((x) => x.id === id) || { id, name: 'this moodboard' }); setMenuId(null); };
  const confirmDelete = async () => { if (!deleteTarget) return; await apiDeleteMoodboard(deleteTarget.id); setDeleteTarget(null); refresh(); };
  const startRename = (p) => { setRenamingId(p.id); setDraft(p.name); setMenuId(null); };
  const commitRename = async (id) => { await apiPatchMoodboard(id, { name: draft.trim() || 'Untitled moodboard' }); setRenamingId(null); refresh(); };

  if (!hasBackend()) {
    return <div className="absolute inset-0 flex items-center justify-center text-sm text-amber-600 px-6 text-center">Moodboard needs the backend running (set REACT_APP_API_URL).</div>;
  }

  return (
    <div className="absolute inset-0 flex flex-col md:flex-row bg-[#FBFCFE]"
         style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* left sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-white border-r border-gray-100">
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="px-3 pt-1 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Create</div>
          <button onClick={handleCreate} disabled={busy} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 text-left disabled:opacity-50">
            <FilePlus2 size={18} className="text-gray-500" /> New moodboard
          </button>
        </nav>
      </aside>

      {/* content */}
      <div className="flex-1 min-w-0 overflow-auto">
        <div className="px-4 py-6 md:px-10 md:py-10 max-w-6xl mx-auto">

          {/* mobile create */}
          <div className="md:hidden flex items-center gap-2 mb-4">
            <button onClick={handleCreate} disabled={busy} className="flex items-center gap-1.5 bg-[#473AE0] text-white text-sm font-medium rounded-full px-3 py-1.5 disabled:opacity-50"><FilePlus2 size={15} /> New</button>
          </div>

          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800">Moodboards</h2>
              <div className="flex items-center bg-indigo-50 rounded-full p-0.5 text-[11px]">
                {[['all', 'All'], ['mine', 'Mine'], ['shared', 'Shared']].map(([k, label]) => (
                  <button key={k} onClick={() => setScope(k)} className={`px-2 py-0.5 rounded-full ${scope === k ? 'bg-[#473AE0] text-white font-medium' : 'text-[#473AE0]'}`}>{label}</button>
                ))}
              </div>
            </div>

            {/* right group: search (with status toggle inside) + sort */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center bg-gray-100 rounded-full p-1 pr-3 gap-1.5 w-full sm:w-auto">
                <div className="flex items-center text-[13px] shrink-0">
                  <button onClick={() => setViewMode('active')} className={`px-2.5 py-1 rounded-full ${viewMode === 'active' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500'}`}>Active</button>
                  <button onClick={() => setViewMode('completed')} className={`px-2.5 py-1 rounded-full ${viewMode === 'completed' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500'}`}>Completed{completedCount ? ` (${completedCount})` : ''}</button>
                  <button onClick={() => setViewMode('archived')} className={`px-2.5 py-1 rounded-full ${viewMode === 'archived' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500'}`}>Archived{archivedCount ? ` (${archivedCount})` : ''}</button>
                </div>
                <div className="w-px h-5 bg-gray-300/70 shrink-0" />
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Search size={15} className="text-gray-400 shrink-0" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="bg-transparent outline-none text-sm flex-1 min-w-0 sm:w-36" />
                  {query && <button onClick={() => setQuery('')}><X size={14} className="text-gray-400" /></button>}
                </div>
              </div>

              <div className="relative">
                <button onClick={() => setSortOpen((v) => !v)} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full px-4 py-2">{SORT_LABEL[sortBy]} <ChevronDown size={15} /></button>
                {sortOpen && (
                  <div className="absolute right-0 top-11 z-20 w-44 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5">
                    {Object.entries(SORT_LABEL).map(([k, label]) => (
                      <button key={k} onClick={() => setSort(k)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${sortBy === k ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-700 hover:bg-gray-50'}`}>{label}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="text-gray-400 text-sm">{query ? `No moodboards match “${query}”.` : 'No moodboards yet — create your first one.'}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {sorted.map((p) => {
                const imgs = (p.items || []).filter((it) => it.type === 'image').slice(0, 4);
                return (
                  <div key={p.id} onClick={() => onOpen(p.id)}
                       className="group relative bg-white rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm cursor-pointer overflow-hidden transition">
                    <button onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }}
                            className="absolute right-2 top-2 z-10 w-7 h-7 rounded-full bg-white border border-gray-100 shadow-sm text-gray-500 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-gray-50" title="Options"><Settings size={15} /></button>
                    {menuId === p.id && (
                      <CardMenu board={p}
                        onRename={() => startRename(p)}
                        onShare={() => { setShareBoard(p); setMenuId(null); }}
                        onDuplicate={() => handleDuplicate(p.id)}
                        onComplete={() => handleComplete(p.id, !p.completed)}
                        onArchive={() => handleArchive(p.id, !p.archived)}
                        onDelete={() => handleDelete(p.id)}
                        onClose={() => setMenuId(null)} />
                    )}

                    {/* preview */}
                    <div className="h-32 bg-gradient-to-br from-indigo-50 to-purple-50 grid grid-cols-2 grid-rows-2 gap-px">
                      {imgs.length === 0 ? (
                        <div className="col-span-2 row-span-2 flex items-center justify-center text-indigo-200"><LayoutGrid size={34} /></div>
                      ) : imgs.map((it, i) => (
                        <img key={i} src={it.src} alt="" className="w-full h-full object-cover" style={{ gridColumn: imgs.length === 1 ? 'span 2' : undefined, gridRow: imgs.length === 1 ? 'span 2' : undefined }} />
                      ))}
                    </div>

                    <div className="p-3.5">
                      {renamingId === p.id ? (
                        <input autoFocus value={draft} onClick={(e) => e.stopPropagation()}
                               onChange={(e) => setDraft(e.target.value)} onBlur={() => commitRename(p.id)}
                               onKeyDown={(e) => { if (e.key === 'Enter') commitRename(p.id); if (e.key === 'Escape') setRenamingId(null); }}
                               className="font-semibold text-gray-800 text-sm border-b border-indigo-300 outline-none bg-transparent w-full" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800 text-sm truncate">{p.name}</span>
                          {p.completed ? <span className="inline-flex items-center gap-1 bg-green-50 text-green-600 text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0"><CheckCircle2 size={11} /> Done</span>
                            : p.shared ? <span className="inline-flex items-center gap-1 bg-indigo-50 text-[#473AE0] text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0"><Users size={11} /> Shared</span> : null}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">{(p.items || []).length} items · {relTime(p.updatedAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* share modal */}
      {shareBoard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={() => setShareBoard(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-[92vw] p-6" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">Share “{shareBoard.name}”</h3>
              <button onClick={() => setShareBoard(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <InvitePanel projectId={shareBoard.id} api={mbApi} />
          </div>
        </div>
      )}

      {/* delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-[92vw] p-6" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-1">{deleteTarget.shared ? 'Leave moodboard?' : 'Delete moodboard?'}</h3>
            <p className="text-sm text-gray-500 mb-5">{deleteTarget.shared ? `Remove “${deleteTarget.name}” from your list?` : `“${deleteTarget.name}” will be permanently deleted.`}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-full text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-full text-sm text-white bg-red-500 hover:bg-red-600">{deleteTarget.shared ? 'Leave' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
