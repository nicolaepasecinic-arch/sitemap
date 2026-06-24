import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, Upload, Trash2, X, FileArchive, Plus, Search, ChevronDown, Pencil, Copy, Share2,
  CheckCircle2, Circle, Archive, ArchiveRestore, LogOut, Users, Settings, History, MessageSquare,
} from 'lucide-react';
import BrandStar from '../components/Brand';
import InvitePanel from '../components/InvitePanel';
import { listStyleGuides } from '../styleguide/styleguideStore';
import ActiveCollabField, { AcIcon } from '../components/ActiveCollabField';
import {
  hasBackend, listMarkupProjects, createMarkupFromUrl, uploadMarkupZip, createBlankDesign, deleteMarkupProject,
  patchMarkupProject, duplicateMarkupProject, addMarkupVersionUrl, addMarkupVersionZip,
  markupListMembers, markupAddMember, markupRemoveMember, markupRemoveInvite, setMarkupActiveCollab,
} from './markupApi';

const SORT_LABEL = { name: 'Alphabetically', created: 'Date created', updated: 'Last updated' };
const MEMBER_API = { listMembers: markupListMembers, addMember: markupAddMember, removeMember: markupRemoveMember, removeInvite: markupRemoveInvite };

function relTime(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export default function MarkupDashboard({ onOpen, heading = 'Markup projects', user, designMode = false }) {
  const isPM = user?.teamRole === 'pm';
  const [projects, setProjects] = useState([]);
  const [err, setErr] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [shareProject, setShareProject] = useState(null);
  const [settingsProject, setSettingsProject] = useState(null);
  const [versionTarget, setVersionTarget] = useState(null);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState('active'); // active | completed | archived
  const [scope, setScope] = useState('all'); // all | mine | shared
  const [sortBy, setSortBy] = useState('updated');
  const [sortOpen, setSortOpen] = useState(false);
  const [menuId, setMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [draft, setDraft] = useState('');

  const refresh = () => { if (hasBackend()) listMarkupProjects().then(setProjects).catch(() => {}); };
  useEffect(() => { refresh(); }, []);

  const handleCreated = (p) => { setCreateOpen(false); onOpen(p.id); };
  const doPatch = async (id, patch) => { setMenuId(null); try { await patchMarkupProject(id, patch); refresh(); } catch (e) {} };
  const doDuplicate = async (id) => { setMenuId(null); try { await duplicateMarkupProject(id); refresh(); } catch (e) {} };
  const startRename = (p) => { setRenamingId(p.id); setDraft(p.name); setMenuId(null); };
  const commitRename = async (id) => { await patchMarkupProject(id, { name: draft.trim() || 'Markup' }); setRenamingId(null); refresh(); };
  const confirmDelete = async () => { const id = deleteTarget.id; setDeleteTarget(null); try { await deleteMarkupProject(id); refresh(); } catch (e) {} };

  const archivedCount = projects.filter((p) => p.archived).length;
  const completedCount = projects.filter((p) => p.completed && !p.archived).length;

  const visible = projects
    .filter((p) => (viewMode === 'archived' ? p.archived : viewMode === 'completed' ? (p.completed && !p.archived) : (!p.archived && !p.completed)))
    .filter((p) => (scope === 'all' ? true : scope === 'shared' ? !!p.shared : !p.shared))
    .filter((p) => !query.trim() || (p.name || '').toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (sortBy === 'name' ? (a.name || '').localeCompare(b.name || '') : sortBy === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt));

  return (
    <div className="absolute inset-0 flex flex-col md:flex-row bg-[#FBFCFE]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-white border-r border-gray-100">
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="px-3 pt-1 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Create</div>
          <button onClick={() => { setCreateOpen(true); setErr(''); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 text-left">
            <Plus size={18} className="text-gray-500" /> New project
          </button>
        </nav>
      </aside>

      {/* content */}
      <div className="flex-1 min-w-0 overflow-auto">
        <div className="px-4 py-6 md:px-10 md:py-10 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800">{heading}</h2>
              <button onClick={() => { setCreateOpen(true); setErr(''); }} className="md:hidden flex items-center gap-1.5 bg-[#473AE0] text-white text-sm font-medium rounded-full px-3 py-1.5"><Plus size={15} /> New</button>
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
                      <button key={k} onClick={() => { setSortBy(k); setSortOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${sortBy === k ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-700 hover:bg-gray-50'}`}>{label}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {!hasBackend() && <div className="text-sm text-amber-600 mb-4">Markup needs the backend running (set REACT_APP_API_URL).</div>}
          {err && <div className="text-sm text-red-500 mb-4">{err}</div>}

          {visible.length === 0 ? (
            <div className="text-gray-400 text-sm">{query ? `No projects match “${query}”.` : 'Nothing here yet.'}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visible.map((p) => (
                <div key={p.id} onClick={() => onOpen(p.id)}
                     className={`group relative rounded-2xl border bg-white hover:shadow-md transition cursor-pointer ${menuId === p.id ? 'z-30' : ''} ${p.completed ? 'border-green-300' : 'border-gray-200 hover:border-indigo-300'}`}>
                  {/* thumbnail */}
                  <div className="relative h-40 bg-gray-50 border-b border-gray-100 flex items-center justify-center overflow-hidden rounded-t-2xl">
                    {p.screenshot
                      ? <img src={p.screenshot} alt="" className="w-full h-full object-cover object-top" onError={(e) => { e.target.style.display = 'none'; }} />
                      : <div className="w-12 h-12 rounded-xl bg-indigo-50 text-[#473AE0] flex items-center justify-center">{p.type === 'zip' ? <FileArchive size={24} /> : <Globe size={24} />}</div>}
                    {p.completed ? (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 bg-green-50 text-green-600 text-[11px] font-semibold rounded-full px-2 py-0.5"><CheckCircle2 size={12} /> Complete</span>
                    ) : p.shared ? (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 bg-indigo-50 text-[#473AE0] text-[11px] font-semibold rounded-full px-2 py-0.5"><Users size={12} /> Shared</span>
                    ) : null}
                  </div>
                  {/* options menu (outside the thumbnail so it isn't clipped) */}
                  <button onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }}
                          className="absolute right-2 top-2 z-10 w-7 h-7 rounded-full bg-white border border-gray-100 shadow-sm text-gray-500 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-gray-50" title="Options"><Settings size={15} /></button>
                  {menuId === p.id && (
                    <CardMenu
                      onRename={() => startRename(p)}
                      canAssignAc={isPM}
                      onSettings={() => { setSettingsProject(p); setMenuId(null); }}
                      onShare={() => { setShareProject(p); setMenuId(null); }}
                      canShare={hasBackend() && !p.shared}
                      onAddVersion={() => { setVersionTarget(p); setMenuId(null); }}
                      onDuplicate={() => doDuplicate(p.id)}
                      onComplete={() => doPatch(p.id, { completed: !p.completed })}
                      completed={!!p.completed}
                      onArchive={() => doPatch(p.id, { archived: !p.archived })}
                      archived={!!p.archived}
                      onDelete={() => { setMenuId(null); setDeleteTarget(p); }}
                      shared={!!p.shared}
                      onClose={() => setMenuId(null)}
                    />
                  )}
                  {/* body */}
                  <div className="p-4">
                    {renamingId === p.id ? (
                      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onClick={(e) => e.stopPropagation()}
                             onBlur={() => commitRename(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') commitRename(p.id); if (e.key === 'Escape') setRenamingId(null); }}
                             className="w-full font-semibold text-gray-800 border-b border-indigo-300 outline-none" />
                    ) : (
                      <div className="font-semibold text-gray-800 truncate">{p.name}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">Updated {relTime(p.updatedAt)}</div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1.5" title="Resolved comments"><CheckCircle2 size={15} className="text-gray-400" /> {p.resolvedCount || 0}</span>
                      <span className="inline-flex items-center gap-1.5" title="Total comments"><MessageSquare size={15} className="text-gray-400" /> {p.commentCount || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {createOpen && <CreateMarkupModal onClose={() => setCreateOpen(false)} onCreated={handleCreated} setBusy={setBusy} designMode={designMode} />}

      {versionTarget && (
        <AddVersionModalDash projectId={versionTarget.id} onClose={() => setVersionTarget(null)} setBusy={setBusy}
          onAdded={() => { const pid = versionTarget.id; setVersionTarget(null); onOpen(pid); }} />
      )}

      {busy && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/20">
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center">
            <style>{`@keyframes mpulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.7}}`}</style>
            <div style={{ animation: 'mpulse 1.1s ease-in-out infinite' }}><BrandStar size={40} /></div>
            <div className="mt-4 text-sm font-medium text-gray-700">{busy}</div>
          </div>
        </div>
      )}

      {shareProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={() => setShareProject(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-xl font-bold text-gray-800">Share “{shareProject.name}”</h2>
              <button onClick={() => setShareProject(null)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Invite people by email — they get access as soon as they sign up.</p>
            <InvitePanel projectId={shareProject.id} api={MEMBER_API} />
          </div>
        </div>
      )}

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
              onSave={async (acId) => { const updated = await setMarkupActiveCollab(settingsProject.id, acId); setSettingsProject((p) => (p ? { ...p, ...updated } : p)); refresh(); return updated; }}
            />
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center" onMouseDown={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">{deleteTarget.shared ? <LogOut size={22} /> : <Trash2 size={22} />}</div>
            <h2 className="text-lg font-bold text-gray-800">{deleteTarget.shared ? 'Leave project' : 'Delete markup project'}</h2>
            <p className="text-sm text-gray-500 mt-1.5">
              {deleteTarget.shared
                ? <>Remove <span className="font-semibold text-gray-700">“{deleteTarget.name}”</span> from your list? The owner keeps it.</>
                : <>Delete <span className="font-semibold text-gray-700">“{deleteTarget.name}”</span> and all its comments? This can’t be undone.</>}
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-full py-2.5 font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 rounded-full py-2.5 font-medium text-white bg-red-500 hover:bg-red-600">{deleteTarget.shared ? 'Leave' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardMenu({ onRename, onSettings, onDuplicate, onShare, canShare, canAssignAc, onAddVersion, onComplete, completed, onArchive, archived, onDelete, shared, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [onClose]);
  const item = 'w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-gray-50 text-left whitespace-nowrap';
  return (
    <div ref={ref} className="absolute right-2 top-9 z-20 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5" onClick={(e) => e.stopPropagation()}>
      <button className={item + ' text-gray-700'} onClick={onAddVersion}><History size={15} /> Add version</button>
      <button className={item + ' text-gray-700'} onClick={onRename}><Pencil size={15} /> Rename</button>
      {canAssignAc && <button className={item + ' text-gray-700'} onClick={onSettings}><AcIcon size={15} /> Assign AC Project</button>}
      {canShare && <button className={item + ' text-gray-700'} onClick={onShare}><Share2 size={15} /> Share</button>}
      <button className={item + ' text-gray-700'} onClick={onDuplicate}><Copy size={15} /> Duplicate</button>
      <button className={item + ' text-gray-700'} onClick={onComplete}>{completed ? <><Circle size={15} /> Mark as active</> : <><CheckCircle2 size={15} /> Mark as complete</>}</button>
      <button className={item + ' text-gray-700'} onClick={onArchive}>{archived ? <><ArchiveRestore size={15} /> Restore</> : <><Archive size={15} /> Archive</>}</button>
      <div className="h-px bg-gray-100 my-1" />
      <button className={item + ' text-red-500'} onClick={onDelete}>{shared ? <><LogOut size={15} /> Leave project</> : <><Trash2 size={15} /> Delete</>}</button>
    </div>
  );
}

/* Add a new version to an existing project (from the dashboard gear menu). */
function AddVersionModalDash({ projectId, onClose, onAdded, setBusy }) {
  const [tab, setTab] = useState('url');
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const tabCls = (t) => `pb-2 text-base ${tab === t ? 'text-gray-800 border-b-2 border-[#10B981] font-medium' : 'text-gray-500'}`;

  const addUrl = async () => {
    const u = url.trim(); if (!u) return;
    setBusy('Adding version…'); setErr('');
    try { await addMarkupVersionUrl(projectId, u); onAdded(); } catch (e) { setErr(e.message || 'Failed'); } finally { setBusy(''); }
  };
  const onFile = (file) => {
    if (!file) return;
    setBusy('Uploading & unpacking…'); setErr('');
    const reader = new FileReader();
    reader.onload = async () => { try { await addMarkupVersionZip(projectId, reader.result); onAdded(); } catch (e) { setErr(e.message || 'Upload failed'); } finally { setBusy(''); } };
    reader.onerror = () => { setErr('Could not read the file.'); setBusy(''); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[94vw]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800">Add a new version</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center shrink-0"><X size={16} /></button>
        </div>
        <div className="px-7 pt-5 pb-7">
        <div className="flex items-center gap-6 border-b border-gray-100">
          <button onClick={() => { setTab('url'); setErr(''); }} className={tabCls('url')}>From URL</button>
          <button onClick={() => { setTab('zip'); setErr(''); }} className={tabCls('zip')}>Upload ZIP</button>
        </div>
        {tab === 'url' ? (
          <div className="mt-5">
            <p className="text-gray-500 text-sm mb-4">A new version with its own comments.</p>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3">
              <Globe size={16} className="text-gray-400" />
              <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addUrl(); }} placeholder="https://example.com" className="flex-1 outline-none text-sm" />
            </div>
            <button onClick={addUrl} disabled={!url.trim()} className="mt-5 bg-[#473AE0] text-white rounded-full px-6 py-2.5 text-sm font-medium hover:bg-[#3a2fc0] disabled:opacity-50">Add version</button>
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-gray-500 text-sm mb-4">Upload a static site <b>.zip</b> as a new version.</p>
            <input ref={fileRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => onFile(e.target.files[0])} />
            <button onClick={() => fileRef.current && fileRef.current.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files[0]); }}
                    className={`w-full border-2 border-dashed rounded-xl py-12 flex flex-col items-center gap-2 ${dragOver ? 'border-indigo-400 bg-indigo-50 text-indigo-500' : 'border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-400'}`}>
              <Upload size={22} /><span className="text-sm">{dragOver ? 'Drop the .zip here' : 'Click or drag a .zip here'}</span>
            </button>
          </div>
        )}
        {err && <div className="text-sm text-red-500 mt-3">{err}</div>}
        </div>
      </div>
    </div>
  );
}

/* Create modal — pick the project type via tabs: Blank (design) / URL / ZIP. */
export function CreateMarkupModal({ onClose, onCreated, setBusy, designMode = false }) {
  const [tab, setTab] = useState(designMode ? 'blank' : 'url');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [sgList, setSgList] = useState([]);   // style guides (mine + shared with me)
  const [sgSel, setSgSel] = useState('');
  const [sgOpen, setSgOpen] = useState(false);
  const [sgQuery, setSgQuery] = useState('');
  const fileRef = useRef(null);
  const tabCls = (t) => `pb-2 text-base ${tab === t ? 'text-gray-800 border-b-2 border-[#10B981] font-medium' : 'text-gray-500'}`;

  // load the user's style guides so a new design can adopt one (mine + shared only)
  useEffect(() => {
    if (!designMode || !hasBackend()) return;
    let active = true;
    listStyleGuides().then((list) => { if (active) setSgList(Array.isArray(list) ? list : []); }).catch(() => {});
    return () => { active = false; };
  }, [designMode]);

  const addBlank = async () => {
    setBusy('Creating design…'); setErr('');
    try {
      const p = await createBlankDesign(name.trim() || 'Untitled design');
      if (sgSel && p && p.id) { try { localStorage.setItem('qoders-design-sg-' + p.id, sgSel); } catch (e) {} }
      onCreated(p);
    } catch (e) { setErr(e.message || 'Failed'); } finally { setBusy(''); }
  };
  const addUrl = async () => {
    const u = url.trim(); if (!u) return;
    setBusy('Adding site…'); setErr('');
    try { const p = await createMarkupFromUrl('', u); onCreated(p); } catch (e) { setErr(e.message || 'Failed'); } finally { setBusy(''); }
  };
  const onFile = (file) => {
    if (!file) return;
    setBusy('Uploading & unpacking…'); setErr('');
    const reader = new FileReader();
    reader.onload = async () => {
      try { const p = await uploadMarkupZip(file.name.replace(/\.zip$/i, ''), reader.result); onCreated(p); }
      catch (e) { setErr(e.message || 'Upload failed'); } finally { setBusy(''); }
    };
    reader.onerror = () => { setErr('Could not read the file.'); setBusy(''); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[94vw]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800">{designMode ? 'New design' : 'New markup project'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center shrink-0"><X size={16} /></button>
        </div>
        <div className="px-7 pt-5 pb-7">
        <div className="flex items-center gap-6 border-b border-gray-100">
          {designMode && <button onClick={() => { setTab('blank'); setErr(''); }} className={tabCls('blank')}>Blank</button>}
          <button onClick={() => { setTab('url'); setErr(''); }} className={tabCls('url')}>From URL</button>
          <button onClick={() => { setTab('zip'); setErr(''); }} className={tabCls('zip')}>Upload ZIP</button>
        </div>

        {tab === 'blank' ? (
          <div className="mt-5">
            <p className="text-gray-500 text-sm mb-4">Start a fresh design — a clean, empty <b>index.html</b> you build from scratch.</p>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3">
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addBlank(); }} placeholder="Design name (e.g. Landing)" className="flex-1 outline-none text-sm" />
            </div>
            {hasBackend() && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Style guide <span className="text-gray-400 font-normal">(optional)</span></label>
                <div className="relative">
                  <button type="button" onClick={() => { setSgOpen((v) => !v); setSgQuery(''); }}
                          className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white hover:border-indigo-300">
                    <span className={sgSel ? 'text-gray-800 truncate' : 'text-gray-400'}>
                      {sgSel ? (sgList.find((g) => g.id === sgSel)?.name || 'Style guide') : 'No style guide'}
                    </span>
                    <ChevronDown size={16} className="text-gray-400 shrink-0" />
                  </button>
                  {sgOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setSgOpen(false)} />
                      <div className="absolute left-0 right-0 top-12 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5">
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2.5 py-1.5 mb-1.5">
                          <Search size={14} className="text-gray-400" />
                          <input autoFocus value={sgQuery} onChange={(e) => setSgQuery(e.target.value)} placeholder="Search style guides…"
                                 className="flex-1 bg-transparent outline-none text-sm" />
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          <button type="button" onClick={() => { setSgSel(''); setSgOpen(false); }}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-sm ${!sgSel ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-600 hover:bg-gray-50'}`}>No style guide</button>
                          {sgList.filter((g) => (g.name || '').toLowerCase().includes(sgQuery.trim().toLowerCase())).map((g) => (
                            <button type="button" key={g.id} onClick={() => { setSgSel(g.id); setSgOpen(false); }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left ${sgSel === g.id ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-700 hover:bg-gray-50'}`}>
                              <span className="flex gap-0.5 shrink-0">
                                {((g.preview && g.preview.colors) || []).slice(0, 5).map((c, i) => (
                                  <span key={i} className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: c }} />
                                ))}
                              </span>
                              <span className="flex-1 truncate">{g.name}</span>
                              {g.shared && <span className="text-[10px] text-gray-400 shrink-0">shared</span>}
                            </button>
                          ))}
                          {sgList.filter((g) => (g.name || '').toLowerCase().includes(sgQuery.trim().toLowerCase())).length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-400">No matches.</div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-gray-400 mt-1.5">Its Text, Colors &amp; Buttons load into the design’s assets.</div>
              </div>
            )}
            <button onClick={addBlank} className="mt-5 bg-[#473AE0] text-white rounded-full px-6 py-2.5 text-sm font-medium hover:bg-[#3a2fc0]">Create design</button>
          </div>
        ) : tab === 'url' ? (
          <div className="mt-5">
            <p className="text-gray-500 text-sm mb-4">Paste a website URL — we’ll load it so you can drop comments on it.</p>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3">
              <Globe size={16} className="text-gray-400" />
              <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addUrl(); }}
                     placeholder="https://example.com" className="flex-1 outline-none text-sm" />
            </div>
            <button onClick={addUrl} disabled={!url.trim()} className="mt-5 bg-[#473AE0] text-white rounded-full px-6 py-2.5 text-sm font-medium hover:bg-[#3a2fc0] disabled:opacity-50">Add site</button>
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-gray-500 text-sm mb-4">Upload a static site as a <b>.zip</b> (HTML/CSS/JS). We unpack it and let you switch between pages.</p>
            <input ref={fileRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => onFile(e.target.files[0])} />
            <button onClick={() => fileRef.current && fileRef.current.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files[0]); }}
                    className={`w-full border-2 border-dashed rounded-xl py-12 flex flex-col items-center gap-2 ${dragOver ? 'border-indigo-400 bg-indigo-50 text-indigo-500' : 'border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-400'}`}>
              <Upload size={22} />
              <span className="text-sm">{dragOver ? 'Drop the .zip here' : 'Click or drag a .zip site export'}</span>
            </button>
          </div>
        )}
        {err && <div className="text-sm text-red-500 mt-3">{err}</div>}
        </div>
      </div>
    </div>
  );
}
