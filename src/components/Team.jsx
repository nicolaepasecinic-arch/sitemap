import React, { useState, useEffect } from 'react';
import { X, Users, Trash2, Crown, ChevronDown, LogOut, Plus } from 'lucide-react';
import { initials } from '../auth';
import { apiGetTeam, apiCreateTeam, apiLeaveTeam, apiAddTeamMember, apiUpdateTeamMember, apiRemoveTeamMember, apiRemoveTeamInvite } from '../api';

const ROLES = [
  { key: 'pm', label: 'PM' },
  { key: 'production', label: 'Production' },
  { key: 'client', label: 'Client' },
];
const roleLabel = (r) => (ROLES.find((x) => x.key === r)?.label || r);

export default function Team({ onClose, user }) {
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('production');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const isPm = team?.role === 'pm';
  const isOwner = team && user && team.ownerId === user.id;

  const load = () => { apiGetTeam().then((d) => { setTeam(d.team); setMembers(d.members || []); setLoading(false); }).catch((e) => { setErr(e.message || 'Could not load team'); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const invite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setErr('');
    try { await apiAddTeamMember(email.trim(), role); setEmail(''); load(); }
    catch (e2) { setErr(e2.message || 'Could not add member'); }
    setBusy(false);
  };
  const createTeam = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { const d = await apiCreateTeam(newName.trim()); setTeam(d.team); load(); } catch (e2) { setErr(e2.message || 'Could not create team'); }
    setBusy(false);
  };
  const leaveTeam = async () => {
    setBusy(true); setErr('');
    try { await apiLeaveTeam(); setTeam(null); setMembers([]); } catch (e2) { setErr(e2.message || 'Could not leave'); }
    setBusy(false);
  };
  const changeRole = async (m, r) => { try { await apiUpdateTeamMember(m.userId, r); load(); } catch (e) { setErr(e.message); } };
  const remove = async (m) => {
    try { if (m.pending) await apiRemoveTeamInvite(m.email); else await apiRemoveTeamMember(m.userId); load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/30 overflow-auto py-10 p-6" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#473AE0]" />
            <h2 className="text-lg font-bold text-gray-800">{team?.name || 'Team'}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : !team ? (
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">You’re not in a team yet. Create one to invite people and share your projects.</p>
            <form onSubmit={createTeam} className="flex items-center gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Team name"
                     className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-300" />
              <button type="submit" disabled={busy} className="flex items-center gap-1.5 bg-[#473AE0] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#3a2fc0] disabled:opacity-50"><Plus size={15} /> Create team</button>
            </form>
            {err && <div className="text-xs text-red-500 mt-3">{err}</div>}
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4 text-sm">
              <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-[#473AE0] rounded-full px-3 py-1 font-medium">
                {isOwner ? <><Crown size={13} className="text-amber-400" /> Owner · PM</> : <>You’re {roleLabel(team.role)}</>}
              </span>
              <span className="text-gray-400 text-xs">{members.filter((m) => !m.pending).length} member{members.filter((m) => !m.pending).length === 1 ? '' : 's'}</span>
            </div>
            {isPm && (
              <form onSubmit={invite} className="flex items-center gap-2 mb-5">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Invite by email"
                       className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-300" />
                <div className="relative">
                  <select value={role} onChange={(e) => setRole(e.target.value)} className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-300">
                    {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <button type="submit" disabled={busy || !email.trim()} className="bg-[#473AE0] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#3a2fc0] disabled:opacity-50">Invite</button>
              </form>
            )}
            {err && <div className="text-xs text-red-500 mb-3">{err}</div>}

            <div className="space-y-1.5">
              {members.map((m) => {
                const isOwner = m.userId && team && m.userId === team.ownerId;
                return (
                  <div key={m.userId || m.email} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50">
                    <span className="w-9 h-9 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-bold shrink-0">{m.pending ? '@' : (initials(m.name) || '?')}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate flex items-center gap-1.5">{m.pending ? m.email : m.name}{isOwner && <Crown size={13} className="text-amber-400" />}</div>
                      {!m.pending && <div className="text-[11px] text-gray-400 truncate">{m.email}</div>}
                      {m.pending && <div className="text-[11px] text-amber-500">Pending invite</div>}
                    </div>
                    {isPm && !isOwner ? (
                      <div className="relative shrink-0">
                        <select value={m.role} onChange={(e) => changeRole(m, e.target.value)} disabled={m.pending}
                                className="appearance-none border border-gray-200 rounded-lg pl-2.5 pr-7 py-1 text-xs outline-none disabled:opacity-60">
                          {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 shrink-0">{isOwner ? 'PM (owner)' : roleLabel(m.role)}</span>
                    )}
                    {isPm && !isOwner && (
                      <button onClick={() => remove(m)} className="shrink-0 text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
                    )}
                  </div>
                );
              })}
            </div>

            {!isPm && <p className="mt-4 text-[11px] text-gray-400">Only the team PM can invite or change members.</p>}
            {!isOwner && (
              <button onClick={leaveTeam} disabled={busy} className="mt-5 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500"><LogOut size={13} /> Leave this team</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
