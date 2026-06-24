import React, { useState } from 'react';
import { Check, X, Link2, Loader2, Pencil, FolderOpen } from 'lucide-react';

// Active Collab glyph — a bold "A" with a small link badge. Reused wherever the
// "Assign AC Project" action appears so it reads consistently.
export function AcIcon({ size = 15 }) {
  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size + 7, height: size }}>
      <span className="font-extrabold leading-none" style={{ fontSize: size }}>A</span>
      <Link2 size={Math.round(size * 0.6)} strokeWidth={2.5} className="absolute right-0 -bottom-1" />
    </span>
  );
}

/**
 * Link a PurpleBear project to an Active Collab project by ID. Shared by Sitemap + Markup.
 *
 * States:
 *  - LINKED + not editing → shows the AC project name + an Edit (pencil) button.
 *  - editing / not linked → ID input + Check (verifies via the backend AC API).
 *
 * Props:
 *  - acProjectId, acProjectName: currently linked project (from the backend).
 *  - onSave(acProjectId): async — verify an existing AC project + persist. '' clears it.
 *  - onLinked(updated): optional callback with the updated project after a save.
 */
export default function ActiveCollabField({ acProjectId = '', acProjectName = '', onSave, onLinked }) {
  const [linkedId, setLinkedId] = useState(acProjectId || '');
  const [name, setName] = useState(acProjectName || '');
  const linked = !!linkedId && !!name;

  const [editing, setEditing] = useState(!linked);
  const [idValue, setIdValue] = useState(acProjectId || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const apply = (updated) => {
    setLinkedId(updated?.acProjectId || '');
    setName(updated?.acProjectName || '');
    setIdValue(updated?.acProjectId || '');
    setEditing(!(updated?.acProjectId && updated?.acProjectName));
    onLinked && onLinked(updated);
  };

  const run = async (fn) => {
    setErr(''); setBusy(true);
    try { apply(await fn()); } catch (e) { setErr(e.message || 'Something went wrong.'); }
    setBusy(false);
  };

  const startEdit = () => { setIdValue(linkedId || ''); setErr(''); setEditing(true); };

  // ---- LINKED (display) ----
  if (linked && !editing) {
    return (
      <div>
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2"><Link2 size={15} className="text-gray-400" /> Active Collab project</div>
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
          <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center shrink-0"><FolderOpen size={16} /></span>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-800 truncate">{name}</div>
            <div className="text-[11px] text-gray-500">Active Collab ID: {linkedId}</div>
          </div>
          <button onClick={startEdit} title="Edit link" className="shrink-0 w-8 h-8 rounded-lg text-gray-500 hover:bg-white hover:text-[#473AE0] flex items-center justify-center"><Pencil size={15} /></button>
        </div>
      </div>
    );
  }

  // ---- EDIT / EMPTY ----
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700"><Link2 size={15} className="text-gray-400" /> Active Collab project</div>
        {linked && <button onClick={() => { setEditing(false); setErr(''); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={idValue}
          onChange={(e) => setIdValue(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter' && idValue.trim()) run(() => onSave(idValue.trim())); }}
          placeholder="Project ID (e.g. 142)"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-300"
        />
        <button onClick={() => run(() => onSave(idValue.trim()))} disabled={busy || !idValue.trim()}
                className="shrink-0 bg-[#473AE0] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#3a2fc0] disabled:opacity-40 flex items-center gap-1.5">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Check
        </button>
      </div>

      {err && <div className="mt-2 text-xs text-red-500">{err}</div>}
      <p className="mt-2 text-[11px] text-gray-400">Enter the project ID from Active Collab — we verify it and save the name.</p>

      {linked && (
        <button onClick={() => run(() => onSave(''))} disabled={busy} className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500">
          <X size={13} /> Unlink current project ({name})
        </button>
      )}
    </div>
  );
}
