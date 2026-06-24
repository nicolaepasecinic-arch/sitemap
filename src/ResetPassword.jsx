import React, { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import BrandStar from './components/Brand';
import { resetPassword } from './auth';

export default function ResetPassword({ token, onDone }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    if (pw !== pw2) { setErr('Passwords don’t match.'); return; }
    setBusy(true); setErr('');
    try { const user = await resetPassword(token, pw); onDone(user); }
    catch (e2) { setErr(e2.message || 'Could not reset password.'); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#FBFCFE] p-6" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6"><BrandStar size={24} /><span className="font-bold text-gray-900 text-lg">Qoders</span></div>
        <h1 className="text-2xl font-extrabold text-gray-900">Choose a new password</h1>
        <p className="text-gray-500 mt-1 mb-6 text-sm">Enter a new password for your account.</p>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3 focus-within:ring-2 focus-within:ring-indigo-200 bg-white">
            <Lock size={16} className="text-gray-400" />
            <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="flex-1 outline-none text-sm bg-transparent" />
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3 focus-within:ring-2 focus-within:ring-indigo-200 bg-white">
            <Lock size={16} className="text-gray-400" />
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirm password" className="flex-1 outline-none text-sm bg-transparent" />
          </div>
          {err && <div className="text-sm text-red-500">{err}</div>}
          <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 bg-[#473AE0] text-white font-medium rounded-xl py-3 hover:bg-[#3a2fc0] disabled:opacity-60">
            {busy ? 'Please wait…' : 'Reset password'} <ArrowRight size={16} />
          </button>
        </form>
        <button onClick={() => { window.location.hash = '#/'; }} className="mt-5 text-sm text-[#473AE0] hover:underline">Back to sign in</button>
      </div>
    </div>
  );
}
