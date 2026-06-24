import React, { useState, useEffect, useRef } from 'react';
import { Settings, Copy, Trash2, Pencil, X, ChevronDown, Globe, Upload, HelpCircle, Archive, ArchiveRestore, Search, LogOut, CheckCircle2, Circle, Share2, Users, Sparkles, FilePlus2, LayoutTemplate, DownloadCloud, Wand2 } from 'lucide-react';
import {
  listProjects, createProject, createProjectFromTemplate, duplicateProject, deleteProject, renameProject, archiveProject, completeProject,
} from '../projectStore';
import { uid } from '../projectStore';
import { hasBackend, apiImportSitemap, apiCrawlSite, apiGenerateSitemap, apiSetProjectActiveCollab } from '../api';
import ActiveCollabField, { AcIcon } from '../components/ActiveCollabField';
import { parseImport, parseSitemapXml, cleanProjectName } from './importSitemap';
import { TEMPLATES } from './templates';
import BrandStar from '../components/Brand';
import InvitePanel from '../components/InvitePanel';
import { resolveColor, FrameGlyph } from './sitemapTheme';

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

/* Live preview of a project's home page — same look as the editor (title + colored
   section blocks with their names and a mini wireframe glyph). */
export function Thumb({ nodes }) {
  const home = (nodes || []).find((n) => n.group === 'main' && n.parentId === null) || (nodes || [])[0];
  const blocks = home?.blocks || [];
  const pcol = resolveColor(home?.color);
  return (
    <div className="rounded-xl bg-white border-2 overflow-hidden w-full max-w-[190px] mx-auto shadow-sm"
         style={{ borderColor: pcol.solid }}>
      <div className="flex items-center gap-1 px-2.5 py-2 border-b border-gray-50">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: pcol.solid, opacity: .4 }} />
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: pcol.solid, opacity: .4 }} />
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: pcol.solid, opacity: .4 }} />
        <span className="ml-auto text-[10px] font-bold truncate max-w-[110px]" style={{ color: pcol.solid }}>{home?.label || 'Page'}</span>
      </div>
      <div className="px-2 pt-2 pb-2.5 flex flex-col gap-1.5">
        {blocks.length === 0 && <div className="h-12 rounded-md bg-gray-100" />}
        {blocks.slice(0, 5).map((b) => {
          const bc = resolveColor(b.color);
          return (
            <div key={b.id} className="rounded-md px-2 py-1.5 text-white" style={{ background: bc.soft }}>
              <div className="text-[9px] font-semibold leading-tight truncate">{b.name}</div>
              <div className="mt-1 h-3" style={{ color: 'rgba(255,255,255,0.9)' }}><FrameGlyph frame={b.frame || 'bar'} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardMenu({ onRename, onSettings, onDuplicate, onShare, canShare, onComplete, completed, onArchive, archived, onDelete, shared, onClose }) {
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
      {onSettings && <button className={item + ' text-gray-700'} onClick={onSettings}><AcIcon size={15} /> Assign AC Project</button>}
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

/* Share a project with other Qoders accounts (by email). Owner-only. */
function ShareModal({ project, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-bold text-gray-800">Share “{project.name}”</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Invite people by email — they get access as soon as they sign up.</p>
        <InvitePanel projectId={project.id} />
      </div>
    </div>
  );
}

export default function Dashboard({ onOpen, user }) {
  const isPM = user?.teamRole === 'pm';
  const [projects, setProjects] = useState([]);
  const [menuId, setMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [tplQuery, setTplQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('dashboard-sort') || 'updated');
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState('active'); // active | archived
  const [scope, setScope] = useState('all'); // all | mine | shared
  const [query, setQuery] = useState('');
  const [shareProject, setShareProject] = useState(null);
  const [settingsProject, setSettingsProject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
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
    .filter((p) => (scope === 'all' ? true : scope === 'shared' ? !!p.shared : !p.shared))
    .filter((p) => (query.trim() ? (p.name || '').toLowerCase().includes(query.trim().toLowerCase()) : true))
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'created') return (b.createdAt || b.updatedAt || 0) - (a.createdAt || a.updatedAt || 0);
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  const archivedCount = projects.filter((p) => p.archived).length;
  const completedCount = projects.filter((p) => p.completed && !p.archived).length;

  const refresh = () => listProjects().then(setProjects).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const handleNew = async () => {
    const p = await createProject();
    onOpen(p.id);
  };
  const handleTemplate = async (tpl) => {
    const p = await createProjectFromTemplate(tpl.name, tpl.nodes());
    onOpen(p.id);
  };
  const handleDuplicate = async (id) => { await duplicateProject(id); setMenuId(null); refresh(); };
  const handleArchive = async (id, archived) => { await archiveProject(id, archived); setMenuId(null); refresh(); };
  const handleComplete = async (id, completed) => { await completeProject(id, completed); setMenuId(null); refresh(); };
  const handleDelete = (id) => {
    const p = projects.find((x) => x.id === id);
    setDeleteTarget(p || { id, name: 'this project' });
    setMenuId(null);
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteProject(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  };
  const startRename = (p) => { setRenamingId(p.id); setDraft(p.name); setMenuId(null); };
  const commitRename = async (id) => {
    await renameProject(id, draft.trim() || 'Untitled project');
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
          <button onClick={handleNew} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 text-left">
            <FilePlus2 size={18} className="text-gray-500" /> New blank project
          </button>
          <button onClick={() => setTemplatesOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 text-left">
            <LayoutTemplate size={18} className="text-gray-500" /> Choose a template
          </button>
          <button onClick={() => setImportOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 text-left">
            <DownloadCloud size={18} className="text-gray-500" /> Import website
          </button>
          <button onClick={() => setGenerateOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 text-left">
            <Wand2 size={18} className="text-gray-500" /> Generate with AI
          </button>
        </nav>
      </aside>

      {/* content */}
      <div className="flex-1 overflow-auto">
        <div className="px-10 py-10 max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="flex items-center gap-3 mr-auto">
            <h2 className="text-xl font-bold text-gray-800">My projects</h2>
            <div className="flex items-center bg-indigo-50 rounded-full p-0.5 text-[11px]">
              {[['all', 'All'], ['mine', 'Mine'], ['shared', 'Shared']].map(([k, label]) => (
                <button key={k} onClick={() => setScope(k)} className={`px-2 py-0.5 rounded-full ${scope === k ? 'bg-[#473AE0] text-white font-medium' : 'text-[#473AE0]'}`}>{label}</button>
              ))}
            </div>
          </div>

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
                {p.completed ? (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 bg-green-50 text-green-600 text-[11px] font-semibold rounded-full px-2 py-0.5">
                    <CheckCircle2 size={12} /> Complete
                  </span>
                ) : p.shared ? (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 bg-indigo-50 text-[#473AE0] text-[11px] font-semibold rounded-full px-2 py-0.5">
                    <Users size={12} /> Shared
                  </span>
                ) : null}
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
                    onSettings={hasBackend() && isPM ? () => { setSettingsProject(p); setMenuId(null); } : undefined}
                    onShare={() => { setShareProject(p); setMenuId(null); }}
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

                {/* thumbnail */}
                <div className="mt-4"><Thumb nodes={p.nodes} /></div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* templates modal */}
      {templatesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={() => setTemplatesOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[920px] max-w-[94vw] max-h-[90vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
            <div className="p-8 pb-4 shrink-0">
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-2xl font-bold text-gray-800">Templates</h2>
                <button onClick={() => { setTemplatesOpen(false); setTplQuery(''); }} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 flex items-center justify-center"><X size={18} /></button>
              </div>
              <p className="text-gray-500 text-sm">Pick a proven sitemap and start right away — it opens as a new project.</p>
              <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2 mt-4 max-w-sm">
                <Search size={15} className="text-gray-400" />
                <input autoFocus value={tplQuery} onChange={(e) => setTplQuery(e.target.value)} placeholder="Search templates (e.g. shop, blog, agency)…"
                       className="flex-1 bg-transparent outline-none text-sm" />
                {tplQuery && <button onClick={() => setTplQuery('')}><X size={14} className="text-gray-400" /></button>}
              </div>
            </div>
            <div className="overflow-y-auto px-8 pb-8">
              {(() => {
                const q = tplQuery.trim().toLowerCase();
                const filtered = q ? TEMPLATES.filter((t) => t.name.toLowerCase().includes(q) || (t.tags || '').toLowerCase().includes(q)) : TEMPLATES;
                if (!filtered.length) return <div className="text-sm text-gray-400 py-10 text-center">No templates match “{tplQuery}”.</div>;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                    {filtered.map((t) => {
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
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* import popup */}
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onOpen={(id) => { setImportOpen(false); onOpen(id); }}
          onImportNodes={async (name, text, filename) => {
            const nodes = parseImport(text, filename);
            if (!nodes || !nodes.length) throw new Error('Could not read that file. Use an Octopus.do XML export or a sitemap.xml.');
            const p = await createProjectFromTemplate(cleanProjectName(filename || name, nodes), nodes);
            return { id: p.id, pages: nodes.length };
          }}
          onImportUrl={async (url, mode) => {
            if (!hasBackend()) throw new Error('URL import needs the backend running. Use the File tab with an exported file instead.');
            const res = mode === 'crawler' ? await apiCrawlSite(url) : await apiImportSitemap(url);
            if (res.index) return { index: true, sitemaps: res.sitemaps || [], sourceUrl: url };
            const nodes = parseSitemapXml(res.xml || '');
            if (!nodes || !nodes.length) throw new Error('No pages found at that address.');
            let host = url; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
            const p = await createProjectFromTemplate(host || 'Imported sitemap', nodes);
            return { id: p.id, pages: nodes.length };
          }}
          onImportSitemaps={async (urls, sourceUrl) => {
            const parts = [];
            for (const u of urls) { try { const r = await apiImportSitemap(u); if (r.xml) parts.push(r.xml); } catch (e) {} }
            const nodes = parseSitemapXml(parts.join('\n'));
            if (!nodes || !nodes.length) throw new Error('Those sitemaps had no pages.');
            let host = sourceUrl; try { host = new URL(sourceUrl).hostname.replace(/^www\./, ''); } catch (e) {}
            const p = await createProjectFromTemplate(host || 'Imported sitemap', nodes);
            return { id: p.id, pages: nodes.length };
          }}
        />
      )}

      {/* generate-with-AI popup */}
      {generateOpen && (
        <GenerateModal
          onClose={() => setGenerateOpen(false)}
          onOpen={(id) => { setGenerateOpen(false); onOpen(id); }}
          onGenerate={async (prompt) => {
            if (!hasBackend()) throw new Error('AI generation needs the backend running (set REACT_APP_API_URL).');
            const res = await apiGenerateSitemap(prompt);
            const aiPages = (res && res.pages) || [];
            if (!aiPages.length) throw new Error('AI returned no pages. Try a more detailed description.');
            // Map AI ids → real node ids, then build our node tree.
            const idMap = {};
            aiPages.forEach((p) => { idMap[p.id] = uid(); });
            const nodes = aiPages.map((p) => ({
              id: idMap[p.id],
              label: p.title || 'Page',
              parentId: p.parentId && idMap[p.parentId] ? idMap[p.parentId] : null,
              group: 'main',
              color: 'blue',
              link: '',
              pageFrame: 'window',
              blocks: (p.sections || []).map((s) => ({
                id: uid(),
                name: s.name || 'Section',
                color: s.color || 'blue',
                frame: s.frame || 'bar',
                done: false,
                arrowTargets: [],
                description: s.description || '',
              })),
            }));
            const proj = await createProjectFromTemplate(res.projectName || 'AI sitemap', nodes);
            return { id: proj.id, pages: nodes.length, name: res.projectName };
          }}
        />
      )}

      {/* delete confirm */}
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

      {/* share modal */}
      {shareProject && <ShareModal project={shareProject} onClose={() => setShareProject(null)} />}

      {settingsProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={() => setSettingsProject(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 truncate pr-2">{settingsProject.name}</h2>
              <button onClick={() => setSettingsProject(null)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center shrink-0"><X size={16} /></button>
            </div>
            <ActiveCollabField
              acProjectId={settingsProject.acProjectId || ''}
              acProjectName={settingsProject.acProjectName || ''}
              onSave={async (acId) => { const updated = await apiSetProjectActiveCollab(settingsProject.id, acId); setSettingsProject((p) => (p ? { ...p, ...updated } : p)); refresh(); return updated; }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* Generate-with-AI popup — describe a site, AI builds a whole new project (name + pages). */
export function GenerateModal({ onClose, onGenerate, onOpen }) {
  const [prompt, setPrompt] = useState('');
  const [stage, setStage] = useState('idle'); // idle | busy | success
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const run = async () => {
    const p = prompt.trim();
    if (!p || stage === 'busy') return;
    setStage('busy'); setErr('');
    try {
      const [res] = await Promise.all([onGenerate(p), new Promise((r) => setTimeout(r, 600))]);
      setResult(res); setStage('success');
    } catch (e) { setErr(e.message || 'Generation failed'); setStage('idle'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onMouseDown={stage === 'busy' ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[94vw] p-8" onMouseDown={(e) => e.stopPropagation()}>

        {stage === 'busy' && (
          <div className="py-10 flex flex-col items-center text-center">
            <style>{`@keyframes gpulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.7}}@keyframes gbar{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}`}</style>
            <div style={{ animation: 'gpulse 1.1s ease-in-out infinite' }}><BrandStar size={46} /></div>
            <div className="mt-6 w-48 h-1.5 rounded-full bg-gray-200 overflow-hidden"><div className="h-full w-2/5 rounded-full bg-[#473AE0]" style={{ animation: 'gbar 1.1s ease-in-out infinite' }} /></div>
            <div className="mt-4 font-semibold text-gray-800">Generating your sitemap…</div>
            <div className="text-sm text-gray-400 mt-1">Planning the pages and structure.</div>
          </div>
        )}

        {stage === 'success' && (
          <div className="py-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 text-green-500 flex items-center justify-center mb-4"><CheckCircle2 size={32} /></div>
            <h2 className="text-xl font-bold text-gray-800">Sitemap ready</h2>
            <p className="text-sm text-gray-500 mt-1.5">{result ? `“${result.name || 'New project'}” — ${result.pages} page${result.pages === 1 ? '' : 's'} created.` : 'Your project is ready.'}</p>
            <button onClick={() => onOpen(result.id)} className="mt-6 bg-[#473AE0] text-white rounded-full px-7 py-2.5 text-sm font-medium hover:bg-[#3a2fc0]">Open sitemap</button>
            <button onClick={onClose} className="mt-2 text-sm text-gray-400 hover:text-gray-600">Back to dashboard</button>
          </div>
        )}

        {stage === 'idle' && (
          <>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-500 text-white flex items-center justify-center"><Sparkles size={17} /></span>
                <h2 className="text-2xl font-bold text-gray-800">Generate with AI</h2>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
            </div>
            <p className="text-gray-500 text-sm mt-4 mb-3">Describe the website and AI will build a complete sitemap — project name and all the pages.</p>
            <textarea autoFocus value={prompt} onChange={(e) => { setPrompt(e.target.value); if (err) setErr(''); }}
                      onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run(); }}
                      rows={4} placeholder="e.g. A SaaS website for a project-management tool aimed at small agencies — marketing site with pricing, features, blog and support."
                      className="w-full resize-none rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-700 outline-none focus:ring-1 focus:ring-fuchsia-300 placeholder-gray-400" />
            {err && <div className="text-sm text-red-500 mt-2">{err}</div>}
            <button onClick={run} disabled={!prompt.trim()}
                    className="mt-5 inline-flex items-center gap-1.5 bg-[#473AE0] text-white rounded-full px-6 py-2.5 text-sm font-medium hover:bg-[#3a2fc0] disabled:opacity-50">
              <Sparkles size={15} /> Generate sitemap
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* Import popup — visual only (no functionality) */
export function ImportModal({ onClose, onImportNodes, onImportUrl, onImportSitemaps, onOpen }) {
  const [tab, setTab] = useState('file');
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState('idle'); // idle | busy | select | success
  const [result, setResult] = useState(null); // { id, pages }
  const [sitemaps, setSitemaps] = useState([]); // sub-sitemap urls (index)
  const [selected, setSelected] = useState(() => new Set());
  const [sourceUrl, setSourceUrl] = useState('');
  const [err, setErr] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const tabCls = (t) => `pb-2 text-base ${tab === t ? 'text-gray-800 border-b-2 border-[#10B981] font-medium' : 'text-gray-500'}`;
  const minDelay = (ms) => new Promise((r) => setTimeout(r, ms));

  const run = async (work, keepStage) => {
    setStage('busy'); setErr('');
    try {
      const [res] = await Promise.all([work(), minDelay(600)]);
      if (res && res.index) { setSitemaps(res.sitemaps || []); setSourceUrl(res.sourceUrl || ''); setSelected(new Set()); setStage('select'); }
      else { setResult(res); setStage('success'); }
    } catch (e) { setErr(e.message || 'Import failed'); setStage(keepStage || 'idle'); }
  };
  const readFile = (file) => {
    if (!file) return;
    run(async () => onImportNodes(file.name.replace(/\.(csv|xml)$/i, ''), await file.text(), file.name));
  };
  const importUrl = () => { if (url.trim()) run(() => onImportUrl(url.trim(), tab)); };
  const toggle = (u) => setSelected((s) => { const n = new Set(s); n.has(u) ? n.delete(u) : n.add(u); return n; });
  const selectAll = () => setSelected((s) => (s.size === sitemaps.length ? new Set() : new Set(sitemaps)));
  const continueSelected = () => { if (selected.size) run(() => onImportSitemaps([...selected], sourceUrl), 'select'); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onMouseDown={stage === 'busy' ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[94vw] p-8" onMouseDown={(e) => e.stopPropagation()}>

        {stage === 'busy' && (
          <div className="py-10 flex flex-col items-center text-center">
            <style>{`@keyframes ipulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.7}}@keyframes ibar{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}`}</style>
            <div style={{ animation: 'ipulse 1.1s ease-in-out infinite' }}><BrandStar size={46} /></div>
            <div className="mt-6 w-48 h-1.5 rounded-full bg-gray-200 overflow-hidden"><div className="h-full w-2/5 rounded-full bg-[#473AE0]" style={{ animation: 'ibar 1.1s ease-in-out infinite' }} /></div>
            <div className="mt-4 font-semibold text-gray-800">Importing your sitemap…</div>
            <div className="text-sm text-gray-400 mt-1">Reading pages, sections and content.</div>
          </div>
        )}

        {stage === 'select' && (
          <div>
            <h2 className="text-xl font-bold text-gray-800">We found multiple sitemaps</h2>
            <p className="text-sm text-gray-500 mt-1.5">This sitemap contains several sitemap files — choose which ones to import.</p>
            <button onClick={selectAll} className="text-sm text-[#473AE0] font-medium mt-3">{selected.size === sitemaps.length ? 'Deselect all' : 'Select all'}</button>
            <div className="mt-2 max-h-72 overflow-auto divide-y divide-gray-100">
              {sitemaps.map((u) => (
                <label key={u} className="flex items-center gap-3 py-2.5 cursor-pointer">
                  <input type="checkbox" checked={selected.has(u)} onChange={() => toggle(u)} className="w-4 h-4 accent-[#473AE0]" />
                  <span className="text-sm text-gray-600 truncate">{u}</span>
                </label>
              ))}
            </div>
            {err && <div className="text-sm text-red-500 mt-2">{err}</div>}
            <button onClick={continueSelected} disabled={!selected.size}
                    className="mt-5 bg-[#473AE0] text-white rounded-full px-7 py-2.5 text-sm font-medium hover:bg-[#3a2fc0] disabled:opacity-50">Continue</button>
          </div>
        )}

        {stage === 'success' && (
          <div className="py-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 text-green-500 flex items-center justify-center mb-4"><CheckCircle2 size={32} /></div>
            <h2 className="text-xl font-bold text-gray-800">Import complete</h2>
            <p className="text-sm text-gray-500 mt-1.5">{result ? `${result.pages} page${result.pages === 1 ? '' : 's'} imported into a new project.` : 'Your sitemap is ready.'}</p>
            <button onClick={() => { onOpen(result.id); }} className="mt-6 bg-[#473AE0] text-white rounded-full px-7 py-2.5 text-sm font-medium hover:bg-[#3a2fc0]">Open sitemap</button>
            <button onClick={onClose} className="mt-2 text-sm text-gray-400 hover:text-gray-600">Back to dashboard</button>
          </div>
        )}

        {stage === 'idle' && (
          <>
            <div className="flex items-start justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Import</h2>
              <button onClick={onClose} className="w-7 h-7 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="flex items-center gap-6 mt-4 border-b border-gray-100">
              <button onClick={() => { setTab('file'); setErr(''); }} className={tabCls('file')}>File <span className="ml-1 text-[10px] font-bold text-purple-500 bg-purple-100 rounded px-1 py-0.5 align-middle">NEW</span></button>
              <button onClick={() => { setTab('crawler'); setErr(''); }} className={tabCls('crawler')}>Crawler <span className="ml-1 text-[10px] font-bold text-amber-500 bg-amber-100 rounded px-1 py-0.5 align-middle">SOON</span></button>
              <button onClick={() => { setTab('sitemap'); setErr(''); }} className={tabCls('sitemap')}>Sitemap.xml</button>
            </div>

            {tab === 'crawler' ? (
              <div className="mt-5">
                <div className="border-2 border-dashed border-gray-200 rounded-xl py-12 flex flex-col items-center gap-2 text-center px-6">
                  <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-1"><Globe size={22} /></div>
                  <span className="text-base font-semibold text-gray-700">Crawler — coming soon</span>
                  <span className="text-sm text-gray-400 max-w-xs">Automatic full-site crawling (any URL → page tree) is in progress. For now, use <b>Sitemap.xml</b> or an Octopus <b>XML</b> export.</span>
                </div>
              </div>
            ) : tab === 'file' ? (
              <div className="mt-5">
                <p className="text-gray-500 text-sm mb-4">Import an Octopus.do <b>XML</b> export — pages, sections, real wireframes &amp; the project name.</p>
                <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" className="hidden"
                       onChange={(e) => readFile(e.target.files[0])} />
                <button onClick={() => fileRef.current && fileRef.current.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files[0]); }}
                        className={`w-full border-2 border-dashed rounded-xl py-12 flex flex-col items-center gap-2 ${dragOver ? 'border-indigo-400 bg-indigo-50 text-indigo-500' : 'border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-400'}`}>
                  <Upload size={22} />
                  <span className="text-sm">{dragOver ? 'Drop the .xml here' : 'Click or drag an Octopus .xml export'}</span>
                </button>
                <p className="text-[11px] text-gray-400 mt-3">In Octopus.do: <b>···</b> menu → Export → XML.</p>
              </div>
            ) : (
              <div className="mt-5">
                <p className="text-gray-500 text-sm mb-4">Paste a link to any site’s sitemap.xml — we build the page tree from it.</p>
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3">
                  <Globe size={16} className="text-gray-400" />
                  <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://website.com/sitemap.xml" className="flex-1 outline-none text-sm" />
                </div>
                <button onClick={importUrl} disabled={!url.trim()}
                        className="mt-5 bg-[#473AE0] text-white rounded-full px-6 py-2.5 text-sm font-medium hover:bg-[#3a2fc0] disabled:opacity-50">Import</button>
              </div>
            )}

            {err && <div className="text-sm text-red-500 mt-3">{err}</div>}
            <div className="flex items-center gap-1 text-gray-400 text-xs mt-4"><HelpCircle size={13} /> {tab === 'sitemap' ? 'Most sites expose a sitemap at /sitemap.xml — e.g. upqode.com/sitemap.xml. Paste that link to build the page tree.' : 'Octopus.do → Export → XML gives the richest import (pages + sections + wireframes).'}</div>
          </>
        )}
      </div>
    </div>
  );
}
