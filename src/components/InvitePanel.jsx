import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, Clock } from 'lucide-react';
import { apiListMembers, apiAddMember, apiRemoveMember, apiRemoveInvite } from '../api';
import { initials } from '../auth';

/* Invite people to a project by email (works even if they don't have an account yet).
   `api` lets a different product (e.g. Markup) plug in its own member endpoints;
   defaults to the Sitemap project API. */
export default function InvitePanel({ projectId, api }) {
  const A = api || { listMembers: apiListMembers, addMember: apiAddMember, removeMember: apiRemoveMember, removeInvite: apiRemoveInvite };
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => A.listMembers(projectId).then(setMembers).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [projectId]);

  const invite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setErr('');
    try {
      await A.addMember(projectId, email.trim(), role);
      setEmail('');
      load();
    } catch (e2) { setErr(e2.message || 'Could not share'); }
    setBusy(false);
  };
  const remove = async (m) => {
    if (m.pending) await A.removeInvite(projectId, m.email);
    else await A.removeMember(projectId, m.userId);
    load();
  };

  return (
    <div>
      <form onSubmit={invite} className="flex gap-2">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com"
               className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="border border-gray-200 rounded-xl px-2 text-sm text-gray-600 outline-none">
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <button type="submit" disabled={busy} className="bg-[#473AE0] text-white rounded-xl px-3 hover:bg-[#3a2fc0] disabled:opacity-60 flex items-center"><UserPlus size={16} /></button>
      </form>
      {err && <div className="text-sm text-red-500 mt-2">{err}</div>}

      <div className="mt-4 space-y-2 max-h-64 overflow-auto">
        {members.map((m) => (
          <div key={m.userId || m.email} className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-indigo-100 text-[#473AE0] flex items-center justify-center text-xs font-bold">
              {m.pending ? <Clock size={14} /> : initials(m.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-800 truncate">{m.pending ? m.email : m.name}</div>
              <div className="text-xs text-gray-400 truncate">{m.pending ? 'Pending — invited, not signed up yet' : m.email}</div>
            </div>
            {m.role === 'owner'
              ? <span className="text-xs text-gray-400">Owner</span>
              : <>
                  <span className="text-xs text-gray-500 capitalize">{m.role}</span>
                  <button onClick={() => remove(m)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </>}
          </div>
        ))}
      </div>
    </div>
  );
}
