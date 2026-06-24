import React, { useState } from 'react';
import { Star, ArrowRight, Mail, Lock } from 'lucide-react';
import BrandStar from './components/Brand';
import { loginUser, registerUser, forgotPassword } from './auth';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // login | signup | forgot
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (mode === 'forgot') {
      if (!email.trim()) { setErr('Enter your email.'); return; }
      setBusy(true); setErr('');
      try { await forgotPassword(email.trim()); setSent(true); } catch (e2) { setErr(e2.message || 'Something went wrong.'); }
      setBusy(false);
      return;
    }
    if (!email.trim() || !pw) { setErr('Enter your email and password.'); return; }
    setBusy(true); setErr('');
    try {
      const user = mode === 'signup'
        ? await registerUser(name, email.trim(), pw)
        : await loginUser(email.trim(), pw);
      onLogin(user);
    } catch (e2) {
      setErr(e2.message || 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 flex bg-white"
         style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* left: form */}
      <div className="flex-1 flex flex-col px-10 sm:px-16">
        <div className="flex items-center gap-2 pt-8">
          <BrandStar size={24} />
          <span className="font-bold text-gray-900 text-lg">Qoders</span>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-sm w-full">
          <h1 className="text-3xl font-extrabold text-gray-900">{mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}</h1>
          <p className="text-gray-500 mt-1 mb-7">{mode === 'login' ? 'Sign in to your sitemaps' : mode === 'signup' ? 'Start mapping your sites' : 'We’ll email you a reset link'}</p>

          {mode === 'forgot' && sent ? (
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-gray-700">
              If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way. Check your inbox (and spam).
              <button onClick={() => { setMode('login'); setSent(false); setErr(''); }} className="block mt-3 text-[#473AE0] font-medium hover:underline">Back to sign in</button>
            </div>
          ) : (
          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                     className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" />
            )}
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3 focus-within:ring-2 focus-within:ring-indigo-200 focus-within:border-indigo-300">
              <Mail size={16} className="text-gray-400" />
              <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
                     className="flex-1 outline-none text-sm bg-transparent" />
            </div>
            {mode !== 'forgot' && (
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3 focus-within:ring-2 focus-within:ring-indigo-200 focus-within:border-indigo-300">
                <Lock size={16} className="text-gray-400" />
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password"
                       className="flex-1 outline-none text-sm bg-transparent" />
              </div>
            )}
            {mode === 'login' && (
              <div className="text-right">
                <button type="button" onClick={() => { setMode('forgot'); setErr(''); setSent(false); }} className="text-xs text-gray-500 hover:text-[#473AE0]">Forgot password?</button>
              </div>
            )}

            {err && <div className="text-sm text-red-500">{err}</div>}

            <button type="submit" disabled={busy}
                    className="w-full flex items-center justify-center gap-2 bg-[#473AE0] text-white font-medium rounded-xl py-3 hover:bg-[#3a2fc0] disabled:opacity-60">
              {busy ? 'Please wait…' : (mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link')} <ArrowRight size={16} />
            </button>
          </form>
          )}

          <div className="text-sm text-gray-500 mt-5">
            {mode === 'forgot' ? (
              <button onClick={() => { setMode('login'); setErr(''); setSent(false); }} className="text-[#473AE0] font-medium hover:underline">Back to sign in</button>
            ) : (
              <>
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErr(''); }} className="text-[#473AE0] font-medium hover:underline">
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="pb-8" />
      </div>

      {/* right: brand panel (our colors) */}
      <div className="hidden lg:flex w-[46%] items-center justify-center p-14"
           style={{ background: 'linear-gradient(135deg, #473AE0, #6D5BF0 55%, #8B5CF6)' }}>
        <div className="max-w-md text-white">
          <div className="flex gap-1 mb-5 text-yellow-300">
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={20} fill="currentColor" stroke="none" />)}
          </div>
          <p className="text-lg font-medium leading-relaxed">
            Plan complete sitemaps — pages, sections and wireframes — in minutes. Qoders keeps our whole team aligned before a single line of design.
          </p>
          <div className="flex items-center gap-3 mt-7">
            <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center font-bold">MP</span>
            <div>
              <div className="font-semibold">Maria Pop</div>
              <div className="text-white/70 text-sm">Product Designer</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
