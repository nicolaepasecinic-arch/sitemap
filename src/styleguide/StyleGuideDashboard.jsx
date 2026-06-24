import React, { useState, useEffect } from 'react';
import { Settings, Trash2, X, ChevronDown, LogOut, CheckCircle2, Users, FilePlus2, Search, Sparkles } from 'lucide-react';
import {
  listStyleGuides, createStyleGuide, duplicateStyleGuide, deleteStyleGuide, renameStyleGuide, archiveStyleGuide, completeStyleGuide,
} from './styleguideStore';
import { hasBackend, apiGenerateStyleGuide } from './styleguideApi';
import { relTime, Thumb, CardMenu, NewStyleGuideModal, StyleGuideGenerateModal, ShareModal } from './styleguideCards';

export default function StyleGuideDashboard({ onOpen }) {
  const [guides, setGuides] = useState([]);
  const [menuId, setMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('styleguides-sort') || 'updated');
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState('active'); // active | completed | archived
  const [scope, setScope] = useState('all'); // all | mine | shared
  const [query, setQuery] = useState('');
  const [shareGuide, setShareGuide] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const setSort = (s) => { setSortBy(s); setSortOpen(false); try { localStorage.setItem('styleguides-sort', s); } catch (e) {} };
  const SORT_LABEL = { name: 'Alphabetically', created: 'Date created', updated: 'Last updated' };

  const inView = (p) => {
    if (viewMode === 'archived') return !!p.archived;
    if (p.archived) return false;
    if (viewMode === 'completed') return !!p.completed;
    return !p.completed;
  };
  const sorted = [...guides]
    .filter(inView)
    .filter((p) => (scope === 'all' ? true : scope === 'shared' ? !!p.shared : !p.shared))
    .filter((p) => (query.trim() ? (p.name || '').toLowerCase().includes(query.trim().toLowerCase()) : true))
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'created') return (b.createdAt || b.updatedAt || 0) - (a.createdAt || a.updatedAt || 0);
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  const archivedCount = guides.filter((p) => p.archived).length;
  const completedCount = guides.filter((p) => p.completed && !p.archived).length;

  const refresh = () => listStyleGuides().then(setGuides).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const handleGenerate = async (payload) => {
    const r = await apiGenerateStyleGuide(payload); // backend creates the guide + versions
    setGenerateOpen(false);
    if (r && r.id) onOpen(r.id);
  };
  const handleCreate = async (name) => {
    const p = await createStyleGuide(name);
    setNewOpen(false);
    onOpen(p.id);
  };
  const handleDuplicate = async (id) => { await duplicateStyleGuide(id); setMenuId(null); refresh(); };
  const handleArchive = async (id, archived) => { await archiveStyleGuide(id, archived); setMenuId(null); refresh(); };
  const handleComplete = async (id, completed) => { await completeStyleGuide(id, completed); setMenuId(null); refresh(); };
  const handleDelete = (id) => {
    const p = guides.find((x) => x.id === id);
    setDeleteTarget(p || { id, name: 'this style guide' });
    setMenuId(null);
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteStyleGuide(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  };
  const startRename = (p) => { setRenamingId(p.id); setDraft(p.name); setMenuId(null); };
  const commitRename = async (id) => {
    await renameStyleGuide(id, draft.trim() || 'Untitled style guide');
    setRenamingId(null);
    refresh();
  };

  return (
    <div className="absolute inset-0 flex flex-col md:flex-row bg-[#FBFCFE]"
         style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* left sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-white border-r border-gray-100">
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="px-3 pt-1 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Create</div>
          <button onClick={() => setNewOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 text-left">
            <FilePlus2 size={18} className="text-gray-500" /> New style guide
          </button>
          {hasBackend() && (
            <button onClick={() => setGenerateOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 text-left">
              <Sparkles size={18} className="text-[#473AE0]" /> Generate with AI
            </button>
          )}
        </nav>
      </aside>

      {/* content */}
      <div className="flex-1 min-w-0 overflow-auto">
        <div className="px-4 py-6 md:px-10 md:py-10 max-w-6xl mx-auto">

        {/* mobile create actions */}
        <div className="md:hidden flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
          <button onClick={() => setNewOpen(true)} className="shrink-0 flex items-center gap-1.5 bg-[#473AE0] text-white text-sm font-medium rounded-full px-3 py-1.5"><FilePlus2 size={15} /> New</button>
          {hasBackend() && (
            <button onClick={() => setGenerateOpen(true)} className="shrink-0 flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm rounded-full px-3 py-1.5"><Sparkles size={15} className="text-[#473AE0]" /> Generate with AI</button>
          )}
        </div>

        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800">Style guides</h2>
            <div className="flex items-center bg-indigo-50 rounded-full p-0.5 text-[11px]">
              {[['all', 'All'], ['mine', 'Mine'], ['shared', 'Shared']].map(([k, label]) => (
                <button key={k} onClick={() => setScope(k)} className={`px-2 py-0.5 rounded-full ${scope === k ? 'bg-[#473AE0] text-white font-medium' : 'text-[#473AE0]'}`}>{label}</button>
              ))}
            </div>
          </div>

          {/* right group: search (with status toggle inside) + sort — aligned with the scope filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center bg-gray-100 rounded-full p-1 pr-3 gap-1.5 w-full sm:w-auto">
              <div className="flex items-center text-[13px] shrink-0">
                <button onClick={() => setViewMode('active')}
                        className={`px-2.5 py-1 rounded-full ${viewMode === 'active' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500'}`}>Active</button>
                <button onClick={() => setViewMode('completed')}
                        className={`px-2.5 py-1 rounded-full ${viewMode === 'completed' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500'}`}>Completed{completedCount ? ` (${completedCount})` : ''}</button>
                <button onClick={() => setViewMode('archived')}
                        className={`px-2.5 py-1 rounded-full ${viewMode === 'archived' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500'}`}>Archived{archivedCount ? ` (${archivedCount})` : ''}</button>
              </div>
              <div className="w-px h-5 bg-gray-300/70 shrink-0" />
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Search size={15} className="text-gray-400 shrink-0" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…"
                       className="bg-transparent outline-none text-sm flex-1 min-w-0 sm:w-36" />
                {query && <button onClick={() => setQuery('')}><X size={14} className="text-gray-400" /></button>}
              </div>
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
        </div>

        {guides.length === 0 ? (
          <div className="text-gray-400 text-sm">No style guides yet — create your first one.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sorted.map((p) => (
              <div key={p.id}
                   onClick={() => onOpen(p.id)}
                   className={`group relative rounded-2xl border bg-white hover:shadow-md transition cursor-pointer pt-4 pb-5 ${p.completed ? 'border-green-300' : 'border-gray-200 hover:border-indigo-300'}`}>
                {p.completed ? (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 bg-green-50 text-green-600 text-[11px] font-semibold rounded-full px-2 py-0.5">
                    <CheckCircle2 size={12} /> Complete
                  </span>
                ) : p.shared ? (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 bg-indigo-50 text-[#473AE0] text-[11px] font-semibold rounded-full px-2 py-0.5">
                    <Users size={12} /> Shared
                  </span>
                ) : null}
                <div className="text-center px-8">
                  {renamingId === p.id ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => commitRename(p.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(p.id); if (e.key === 'Escape') setRenamingId(null); }}
                      className="w-full text-center font-semibold text-gray-800 border-b border-indigo-300 outline-none"
                    />
                  ) : (
                    <div className="font-semibold text-gray-800 truncate">{p.name}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-0.5">{relTime(p.updatedAt)}</div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }}
                  className="absolute right-2 top-2 w-7 h-7 rounded-full bg-white border border-gray-100 shadow-sm text-gray-500 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-gray-50"
                  title="Options"
                ><Settings size={15} /></button>

                {menuId === p.id && (
                  <CardMenu
                    onRename={() => startRename(p)}
                    onShare={() => { setShareGuide(p); setMenuId(null); }}
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

                <div className="mt-4"><Thumb preview={p.preview} /></div>
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
            <h2 className="text-lg font-bold text-gray-800">{deleteTarget.shared ? 'Leave style guide' : 'Delete style guide'}</h2>
            <p className="text-sm text-gray-500 mt-1.5">
              {deleteTarget.shared
                ? <>Remove <span className="font-semibold text-gray-700">“{deleteTarget.name}”</span> from your list? You’ll lose access, but the owner keeps it.</>
                : <>Are you sure you want to delete <span className="font-semibold text-gray-700">“{deleteTarget.name}”</span>? This can’t be undone.</>}
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-full py-2.5 font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 rounded-full py-2.5 font-medium text-white bg-red-500 hover:bg-red-600">{deleteTarget.shared ? 'Leave' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {shareGuide && <ShareModal guide={shareGuide} onClose={() => setShareGuide(null)} />}

      {newOpen && <NewStyleGuideModal onClose={() => setNewOpen(false)} onCreate={handleCreate} />}
      {generateOpen && <StyleGuideGenerateModal onClose={() => setGenerateOpen(false)} onGenerate={handleGenerate} />}
    </div>
  );
}
