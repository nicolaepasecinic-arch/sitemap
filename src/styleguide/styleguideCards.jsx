/* ------------------------------------------------------------------ */
/*  Style Guides dashboard presentational pieces: card preview, menu,   */
/*  and the New / Generate / Share modals. Split out of the dashboard.  */
/* ------------------------------------------------------------------ */
import React, { useState, useRef, useEffect } from 'react';
import { Copy, Trash2, Pencil, X, LogOut, CheckCircle2, Circle, Share2, Archive, ArchiveRestore, Sparkles, Loader2 } from 'lucide-react';
import InvitePanel from '../components/InvitePanel';
import { apiListStyleGuideMembers, apiAddStyleGuideMember, apiRemoveStyleGuideMember, apiRemoveStyleGuideInvite } from './styleguideApi';

export const SG_MEMBER_API = {
  listMembers: apiListStyleGuideMembers,
  addMember: apiAddStyleGuideMember,
  removeMember: apiRemoveStyleGuideMember,
  removeInvite: apiRemoveStyleGuideInvite,
};

export function relTime(ts) {
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

/* Live preview of a style guide — its real palette + typography (from the doc's content). */
export function Thumb({ preview }) {
  const colors = (preview && preview.colors && preview.colors.length) ? preview.colors : ['#473AE0', '#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#111827'];
  const font = (preview && preview.font) || '';
  const accent = colors[0] || '#473AE0';
  return (
    <div className="rounded-xl bg-white border border-gray-100 w-full max-w-[190px] mx-auto overflow-hidden shadow-sm">
      <div className="px-3 pt-3 pb-2" style={font ? { fontFamily: font } : undefined}>
        <div className="text-[24px] leading-none font-bold" style={{ color: accent }}>Aa</div>
        <div className="text-[10px] text-gray-400 mt-1 truncate">{font || 'Typography'}</div>
      </div>
      <div className="flex h-7">
        {colors.slice(0, 6).map((c, i) => (<div key={i} className="flex-1" style={{ background: c }} title={c} />))}
      </div>
    </div>
  );
}

export function CardMenu({ onRename, onDuplicate, onShare, canShare, onComplete, completed, onArchive, archived, onDelete, shared, onClose }) {
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
        {shared ? <><LogOut size={15} /> Leave</> : <><Trash2 size={15} /> Delete</>}
      </button>
    </div>
  );
}

/* New-style-guide popup: Name only. */
export function NewStyleGuideModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try { await onCreate(name.trim() || 'Untitled style guide'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={busy ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">New style guide</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1.5">Style guide name</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
               placeholder="e.g. Acme brand design system"
               className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-300 mb-2" />

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} disabled={busy} className="px-5 py-2.5 rounded-full text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">Cancel</button>
          <button onClick={create} disabled={busy} className="px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-[#473AE0] hover:bg-[#3a2fc0] disabled:opacity-50">Create</button>
        </div>
      </div>
    </div>
  );
}

/* Generate a style guide from one or more websites (a version per site + a Mix), with an
   optional separate "content" site that supplies the brand name / text. */
export function StyleGuideGenerateModal({ onClose, onGenerate }) {
  const [sites, setSites] = useState('');
  const [contentUrl, setContentUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const urls = sites.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

  const run = async () => {
    if (busy || !urls.length) return;
    setBusy(true); setError('');
    try { await onGenerate({ urls, contentUrl: contentUrl.trim(), instructions: instructions.trim() }); }
    catch (e) { setError(e.message || 'Generation failed.'); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={busy ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Sparkles size={18} className="text-[#473AE0]" /> Generate with AI</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">We capture each site’s screenshot &amp; brand, then build a matching style guide.</p>

        <label className="block text-sm font-medium text-gray-700 mb-1.5">Style website(s) <span className="text-gray-400 font-normal">— one per line</span></label>
        <textarea autoFocus value={sites} onChange={(e) => setSites(e.target.value)} rows={3}
                  placeholder={'stripe.com\nlinear.app'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-300 resize-y mb-1" />
        <div className="text-[11px] text-gray-400 mb-4">{urls.length > 1 ? `A version for each site + a blended “Mix” version.` : 'One site → one version.'}</div>

        <label className="block text-sm font-medium text-gray-700 mb-1.5">Content / text from <span className="text-gray-400 font-normal">(optional — different site)</span></label>
        <input value={contentUrl} onChange={(e) => setContentUrl(e.target.value)}
               placeholder="e.g. upqode.com (brand name & text)"
               className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-300 mb-4" />

        <label className="block text-sm font-medium text-gray-700 mb-1.5">Instructions <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2}
                  placeholder="e.g. make it darker, use the blue as the primary color"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-300 resize-y" />

        {error && <div className="text-xs text-red-500 mt-3">{error}</div>}

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} disabled={busy} className="px-5 py-2.5 rounded-full text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">Cancel</button>
          <button onClick={run} disabled={busy || !urls.length} className="px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-[#473AE0] hover:bg-[#3a2fc0] disabled:opacity-50 flex items-center gap-2">
            {busy ? <><Loader2 size={15} className="animate-spin" /> Generating…</> : <>Generate</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Share a style guide with other Qoders accounts (by email). Owner-only. */
export function ShareModal({ guide, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-bold text-gray-800">Share “{guide.name}”</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Invite people by email — they get access as soon as they sign up.</p>
        <InvitePanel projectId={guide.id} api={SG_MEMBER_API} />
      </div>
    </div>
  );
}

