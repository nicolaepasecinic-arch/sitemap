import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, ChevronDown, Settings, Users, Bot, LogOut, Play, Download, X,
  FileText, Map, Palette, Wand2, FilePlus2, LayoutTemplate, DownloadCloud,
  LayoutGrid, Sparkles, Image as ImageIcon,
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
import PageEditor from './PageEditor';
import SitemapBuilder from '../sitemap/SitemapBuilder';
import StyleGuideEditor from '../styleguide/StyleGuideEditor';
import DesignEditor from '../design/DesignEditor';
import { getProject, saveProject, createProject, createProjectFromTemplate, uid } from '../projectStore';
import { createStyleGuide, listStyleGuides } from '../styleguide/styleguideStore';
import { apiGenerateStyleGuide } from '../styleguide/styleguideApi';
import { NewStyleGuideModal, StyleGuideGenerateModal } from '../styleguide/styleguideCards';
import { CreateMarkupModal } from '../markup/MarkupDashboard';
import { TEMPLATES } from '../sitemap/templates';
import { Thumb as SitemapThumb, ImportModal, GenerateModal } from '../sitemap/Dashboard';
import { apiImportSitemap, apiCrawlSite, apiGenerateSitemap } from '../api';
import { parseImport, parseSitemapXml, cleanProjectName } from '../sitemap/importSitemap';

const BOARD_MEMBER_API = {
  listMembers: apiListBoardMembers, addMember: apiAddBoardMember,
  removeMember: apiRemoveBoardMember, removeInvite: apiRemoveBoardInvite,
};

/* The create panel shown when a Sitemap / Style guide / Design isn't linked yet. */
function CreatePanel({ kind, onBlank, onTemplate, onImport, onGenerate, onNewGuide, onGenerateGuide, onPickGuide, onCreateDesign, hasAI }) {
  const row = 'w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-[#473AE0] hover:bg-indigo-50/40 text-left transition';
  const META = {
    sitemap: { icon: <Map size={26} />, title: 'No sitemap yet' },
    styleguide: { icon: <Palette size={26} />, title: 'No style guide yet' },
    design: { icon: <Wand2 size={26} />, title: 'No design yet' },
  }[kind] || { icon: <Map size={26} />, title: 'Nothing here yet' };
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#FBFCFE] p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-[#473AE0] flex items-center justify-center mx-auto mb-3">{META.icon}</div>
          <h2 className="text-xl font-bold text-gray-800">{META.title}</h2>
          <p className="text-sm text-gray-500 mt-1">Create one for this project — it stays linked here.</p>
        </div>
        {kind === 'sitemap' && (
          <div className="space-y-2.5">
            <button className={row} onClick={onBlank}><FilePlus2 size={18} className="text-gray-500" /><span className="text-sm font-medium text-gray-700">New blank sitemap</span></button>
            <button className={row} onClick={onTemplate}><LayoutTemplate size={18} className="text-gray-500" /><span className="text-sm font-medium text-gray-700">Choose a template</span></button>
            <button className={row} onClick={onImport}><DownloadCloud size={18} className="text-gray-500" /><span className="text-sm font-medium text-gray-700">Import website</span></button>
            <button className={row} onClick={onGenerate}><Wand2 size={18} className="text-gray-500" /><span className="text-sm font-medium text-gray-700">Generate with AI</span></button>
          </div>
        )}
        {kind === 'styleguide' && (
          <div className="space-y-2.5">
            <button className={row} onClick={onPickGuide}><LayoutTemplate size={18} className="text-gray-500" /><span className="text-sm font-medium text-gray-700">Use an existing style guide</span></button>
            <button className={row} onClick={onNewGuide}><FilePlus2 size={18} className="text-gray-500" /><span className="text-sm font-medium text-gray-700">New style guide</span></button>
            {hasAI && <button className={row} onClick={onGenerateGuide}><Sparkles size={18} className="text-[#473AE0]" /><span className="text-sm font-medium text-gray-700">Generate with AI</span></button>}
          </div>
        )}
        {kind === 'design' && (
          <button className={row + ' justify-center'} onClick={onCreateDesign}><Wand2 size={18} className="text-[#473AE0]" /><span className="text-sm font-semibold text-[#473AE0]">Create design</span></button>
        )}
      </div>
    </div>
  );
}

/* Template picker (reuses the Sitemap templates + thumbnail). */
function TemplatesModal({ onClose, onPick }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-6" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[920px] max-w-[94vw] max-h-[90vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="p-6 pb-3 flex items-start justify-between">
          <h2 className="text-xl font-bold text-gray-800">Choose a template</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto px-6 pb-6 grid grid-cols-2 sm:grid-cols-3 gap-5">
          {TEMPLATES.map((t) => {
            const preview = t.nodes();
            return (
              <button key={t.id} onClick={() => onPick(t)} className="text-left rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition p-4">
                <div className="bg-gray-50 rounded-lg py-4"><SitemapThumb nodes={preview} /></div>
                <div className="mt-3 font-semibold text-[#473AE0]">{t.name}</div>
                <div className="text-xs text-gray-400">{preview.length} pages</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ProjectShell({ id, user, onLogout, onUserChange, onBack }) {
  const [board, setBoard] = useState(null);
  const [name, setName] = useState('Untitled project');
  const [tab, setTab] = useState('details');
  const [sitemapProject, setSitemapProject] = useState(null);
  const [acctMenuOpen, setAcctMenuOpen] = useState(false);
  const [acctModalOpen, setAcctModalOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [connectAiOpen, setConnectAiOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [sgNewOpen, setSgNewOpen] = useState(false);
  const [sgGenerateOpen, setSgGenerateOpen] = useState(false);
  const [sgPickOpen, setSgPickOpen] = useState(false);
  const [sgPickList, setSgPickList] = useState(null);
  const [designCreateOpen, setDesignCreateOpen] = useState(false);

  const settings = (board && board.settings) || {};
  const sitemapId = settings.sitemapId || '';
  const styleguideId = settings.styleguideId || '';
  const designId = settings.designId || '';

  useEffect(() => {
    let active = true;
    getBoard(id).then((b) => { if (active && b) { setBoard(b); setName(b.name || 'Untitled project'); } });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (tab !== 'sitemap' || !sitemapId) { return; }
    let active = true;
    setSitemapProject(null);
    getProject(sitemapId).then((p) => { if (active) setSitemapProject(p || false); });
    return () => { active = false; };
  }, [tab, sitemapId]);

  const patchSettings = async (extra) => {
    const s = { ...settings, ...extra };
    setBoard((b) => (b ? { ...b, settings: s } : b));
    await saveBoard(id, { settings: s });
  };
  const linkSitemap = async (pid) => { await patchSettings({ sitemapId: pid }); setTab('sitemap'); };
  const linkStyleguide = async (sid) => { await patchSettings({ styleguideId: sid }); setTab('styleguide'); };
  const linkDesign = async (did) => { await patchSettings({ designId: did }); setTab('design'); };

  const commitName = () => {
    const n = name.trim() || 'Untitled project';
    setName(n);
    if (board) saveBoard(id, { name: n });
  };
  const handlePdf = async () => {
    if (!board || pdfBusy) return;
    setPdfBusy(true);
    try { await downloadBoardPdf(id); } catch (e) { window.alert(e.message || 'Could not generate the PDF'); }
    setPdfBusy(false);
  };

  // create flows (reuse existing store + APIs)
  const createBlankSitemap = async () => { const p = await createProject(`${name} — sitemap`); await linkSitemap(p.id); };
  const pickTemplate = async (tpl) => { const p = await createProjectFromTemplate(tpl.name, tpl.nodes()); setTemplatesOpen(false); await linkSitemap(p.id); };
  // style guide
  const createBlankGuide = async (gName) => { const p = await createStyleGuide(gName || `${name} — style guide`); setSgNewOpen(false); await linkStyleguide(p.id); };
  const generateGuide = async (payload) => { const r = await apiGenerateStyleGuide(payload); setSgGenerateOpen(false); if (r && r.id) await linkStyleguide(r.id); };
  const openSgPick = async () => { setSgPickOpen(true); if (sgPickList == null) { try { setSgPickList(await listStyleGuides()); } catch (e) { setSgPickList([]); } } };
  const pickExistingGuide = async (gid) => { setSgPickOpen(false); await linkStyleguide(gid); };
  // design (reuse the Markup design-mode create modal)
  const onDesignCreated = async (p) => { setDesignCreateOpen(false); if (p && p.id) await linkDesign(p.id); };

  const TAB = (key, label, Icon) => (
    <button onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition
              ${tab === key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
      <Icon size={16} className={tab === key ? 'text-[#473AE0]' : 'text-gray-400'} /> {label}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-[#F1F3F7] flex flex-col"
         style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* ---------- Project top bar with sub-nav ---------- */}
      <div className="h-14 shrink-0 bg-white border-b border-gray-100 flex items-center px-4 z-30">
        <div className="flex items-center gap-2 w-72">
          <button onClick={onBack} title="Back to projects" className="w-9 h-9 rounded-full hover:bg-gray-50 flex items-center justify-center text-gray-600"><ArrowLeft size={17} /></button>
          <button onClick={onBack} className="w-9 h-9 rounded-lg hover:bg-gray-50 flex items-center justify-center"><BrandStar size={22} /></button>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={commitName}
                 onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                 className="text-[15px] font-semibold text-[#473AE0] bg-transparent outline-none focus:bg-gray-50 focus:ring-1 focus:ring-indigo-200 rounded px-1 w-44" />
        </div>

        {/* sub-nav */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
            {TAB('details', 'Details', FileText)}
            {TAB('sitemap', 'Sitemap', Map)}
            {TAB('moodboard', 'Moodboard', LayoutGrid)}
            {TAB('styleguide', 'Style guide', Palette)}
            {TAB('design', 'Design', Wand2)}
          </div>
        </div>

        <div className="w-72 flex items-center justify-end gap-2">
          {hasBackend() && <button onClick={() => setShareOpen(true)} className="flex items-center gap-1 bg-[#473AE0] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-indigo-600">Share <Play size={13} className="ml-1" fill="white" /></button>}
          {hasBackend() && <button onClick={handlePdf} disabled={pdfBusy} title="Download all pages as PDF" className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-50"><Download size={16} className={pdfBusy ? 'animate-pulse' : ''} /></button>}
          {hasBackend() && <button onClick={() => setSettingsOpen(true)} title="Project settings" className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Settings size={16} /></button>}
          <div className="relative">
            <button onClick={() => setAcctMenuOpen((v) => !v)} className="flex items-center gap-2 hover:bg-gray-50 rounded-full pl-1 pr-2 py-1">
              <span className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-bold">{initials(user?.name) || 'NP'}</span>
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
      </div>

      {/* ---------- Content ---------- */}
      <div className="flex-1 relative min-h-0">
        {tab === 'details' && board && (
          <PageEditor embedded id={id} board={board} user={user} onLogout={onLogout} onUserChange={onUserChange} onBack={onBack} />
        )}

        {tab === 'sitemap' && (
          sitemapId ? (
            sitemapProject ? (
              <SitemapBuilder embedded project={sitemapProject} user={user} onLogout={onLogout} onUserChange={onUserChange}
                onBack={() => setTab('details')} onChange={(patch) => saveProject(sitemapId, patch)} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Loading sitemap…</div>
            )
          ) : (
            <CreatePanel kind="sitemap" onBlank={createBlankSitemap} onTemplate={() => setTemplatesOpen(true)} onImport={() => setImportOpen(true)} onGenerate={() => setGenerateOpen(true)} />
          )
        )}

        {tab === 'moodboard' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
            <ImageIcon size={28} />
            <div className="text-sm font-medium text-gray-500">Moodboard — coming soon</div>
            <div className="text-xs">A visual moodboard for this project will live here.</div>
          </div>
        )}

        {tab === 'styleguide' && (
          styleguideId ? (
            <StyleGuideEditor embedded key={styleguideId} id={styleguideId} user={user}
              onLogout={onLogout} onUserChange={onUserChange} onBack={() => setTab('details')} />
          ) : (
            <CreatePanel kind="styleguide" hasAI={hasBackend()}
              onPickGuide={openSgPick} onNewGuide={() => setSgNewOpen(true)} onGenerateGuide={() => setSgGenerateOpen(true)} />
          )
        )}

        {tab === 'design' && (
          designId ? (
            <DesignEditor embedded key={designId} id={designId} styleguideId={styleguideId} onBack={() => setTab('details')} />
          ) : (
            <CreatePanel kind="design" onCreateDesign={() => setDesignCreateOpen(true)} />
          )
        )}
      </div>

      {/* ---------- Sitemap create sub-modals (reused) ---------- */}
      {templatesOpen && <TemplatesModal onClose={() => setTemplatesOpen(false)} onPick={pickTemplate} />}
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onOpen={(pid) => { setImportOpen(false); linkSitemap(pid); }}
          onImportNodes={async (nm, text, filename) => {
            const nodes = parseImport(text, filename);
            if (!nodes || !nodes.length) throw new Error('Could not read that file. Use an Octopus.do XML export or a sitemap.xml.');
            const p = await createProjectFromTemplate(cleanProjectName(filename || nm, nodes), nodes);
            return { id: p.id, pages: nodes.length };
          }}
          onImportUrl={async (url, mode) => {
            if (!hasBackend()) throw new Error('URL import needs the backend running.');
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
      {generateOpen && (
        <GenerateModal
          onClose={() => setGenerateOpen(false)}
          onOpen={(pid) => { setGenerateOpen(false); linkSitemap(pid); }}
          onGenerate={async (prompt) => {
            if (!hasBackend()) throw new Error('AI generation needs the backend running.');
            const res = await apiGenerateSitemap(prompt);
            const aiPages = (res && res.pages) || [];
            if (!aiPages.length) throw new Error('AI returned no pages. Try a more detailed description.');
            const idMap = {};
            aiPages.forEach((p) => { idMap[p.id] = uid(); });
            const nodes = aiPages.map((p) => ({
              id: idMap[p.id], label: p.title || 'Page',
              parentId: p.parentId && idMap[p.parentId] ? idMap[p.parentId] : null,
              group: 'main', color: 'blue', link: '', pageFrame: 'window',
              blocks: (p.sections || []).map((s) => ({ id: uid(), name: s.name || 'Section', color: s.color || 'blue', frame: s.frame || 'bar', done: false, arrowTargets: [], description: s.description || '' })),
            }));
            const proj = await createProjectFromTemplate(res.projectName || 'AI sitemap', nodes);
            return { id: proj.id, pages: nodes.length, name: res.projectName };
          }}
        />
      )}

      {/* ---------- Style guide create sub-modals (reused) ---------- */}
      {sgNewOpen && <NewStyleGuideModal onClose={() => setSgNewOpen(false)} onCreate={createBlankGuide} />}
      {sgGenerateOpen && <StyleGuideGenerateModal onClose={() => setSgGenerateOpen(false)} onGenerate={generateGuide} />}
      {sgPickOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-6" onMouseDown={() => setSgPickOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Palette size={18} className="text-[#473AE0]" /> Use a style guide</h2>
              <button onClick={() => setSgPickOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Pick one to power this project — its Text, Colors &amp; Buttons feed the Design tool.</p>
            <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
              {sgPickList == null && <div className="text-sm text-gray-400 py-4 text-center">Loading…</div>}
              {sgPickList && sgPickList.length === 0 && <div className="text-sm text-gray-400 py-4 text-center">No style guides yet — create or generate one.</div>}
              {sgPickList && sgPickList.map((g) => (
                <button key={g.id} onClick={() => pickExistingGuide(g.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-[#473AE0] hover:bg-indigo-50/40 text-left transition">
                  <Palette size={16} className="text-[#473AE0] shrink-0" />
                  <span className="flex-1 truncate text-sm font-medium text-gray-700">{g.name}</span>
                  {g.id === styleguideId && <span className="text-[11px] text-[#473AE0] font-semibold">Linked</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Design create sub-modal (reused Markup design-mode) ---------- */}
      {designCreateOpen && <CreateMarkupModal designMode onClose={() => setDesignCreateOpen(false)} onCreated={onDesignCreated} setBusy={() => {}} />}

      {/* ---------- Project settings drawer (Active Collab) ---------- */}
      {settingsOpen && board && (
        <div className="fixed inset-0 z-50" onMouseDown={() => setSettingsOpen(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <style>{`@keyframes qdrawer{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
          <div className="absolute top-0 right-0 h-full w-[380px] max-w-[92vw] bg-white shadow-2xl flex flex-col" style={{ animation: 'qdrawer .22s ease-out' }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-14 shrink-0 px-5 flex items-center justify-between border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Project settings</h2>
              <button onClick={() => setSettingsOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 truncate">{name}</div>
              <ActiveCollabField acProjectId={board.acProjectId || ''} acProjectName={board.acProjectName || ''}
                onSave={async (acId) => { const updated = await apiSetBoardActiveCollab(id, acId); setBoard((b) => (b ? { ...b, ...updated } : b)); return updated; }} />
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
              <button onClick={() => setShareOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Invite people by email — they get access as soon as they sign up.</p>
            <InvitePanel projectId={id} api={BOARD_MEMBER_API} />
          </div>
        </div>
      )}

      {acctModalOpen && <Account user={user || {}} onClose={() => setAcctModalOpen(false)} onUpdated={(u) => onUserChange && onUserChange(u)} onLogout={onLogout} />}
      {teamOpen && <Team user={user} onClose={() => setTeamOpen(false)} />}
      {connectAiOpen && <ConnectAI onClose={() => setConnectAiOpen(false)} />}
    </div>
  );
}
