import React, { useState } from 'react';
import { X, ArrowLeft, Trash2, Globe } from 'lucide-react';
import { initials, updateProfile, changePassword, deleteAccount } from '../auth';

const COUNTRIES = ['United States', 'United Kingdom', 'Romania', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Canada', 'Australia', 'Other'];

export default function Account({ user, onClose, onUpdated, onLogout }) {
  const [view, setView] = useState('profile'); // profile | password | delete
  const p = user.profile || {};
  const [first, setFirst] = useState((user.name || '').split(' ')[0] || '');
  const [surname, setSurname] = useState((user.name || '').split(' ').slice(1).join(' '));
  const [email, setEmail] = useState(user.email || '');
  const [emailNotif, setEmailNotif] = useState(p.emailNotifications !== false);
  const [company, setCompany] = useState(p.company || '');
  const [country, setCountry] = useState(p.country || 'United States');
  const [timeFormat, setTimeFormat] = useState(p.timeFormat || '24h');
  const [dateFormat, setDateFormat] = useState(p.dateFormat || 'DD-MM-YYYY');
  const [acToken, setAcToken] = useState(p.acToken || '');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const name = [first.trim(), surname.trim()].filter(Boolean).join(' ') || (email.split('@')[0]);
      const updated = await updateProfile({ name, email: email.trim(), profile: { emailNotifications: emailNotif, company, country, timeFormat, dateFormat, acToken: acToken.trim() } });
      onUpdated && onUpdated(updated);
      setMsg('Saved.');
    } catch (e) { setErr(e.message || 'Could not save'); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 overflow-auto py-10" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[760px] max-w-[94vw] p-8" onMouseDown={(e) => e.stopPropagation()}>

        {view === 'profile' && (
          <>
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Profile settings</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
            </div>

            <div className="flex gap-10">
              <div className="flex-1 min-w-0 max-w-lg">
                <span className="w-14 h-14 rounded-full bg-[#473AE0] text-white flex items-center justify-center font-bold text-lg mb-5">{initials([first, surname].join(' '))}</span>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="First name"><input value={first} onChange={(e) => setFirst(e.target.value)} className={inputCls} /></Field>
                  <Field label="Surname"><input value={surname} onChange={(e) => setSurname(e.target.value)} className={inputCls} /></Field>
                </div>
                <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
                <label className="flex items-center gap-2 text-sm text-gray-600 mt-1 mb-4 cursor-pointer">
                  <input type="checkbox" checked={emailNotif} onChange={(e) => setEmailNotif(e.target.checked)} className="accent-[#10B981] w-4 h-4" />
                  Receive email notifications
                </label>
                <Field label="Company"><input value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} /></Field>
                <Field label="Country">
                  <div className="relative">
                    <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls + ' pl-9 appearance-none'}>
                      {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Time format">
                    <select value={timeFormat} onChange={(e) => setTimeFormat(e.target.value)} className={inputCls + ' appearance-none'}>
                      <option value="24h">24h</option><option value="12h">12h</option>
                    </select>
                  </Field>
                  <Field label="Date format">
                    <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className={inputCls + ' appearance-none'}>
                      <option>DD-MM-YYYY</option><option>MM-DD-YYYY</option><option>YYYY-MM-DD</option>
                    </select>
                  </Field>
                </div>

                {user.teamRole !== 'client' && (
                  <>
                    <div className="h-px bg-gray-100 my-5" />
                    <Field label="Active Collab API token">
                      <input type="password" value={acToken} onChange={(e) => setAcToken(e.target.value)} placeholder="Paste your Active Collab API token" autoComplete="off" className={inputCls} />
                    </Field>
                    <p className="text-xs text-gray-400 -mt-2 mb-1">Used to sync sitemaps &amp; markup with Active Collab. Get it from Active Collab → Profile → API Subscriptions.</p>
                  </>
                )}

                {err && <div className="text-sm text-red-500 mt-3">{err}</div>}
                {msg && <div className="text-sm text-green-600 mt-3">{msg}</div>}

                <button onClick={save} disabled={busy} className="mt-5 bg-[#473AE0] text-white font-medium rounded-full px-7 py-2.5 hover:bg-[#3a2fc0] disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>

                <div className="h-px bg-gray-100 my-6" />
                <button onClick={() => { setView('password'); setErr(''); setMsg(''); }} className="bg-gray-100 text-gray-700 font-medium rounded-full px-6 py-2.5 hover:bg-gray-200">Change password</button>

                <button onClick={() => { setView('delete'); setErr(''); }} className="mt-6 flex items-center gap-2 text-red-500 font-semibold hover:underline"><Trash2 size={16} /> Delete my account</button>
                <p className="text-xs text-gray-400 mt-1">You will be prompted to confirm your account deletion.</p>
              </div>
            </div>
          </>
        )}

        {view === 'password' && (
          <ChangePassword onBack={() => setView('profile')} onClose={onClose} />
        )}

        {view === 'delete' && (
          <DeleteAccount onBack={() => setView('profile')} onDeleted={() => { onClose(); onLogout && onLogout(); }} />
        )}
      </div>
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 bg-white';
function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ChangePassword({ onBack, onClose }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(''); setMsg('');
    try { await changePassword(cur, next); setMsg('Password updated.'); setCur(''); setNext(''); }
    catch (e2) { setErr(e2.message || 'Could not change password'); }
    setBusy(false);
  };
  return (
    <div className="max-w-md">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200"><ArrowLeft size={16} /></button>
          <h2 className="text-2xl font-bold text-gray-800">Change password</h2>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
      </div>
      <form onSubmit={save}>
        <Field label="Current password"><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} className={inputCls} /></Field>
        <Field label="New Password"><input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} /></Field>
        {err && <div className="text-sm text-red-500 mb-2">{err}</div>}
        {msg && <div className="text-sm text-green-600 mb-2">{msg}</div>}
        <button type="submit" disabled={busy} className="mt-2 bg-[#473AE0] text-white font-medium rounded-full px-7 py-2.5 hover:bg-[#3a2fc0] disabled:opacity-60">{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </div>
  );
}

function DeleteAccount({ onBack, onDeleted }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    await deleteAccount();
    onDeleted();
  };
  return (
    <div className="max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200"><ArrowLeft size={16} /></button>
        <h2 className="text-2xl font-bold text-gray-800">Delete my account</h2>
      </div>
      <p className="text-gray-500 leading-relaxed">Once your account is deleted, all of your projects and data are permanently removed from our servers.</p>
      <p className="text-gray-500 mt-3">Confirm by typing <span className="font-bold text-gray-700">DELETE</span> below.</p>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type here"
             className="w-full bg-gray-100 rounded-xl px-4 py-3 mt-4 outline-none text-sm" />
      <div className="flex gap-3 mt-6">
        <button onClick={confirm} disabled={text !== 'DELETE' || busy}
                className="rounded-full px-8 py-2.5 font-medium text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400">{busy ? 'Deleting…' : 'Yes'}</button>
        <button onClick={onBack} className="rounded-full px-8 py-2.5 font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">Cancel</button>
      </div>
    </div>
  );
}
