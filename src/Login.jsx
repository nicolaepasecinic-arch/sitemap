import React, { useState } from 'react';
import { Star, ArrowRight } from 'lucide-react';
import BrandStar from './Brand';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    onLogin({ name: email.split('@')[0] || 'User', email: email.trim() });
  };
  const google = () => onLogin({ name: 'Qoders User', email: 'user@qoders.app' });

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
          <h1 className="text-3xl font-extrabold text-gray-900">Welcome to Qoders</h1>
          <p className="text-gray-500 mt-1 mb-7">Enter your email to continue</p>

          <form onSubmit={submit}>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
            <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email…"
                   className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" />
            <button type="submit"
                    className="w-full mt-4 flex items-center justify-center gap-2 bg-[#473AE0] text-white font-medium rounded-xl py-3 hover:bg-[#3a2fc0]">
              Continue <ArrowRight size={16} />
            </button>
          </form>

          <div className="flex items-center gap-3 my-6 text-gray-400 text-sm">
            <div className="h-px bg-gray-200 flex-1" /> Or continue with <div className="h-px bg-gray-200 flex-1" />
          </div>

          <button onClick={google}
                  className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <span className="font-bold text-base" style={{ color: '#4285F4' }}>G</span> Continue with Google
          </button>

          <p className="text-xs text-gray-400 mt-5">By continuing, you agree to our Terms and Privacy Policy.</p>
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
          <div className="mt-10 text-white/80 text-sm">
            <span className="text-white font-bold text-base">12k+</span> sitemaps built by <span className="text-white font-bold text-base">2,000+</span> teams
          </div>
        </div>
      </div>
    </div>
  );
}
