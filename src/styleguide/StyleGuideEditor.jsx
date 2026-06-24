import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Download, Share2, X, Check, Loader2, Copy, Users, ChevronDown, ChevronLeft, ChevronRight, Settings, Bot, LogOut, Save, Plus, Trash2, History, Sparkles, Send } from 'lucide-react';
import InvitePanel from '../components/InvitePanel';
import Account from '../components/Account';
import Team from '../components/Team';
import ConnectAI from '../components/ConnectAI';
import BrandStar from '../components/Brand';
import { initials } from '../auth';
import { getStyleGuide, saveStyleGuide, renameStyleGuide } from './styleguideStore';
import { hasBackend, downloadStyleGuide, apiPatchStyleGuide, apiStyleGuideAssistant, apiListStyleGuideMembers, apiAddStyleGuideMember, apiRemoveStyleGuideMember, apiRemoveStyleGuideInvite, apiListSgVersions, apiGetSgVersion, apiCreateSgVersion, apiPatchSgVersion, apiDeleteSgVersion } from './styleguideApi';
import { buildEditableDoc } from './editorLayer';

const SG_MEMBER_API = {
  listMembers: apiListStyleGuideMembers,
  addMember: apiAddStyleGuideMember,
  removeMember: apiRemoveStyleGuideMember,
  removeInvite: apiRemoveStyleGuideInvite,
};

// Section model — matches the section[id] anchors in the design-system document.
const SECTIONS = [
  { id: 'brand', n: '01', label: 'Brand' },
  { id: 'colors', n: '02', label: 'Colors' },
  { id: 'typography', n: '03', label: 'Typography' },
  { id: 'spacing', n: '04', label: 'Spacing & Radii' },
  { id: 'content', n: '05', label: 'Links & Lists' },
  { id: 'forms', n: '06', label: 'Forms' },
  { id: 'components', n: '07', label: 'Components' },
  { id: 'breakpoints', n: '08', label: 'Breakpoints' },
];

export default function StyleGuideEditor({ id, user, onBack, onLogout, onUserChange, embedded = false }) {
  const [guide, setGuide] = useState(null);
  const [name, setName] = useState('');
  const [doc, setDoc] = useState(null);          // srcDoc, set once
  const [status, setStatus] = useState('saved'); // saved | unsaved | saving
  const [notFound, setNotFound] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTab, setShareTab] = useState('link');
  const [toast, setToast] = useState('');
  const [acctMenuOpen, setAcctMenuOpen] = useState(false);
  const [acctModalOpen, setAcctModalOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [connectAiOpen, setConnectAiOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('colors');
  const [editMode, setEditMode] = useState('properties'); // properties | everything (editor-only)
  const editModeRef = useRef('properties'); editModeRef.current = editMode;
  const [versions, setVersions] = useState([]);
  const [currentVid, setCurrentVid] = useState(null);
  const [versionMenu, setVersionMenu] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [chat, setChat] = useState([{ role: 'ai', text: "Hi! I'm your Style Guide assistant. Tell me what to change — colours, fonts, spacing — or paste a website URL and I'll match its look." }]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const iframeRef = useRef(null);
  const pillsRef = useRef(null);
  const timerRef = useRef(null);
  const vidRef = useRef(null);
  const readOnly = guide?.role === 'viewer';

  useEffect(() => { vidRef.current = currentVid; }, [currentVid]);
  const sg = () => { const w = iframeRef.current && iframeRef.current.contentWindow; return w && w.__sg ? w.__sg : null; };
  // tell the in-iframe editor which mode to use (Properties = token editing, Everything = free)
  const postMode = useCallback((m) => { const w = iframeRef.current && iframeRef.current.contentWindow; if (w) w.postMessage({ source: 'sg-host', type: 'mode', mode: m }, '*'); }, []);

  // load the guide + its versions; open the latest version
  useEffect(() => {
    let active = true;
    getStyleGuide(id).then(async (g) => {
      if (!active) return;
      if (!g) { setNotFound(true); return; }
      setGuide(g);
      setName(g.name || '');
      if (hasBackend()) {
        try {
          const vs = await apiListSgVersions(id);
          if (!active) return;
          if (vs && vs.length) {
            setVersions(vs);
            const latest = vs[vs.length - 1];
            const v = await apiGetSgVersion(latest.id);
            if (!active) return;
            setCurrentVid(latest.id);
            setDoc(buildEditableDoc(v.content || ''));
            return;
          }
        } catch (e) { /* fall back to guide content */ }
      }
      setDoc(buildEditableDoc(g.content || ''));
    });
    return () => { active = false; };
  }, [id]);

  const save = useCallback(async () => {
    const api = sg();
    if (!api || readOnly) return;
    let html; try { html = api.serialize(); } catch (e) { return; }
    setStatus('saving');
    try {
      const vid = vidRef.current;
      if (hasBackend() && vid) await apiPatchSgVersion(vid, html);
      else if (hasBackend()) await apiPatchStyleGuide(id, { content: html });
      else await saveStyleGuide(id, { content: html });
      setStatus('saved');
    } catch (e) {
      setStatus('unsaved');
      setToast('Save failed — is the backend running?');
      setTimeout(() => setToast(''), 2600);
    }
  }, [id, readOnly]);

  // load a version into the canvas (optionally persisting current edits first)
  const loadVersion = useCallback(async (vid, persistFirst = true) => {
    if (persistFirst) await save();
    try {
      const v = await apiGetSgVersion(vid);
      setCurrentVid(vid);
      setDoc(buildEditableDoc(v.content || ''));
      setStatus('saved');
    } catch (e) { setToast('Could not open that version.'); setTimeout(() => setToast(''), 2000); }
    setVersionMenu(false);
  }, [save]);

  const newVersion = async () => {
    setVersionMenu(false);
    const api = sg(); let html = ''; try { html = api ? api.serialize() : ''; } catch (e) {}
    try {
      const v = await apiCreateSgVersion(id, html);
      const vs = await apiListSgVersions(id);
      setVersions(vs); setCurrentVid(v.id); setStatus('saved');
      setToast('New version created'); setTimeout(() => setToast(''), 1600);
    } catch (e) { setToast('Could not create a version.'); setTimeout(() => setToast(''), 2000); }
  };

  const removeVersion = async (vid) => {
    try { await apiDeleteSgVersion(vid); } catch (e) { setToast(e.message || 'Could not delete.'); setTimeout(() => setToast(''), 2200); return; }
    const vs = await apiListSgVersions(id);
    setVersions(vs);
    if (vid === currentVid && vs.length) await loadVersion(vs[vs.length - 1].id, false);
  };

  // iframe → parent events
  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data || {};
      if (d.source !== 'sg-editor') return;
      if (d.type === 'dirty') {
        if (readOnly) return;
        setStatus('unsaved');
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { save(); }, 1500);
      } else if (d.type === 'section') {
        if (d.sectionId) setActiveSection(d.sectionId);
      } else if (d.type === 'toast') {
        setToast(d.message || ''); setTimeout(() => setToast(''), 1600);
      } else if (d.type === 'download') {
        const src = d.src; if (!src) return;
        const a = document.createElement('a');
        a.href = src; a.download = 'logo'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
      } else if (d.type === 'ready') {
        postMode(readOnly ? 'everything' : editModeRef.current);
      }
    };
    window.addEventListener('message', onMsg);
    return () => { window.removeEventListener('message', onMsg); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [save, readOnly, postMode]);

  // push mode changes to the iframe live
  useEffect(() => { postMode(editMode); }, [editMode, postMode]);

  // apply the assistant's token + role-font changes to the live document
  const applyAiResult = (out) => {
    const api = sg(); if (!api) return;
    (out.tokenUpdates || []).forEach(({ name, value }) => {
      let v = value;
      if (/font/i.test(name) && v && v.indexOf(',') < 0) { api.loadFont(v); v = '"' + v + '", sans-serif'; }
      api.setToken(name, v);
      // keep the brand-palette swatch hex label in sync (chip uses var(), auto-updates)
      if (api.setPalette && /^#[0-9a-fA-F]{6}$/.test(value)) api.setPalette(name, value);
    });
    (out.roleFonts || []).forEach(({ role, font }) => { if (api.applyRoleFont) api.applyRoleFont(role, font); });
  };
  const sendAssistant = async () => {
    const msg = chatInput.trim();
    if (!msg || chatBusy) return;
    setChat((c) => [...c, { role: 'user', text: msg }]);
    setChatInput(''); setChatBusy(true);
    try {
      const out = await apiStyleGuideAssistant(id, msg);
      applyAiResult(out);
      setChat((c) => [...c, { role: 'ai', text: out.reply || 'Done.' }]);
      save();
    } catch (e) {
      setChat((c) => [...c, { role: 'ai', text: 'Sorry — ' + (e.message || 'that failed.') }]);
    } finally { setChatBusy(false); }
  };

  const commitName = async () => {
    const nm = name.trim() || 'Untitled style guide';
    setName(nm);
    if (guide && nm !== guide.name) { await renameStyleGuide(id, nm); setGuide({ ...guide, name: nm }); }
  };

  const doExport = async () => {
    await save();
    if (hasBackend()) { try { await downloadStyleGuide(id); return; } catch (e) {} }
    const api = sg(); if (!api) return;
    const blob = new Blob([api.serialize()], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (name || 'style-guide') + '.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  };

  if (notFound) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#FBFCFE] text-gray-500 gap-3">
        <BrandStar size={40} />
        <div className="text-sm">This style guide doesn’t exist or was removed.</div>
        <button onClick={onBack} className="text-sm text-[#473AE0] font-medium">Back to style guides</button>
      </div>
    );
  }

  const statusEl = status === 'saving'
    ? <span className="flex items-center gap-1.5 text-gray-400"><Loader2 size={13} className="animate-spin" /> Saving…</span>
    : status === 'unsaved'
      ? <span className="text-amber-500">Unsaved changes</span>
      : <span className="flex items-center gap-1.5 text-green-500"><Check size={13} /> Saved</span>;

  return (
    <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 flex flex-col bg-[#FBFCFE]`}>
      {/* single top bar: name + status (left) · section pills (center) · actions (right) */}
      <div className="h-14 shrink-0 bg-white border-b border-gray-100 flex items-center px-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button onClick={onBack} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center shrink-0" title="Back"><ArrowLeft size={17} /></button>
          <button onClick={onBack} className="w-9 h-9 rounded-lg hover:bg-gray-50 flex items-center justify-center shrink-0" title="Qoders"><BrandStar size={22} /></button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            disabled={readOnly}
            className="font-semibold text-gray-800 text-sm bg-transparent outline-none border-b border-transparent focus:border-indigo-300 px-1 min-w-0 max-w-[200px] truncate"
          />
          <div className="text-xs shrink-0">{readOnly ? <span className="text-gray-400">View only</span> : statusEl}</div>

          {hasBackend() && currentVid && (
            <div className="relative shrink-0">
              <button onClick={() => setVersionMenu((v) => !v)}
                      className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full px-2.5 py-1" title="Versions">
                <History size={13} /> {versions.find((v) => v.id === currentVid)?.label || 'v1'} <ChevronDown size={12} className="text-gray-400" />
              </button>
              {versionMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setVersionMenu(false)} />
                  <div className="absolute left-0 top-8 z-40 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5">
                    <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Versions</div>
                    {versions.map((v) => (
                      <div key={v.id} className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${v.id === currentVid ? 'bg-indigo-50 text-[#473AE0]' : 'hover:bg-gray-50 text-gray-700'}`}>
                        <button className="flex-1 text-left flex items-center gap-1.5" onClick={() => loadVersion(v.id)}>
                          {v.id === currentVid && <Check size={13} />}{v.label}
                        </button>
                        {!readOnly && versions.length > 1 && (
                          <button onClick={() => removeVersion(v.id)} className="text-gray-300 hover:text-red-500" title="Delete version"><Trash2 size={13} /></button>
                        )}
                      </div>
                    ))}
                    {!readOnly && (
                      <>
                        <div className="h-px bg-gray-100 my-1" />
                        <button onClick={newVersion} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-[#473AE0] hover:bg-indigo-50"><Plus size={14} /> New version</button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        <div className="flex-1 flex items-center justify-end gap-2">
          {!readOnly && (
            <button onClick={() => setAiOpen((v) => !v)}
                    className={`flex items-center gap-1.5 text-sm font-medium rounded-full px-4 py-1.5 text-white ${aiOpen ? 'ring-2 ring-violet-300' : ''}`}
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#d946ef)' }}><Sparkles size={15} /> AI</button>
          )}
          {!readOnly && (
            <button onClick={() => save()} disabled={status === 'saving'}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full px-4 py-1.5 disabled:opacity-50"><Save size={15} /> Save</button>
          )}
          {hasBackend() && guide && !guide.shared && (
            <button onClick={() => setShareOpen(true)}
                    className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#473AE0] hover:bg-[#3a2fc0] rounded-full px-4 py-1.5"><Share2 size={15} /> Share</button>
          )}
          <button onClick={doExport}
                  className="flex items-center gap-1.5 text-sm font-medium text-[#473AE0] bg-indigo-50 hover:bg-indigo-100 rounded-full px-4 py-1.5"><Download size={15} /> Export</button>

          {/* account menu */}
          <div className="relative ml-1">
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

      {/* section nav — own row, horizontally scrollable (slider) */}
      <div className="shrink-0 bg-white border-b border-gray-100 flex items-center gap-1 px-3 py-2">
        <button onClick={() => pillsRef.current && pillsRef.current.scrollBy({ left: -260, behavior: 'smooth' })}
                className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center shrink-0" title="Scroll left"><ChevronLeft size={16} /></button>
        <div ref={pillsRef} className="flex-1 overflow-x-auto no-scrollbar">
          <div className="inline-flex items-center gap-0.5 bg-gray-100 rounded-full p-1">
            {SECTIONS.map((s) => (
              <button key={s.id}
                      onClick={() => { const api = sg(); if (api) api.scrollTo(s.id); setActiveSection(s.id); }}
                      className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-[13px] font-medium transition whitespace-nowrap
                        ${activeSection === s.id ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                <span className={activeSection === s.id ? 'text-[#473AE0] font-semibold' : 'text-gray-400'}>{s.n}</span> {s.label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => pillsRef.current && pillsRef.current.scrollBy({ left: 260, behavior: 'smooth' })}
                className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center shrink-0" title="Scroll right"><ChevronRight size={16} /></button>
        {!readOnly && (
          <div className="inline-flex items-center bg-gray-100 rounded-full p-0.5 shrink-0 ml-2" title="Properties: edit design tokens (they propagate everywhere). Everything: edit any element freely.">
            {[['properties', 'Properties'], ['everything', 'Everything']].map(([m, label]) => (
              <button key={m} onClick={() => setEditMode(m)}
                      className={`px-3 h-7 rounded-full text-xs font-medium transition ${editMode === m ? 'bg-white shadow-sm text-[#473AE0]' : 'text-gray-500 hover:text-gray-700'}`}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* body: full-width canvas (all editing happens inline on the page) */}
      <div className="flex-1 relative min-h-0 bg-gray-100">
        {doc == null ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <iframe
            ref={iframeRef}
            title="Style guide"
            srcDoc={doc}
            className="absolute inset-0 w-full h-full border-0 bg-white"
            sandbox="allow-same-origin allow-scripts"
          />
        )}

        {aiOpen && !readOnly && (
          <div className="absolute top-0 right-0 bottom-0 w-80 bg-white border-l border-gray-100 shadow-xl z-40 flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
              <span className="flex items-center gap-2 font-semibold text-gray-800">
                <span className="w-7 h-7 rounded-lg text-white flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7c3aed,#d946ef)' }}><Sparkles size={15} /></span>
                Style Assistant
              </span>
              <button onClick={() => setAiOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chat.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-[#473AE0] text-white rounded-br-sm' : 'bg-gray-100 text-gray-700 rounded-bl-sm'}`}>{m.text}</div>
                </div>
              ))}
              {chatBusy && (
                <div className="flex justify-start"><div className="bg-gray-100 text-gray-500 rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Working…</div></div>
              )}
            </div>
            <div className="border-t border-gray-100 p-3">
              <div className="flex items-center gap-2 rounded-2xl border border-gray-200 px-3 py-2 focus-within:ring-1 focus-within:ring-violet-300">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                       onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendAssistant(); } }}
                       placeholder="Ask to edit the style guide…" disabled={chatBusy}
                       className="flex-1 outline-none text-sm text-gray-700 placeholder-gray-400 disabled:opacity-60" />
                <button onClick={sendAssistant} disabled={chatBusy || !chatInput.trim()} className="w-8 h-8 rounded-full bg-[#473AE0] text-white flex items-center justify-center disabled:opacity-40"><Send size={14} /></button>
              </div>
              <div className="text-[11px] text-gray-400 mt-1.5">Changes colours, fonts &amp; spacing — or paste a site URL to match it.</div>
            </div>
          </div>
        )}
      </div>

      {shareOpen && (() => {
        const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/#/styleguides/view/${id}`;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={() => setShareOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-[92vw] p-6" onMouseDown={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-bold text-gray-800">Share</span>
                <button onClick={() => setShareOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 flex items-center justify-center"><X size={16} /></button>
              </div>

              <div className="flex items-center gap-6 border-b border-gray-100 mb-4">
                <button onClick={() => setShareTab('link')} className={`pb-2 text-sm font-medium ${shareTab === 'link' ? 'text-[#473AE0] border-b-2 border-[#473AE0]' : 'text-gray-400'}`}>Share link</button>
                {hasBackend() && (
                  <button onClick={() => setShareTab('invite')} className={`pb-2 text-sm font-medium flex items-center gap-1 ${shareTab === 'invite' ? 'text-[#473AE0] border-b-2 border-[#473AE0]' : 'text-gray-400'}`}>
                    <Users size={14} /> Invite people
                  </button>
                )}
              </div>

              {shareTab === 'link' ? (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Share link</div>
                  <div className="flex items-center gap-2">
                    <input readOnly value={shareUrl} onFocus={(e) => e.target.select()}
                           className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 outline-none" />
                    <button onClick={() => { navigator.clipboard?.writeText(shareUrl); setToast('Link copied'); setTimeout(() => setToast(''), 1500); }}
                            className="w-11 h-11 rounded-xl bg-[#473AE0] text-white flex items-center justify-center hover:bg-indigo-600 shrink-0" title="Copy link">
                      <Copy size={18} />
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">Anyone with the link can view</div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-3">Invite people by email — they get access as soon as they sign up.</p>
                  <InvitePanel projectId={id} api={SG_MEMBER_API} />
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg">{toast}</div>
      )}

      {acctModalOpen && <Account user={user || {}} onClose={() => setAcctModalOpen(false)} onUpdated={(u) => onUserChange && onUserChange(u)} onLogout={onLogout} />}
      {teamOpen && <Team user={user} onClose={() => setTeamOpen(false)} />}
      {connectAiOpen && <ConnectAI onClose={() => setConnectAiOpen(false)} />}
    </div>
  );
}
