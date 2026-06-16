import React, { useState, useEffect, useRef } from 'react';
import { Plus, Settings, Copy, Trash2, Pencil, LayoutGrid, X, ChevronDown, Globe, Upload, HelpCircle, Archive, ArchiveRestore, Search, LogOut, CheckCircle2, Circle } from 'lucide-react';
import {
  listProjects, createProject, createProjectFromTemplate, duplicateProject, deleteProject, renameProject, archiveProject, completeProject,
} from './projectStore';
import { TEMPLATES } from './templates';
import { initials } from './auth';
import BrandStar from './Brand';

const COLORS = {
  blue:   '#473AE0',
  topaz:  '#10B981',
  purple: '#8B5CF6',
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

/* Tiny wireframe preview of a project's home page. */
function Thumb({ nodes }) {
  const home = nodes.find((n) => n.group === 'main' && n.parentId === null) || nodes[0];
  const blocks = home?.blocks || [];
  const color = COLORS[home?.color] || COLORS.blue;
  return (
    <div className="rounded-lg bg-white border-2 overflow-hidden w-28 mx-auto shadow-sm"
         style={{ borderColor: color }}>
      <div className="flex items-center gap-0.5 px-2 py-1.5">
        <span className="w-1 h-1 rounded-full" style={{ background: color, opacity: .5 }} />
        <span className="w-1 h-1 rounded-full" style={{ background: color, opacity: .5 }} />
        <span className="w-1 h-1 rounded-full" style={{ background: color, opacity: .5 }} />
        <span className="ml-auto text-[7px] font-bold" style={{ color }}>{home?.label || 'Page'}</span>
      </div>
      <div className="px-1.5 pb-1.5 flex flex-col gap-0.5">
        {blocks.length === 0 && <div className="h-10 rounded bg-gray-100" />}
        {blocks.slice(0, 6).map((b) => (
          <div key={b.id} className="h-2.5 rounded-sm" style={{ background: COLORS[b.color] || color }} />
        ))}
      </div>
    </div>
  );
}

function CardMenu({ onRename, onDuplicate, onComplete, completed, onArchive, archived, onDelete, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [onClose]);
  const item = 'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-50 text-left';
  return (
    <div ref={ref} className="absolute right-2 top-9 z-20 w-44 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5"
         onClick={(e) => e.stopPropagation()}>
      <button className={item + ' text-gray-700'} onClick={onRename}><Pencil size={15} /> Rename</button>
      <button className={item + ' text-gray-700'} onClick={onDuplicate}><Copy size={15} /> Duplicate</button>
      <button className={item + ' text-gray-700'} onClick={onComplete}>
        {completed ? <><Circle size={15} /> Mark as active</> : <><CheckCircle2 size={15} /> Mark as complete</>}
      </button>
      <button className={item + ' text-gray-700'} onClick={onArchive}>
        {archived ? <><ArchiveRestore size={15} /> Restore</> : <><Archive size={15} /> Archive</>}
      </button>
      <div className="h-px bg-gray-100 my-1" />
      <button className={item + ' text-red-500'} onClick={onDelete}><Trash2 size={15} /> Delete</button>
    </div>
  );
}

export default function Dashboard({ onOpen, user, onLogout }) {
  const [projects, setProjects] = useState(() => listProjects());
  const [menuId, setMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('dashboard-sort') || 'updated');
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState('active'); // active | archived
  const [query, setQuery] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  useEffect(() => {
    if (!accountOpen) return;
    const h = (e) => { if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [accountOpen]);
  const setSort = (s) => { setSortBy(s); setSortOpen(false); try { localStorage.setItem('dashboard-sort', s); } catch (e) {} };
  const SORT_LABEL = { name: 'Alphabetically', created: 'Date created', updated: 'Last updated' };
  const inView = (p) => {
    if (viewMode === 'archived') return !!p.archived;
    if (p.archived) return false;
    if (viewMode === 'completed') return !!p.completed;
    return !p.completed; // active
  };
  const sortedProjects = [...projects]
    .filter(inView)
    .filter((p) => (query.trim() ? (p.name || '').toLowerCase().includes(query.trim().toLowerCase()) : true))
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'created') return (b.createdAt || b.updatedAt || 0) - (a.createdAt || a.updatedAt || 0);
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  const archivedCount = projects.filter((p) => p.archived).length;
  const completedCount = projects.filter((p) => p.completed && !p.archived).length;

  const refresh = () => setProjects(listProjects());

  const handleNew = () => {
    const p = createProject();
    onOpen(p.id);
  };
  const handleTemplate = (tpl) => {
    const p = createProjectFromTemplate(tpl.name, tpl.nodes());
    onOpen(p.id);
  };
  const handleDuplicate = (id) => { duplicateProject(id); setMenuId(null); refresh(); };
  const handleArchive = (id, archived) => { archiveProject(id, archived); setMenuId(null); refresh(); };
  const handleComplete = (id, completed) => { completeProject(id, completed); setMenuId(null); refresh(); };
  const handleDelete = (id) => {
    const p = projects.find((x) => x.id === id);
    if (window.confirm(`Delete "${p?.name}"? This cannot be undone.`)) {
      deleteProject(id);
      setMenuId(null);
      refresh();
    }
  };
  const startRename = (p) => { setRenamingId(p.id); setDraft(p.name); setMenuId(null); };
  const commitRename = (id) => {
    renameProject(id, draft.trim() || 'Untitled project');
    setRenamingId(null);
    refresh();
  };

  return (
    <div className="fixed inset-0 bg-[#FBFCFE] overflow-auto"
         style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* top bar */}
      <div className="sticky top-0 z-30 h-16 px-8 flex items-center justify-between bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <BrandStar size={22} />
          <span className="font-semibold text-gray-800 text-lg">My projects</span>
        </div>
        <div className="relative">
          <button onClick={() => setAccountOpen((v) => !v)} className="flex items-center gap-2 hover:bg-gray-50 rounded-full pl-1 pr-3 py-1">
            <span className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-bold">{initials(user?.name)}</span>
            <span className="text-sm text-gray-700">{user?.name || 'My account'}</span>
            <ChevronDown size={15} className="text-gray-400" />
          </button>
          {accountOpen && (
            <div ref={accountRef} className="absolute right-0 top-12 z-40 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5">
              {user?.email && <div className="px-3 py-1.5 text-xs text-gray-400 truncate">{user.email}</div>}
              <button onClick={() => { setAccountOpen(false); onLogout && onLogout(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 text-left">
                <LogOut size={15} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* main */}
      <div className="px-10 py-10 max-w-5xl mx-auto">
        {/* action cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <button onClick={handleNew}
                  className="h-28 rounded-2xl bg-[#473AE0] text-white flex flex-col items-center justify-center gap-2 hover:bg-indigo-600 shadow-sm">
            <Plus size={22} />
            <span className="text-sm font-medium">New blank project</span>
          </button>
          <button onClick={() => setTemplatesOpen(true)}
                  className="h-28 rounded-2xl bg-white border border-gray-200 text-gray-700 flex flex-col items-center justify-center gap-2 hover:border-indigo-300 hover:shadow-sm">
            <LayoutGrid size={20} />
            <span className="text-sm font-medium">Choose a template</span>
          </button>
          <button onClick={() => setImportOpen(true)}
                  className="h-28 rounded-2xl bg-white border border-gray-200 text-gray-700 flex flex-col items-center justify-center gap-2 hover:border-indigo-300 hover:shadow-sm">
            <Globe size={20} />
            <span className="text-sm font-medium">Import website</span>
          </button>
          <div className="h-28 rounded-2xl bg-gray-100 text-gray-400 flex flex-col items-center justify-center gap-2 cursor-not-allowed" title="Coming soon">
            <Plus size={20} />
            <span className="text-sm">Generate with AI</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-gray-800 mr-auto">My projects</h2>

          {/* search by name */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2 w-56">
            <Search size={15} className="text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects…"
                   className="flex-1 bg-transparent outline-none text-sm" />
            {query && <button onClick={() => setQuery('')}><X size={14} className="text-gray-400" /></button>}
          </div>

          {/* active / archived toggle */}
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

        {projects.length === 0 ? (
          <div className="text-gray-400 text-sm">No projects yet — create your first one.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {sortedProjects.map((p) => (
              <div key={p.id}
                   onClick={() => onOpen(p.id)}
                   className={`group relative rounded-2xl border bg-white hover:shadow-md transition cursor-pointer pt-4 pb-5 ${p.completed ? 'border-green-300' : 'border-gray-200 hover:border-indigo-300'}`}>
                {p.completed && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 bg-green-50 text-green-600 text-[11px] font-semibold rounded-full px-2 py-0.5">
                    <CheckCircle2 size={12} /> Complete
                  </span>
                )}
                {/* title */}
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

                {/* gear */}
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }}
                  className="absolute right-2 top-2 w-7 h-7 rounded-full bg-white border border-gray-100 shadow-sm text-gray-500 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-gray-50"
                  title="Project options"
                ><Settings size={15} /></button>

                {menuId === p.id && (
                  <CardMenu
                    onRename={() => startRename(p)}
                    onDuplicate={() => handleDuplicate(p.id)}
                    onComplete={() => handleComplete(p.id, !p.completed)}
                    completed={!!p.completed}
                    onArchive={() => handleArchive(p.id, !p.archived)}
                    archived={!!p.archived}
                    onDelete={() => handleDelete(p.id)}
                    onClose={() => setMenuId(null)}
                  />
                )}

                {/* thumbnail */}
                <div className="mt-4"><Thumb nodes={p.nodes} /></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* templates modal */}
      {templatesOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 overflow-auto py-10" onMouseDown={() => setTemplatesOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[920px] max-w-[94vw] p-8" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-2xl font-bold text-gray-800">Templates</h2>
              <button onClick={() => setTemplatesOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 flex items-center justify-center"><X size={18} /></button>
            </div>
            <p className="text-gray-500 mb-6 text-sm">Pick a proven sitemap and start right away — it opens as a new project.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {TEMPLATES.map((t) => {
                const preview = t.nodes();
                return (
                  <button key={t.id} onClick={() => handleTemplate(t)}
                          className="text-left rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition p-4">
                    <div className="bg-gray-50 rounded-lg py-4"><Thumb nodes={preview} /></div>
                    <div className="mt-3 font-semibold text-[#473AE0]">{t.name}</div>
                    <div className="text-xs text-gray-400">{preview.length} pages</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* import popup (visual only) */}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

/* Import popup — visual only (no functionality) */
function ImportModal({ onClose }) {
  const [tab, setTab] = useState('crawler');
  const tabCls = (t) => `pb-2 text-base ${tab === t ? 'text-gray-800 border-b-2 border-[#10B981] font-medium' : 'text-gray-500'}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[94vw] p-8" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Import</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="flex items-center gap-6 mt-4 border-b border-gray-100">
          <button onClick={() => setTab('crawler')} className={tabCls('crawler')}>Crawler</button>
          <button onClick={() => setTab('file')} className={tabCls('file')}>File <span className="ml-1 text-[10px] font-bold text-purple-500 bg-purple-100 rounded px-1 py-0.5 align-middle">NEW</span></button>
          <button onClick={() => setTab('sitemap')} className={tabCls('sitemap')}>Sitemap.xml</button>
        </div>

        {tab === 'file' ? (
          <div className="mt-5">
            <p className="text-gray-500 text-sm mb-3">Import an XML file to generate your sitemap, pages, wireframes and content.</p>
            <div className="flex items-center gap-1 text-[#473AE0] text-sm mb-4"><HelpCircle size={15} /> File requirements</div>
            <div className="border-2 border-dashed border-gray-200 rounded-xl py-12 flex flex-col items-center gap-2 text-gray-400">
              <Upload size={22} />
              <span className="text-sm">Drop XML file here or click to upload</span>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-gray-500 text-sm mb-4">The crawler imports an exact sitemap, but it can take several minutes.</p>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3">
              <Globe size={16} className="text-gray-400" />
              <input placeholder="https://website.com" className="flex-1 outline-none text-sm" />
            </div>
          </div>
        )}

        <div className="mt-6">
          <button className="bg-gray-100 text-gray-400 rounded-full px-6 py-2.5 text-sm font-medium cursor-not-allowed">
            {tab === 'file' ? 'Import' : 'Crawl'}
          </button>
        </div>
      </div>
    </div>
  );
}
