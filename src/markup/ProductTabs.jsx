import React, { useState, useRef, useEffect } from 'react';
import { Map, MessageSquare, ChevronDown, User, LogOut, Bot, Users, Wand2, FolderKanban, Palette, LayoutGrid } from 'lucide-react';
import BrandStar, { BrandWordmark } from '../components/Brand';
import Account from '../components/Account';
import ConnectAI from '../components/ConnectAI';
import Team from '../components/Team';
import { initials } from '../auth';

/* Global top bar: Qoders logo (left), product tabs (center), account (right). */
export default function ProductTabs({ active, user, onLogout, onUserChange }) {
  const [open, setOpen] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const go = (hash) => { if (window.location.hash !== hash) window.location.hash = hash; };
  const tab = (id, label, Icon, hash) => (
    <button onClick={() => go(hash)} title={label}
            className={`flex items-center gap-2 px-3 sm:px-4 h-9 rounded-full text-sm font-medium transition shrink-0 whitespace-nowrap
              ${active === id ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
      <Icon size={16} className={active === id ? 'text-[#473AE0]' : 'text-gray-400'} /> <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="h-14 shrink-0 bg-white border-b border-gray-100 flex items-center gap-2 px-3 sm:px-5">
      {/* logo */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <BrandStar size={22} />
        <span className="hidden sm:flex"><BrandWordmark /></span>
      </div>

      {/* tabs (centered) */}
      <div className="shrink min-w-0 flex justify-center overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
          {['pm', 'production'].includes(user?.teamRole) && tab('projects', 'Projects', FolderKanban, '#/projects')}
          {tab('sitemap', 'Sitemap', Map, '#/')}
          {tab('moodboard', 'Moodboard', LayoutGrid, '#/moodboard')}
          {tab('styleguides', 'Style Guides', Palette, '#/styleguides')}
          {['pm', 'production'].includes(user?.teamRole) && tab('design', 'Design', Wand2, '#/design')}
          {tab('markup', 'Markup', MessageSquare, '#/markup')}
        </div>
      </div>

      {/* account */}
      <div className="flex-1 min-w-0 flex justify-end">
        <div className="relative" ref={ref}>
          <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 hover:bg-gray-50 rounded-full pl-1 pr-1 sm:pr-3 py-1">
            <span className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-bold">{initials(user?.name)}</span>
            <span className="hidden sm:inline text-sm text-gray-700 whitespace-nowrap max-w-[120px] truncate">{user?.name || 'My account'}</span>
            <ChevronDown size={15} className="hidden sm:block text-gray-400" />
          </button>
          {open && (
            <div className="absolute right-0 top-12 z-50 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5">
              {user?.email && <div className="px-3 py-1.5 text-xs text-gray-400 truncate">{user.email}</div>}
              <button onClick={() => { setOpen(false); setAccountModal(true); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left"><User size={15} /> Account settings</button>
              {user?.teamRole === 'pm' && <button onClick={() => { setOpen(false); setTeamOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left"><Users size={15} /> Team</button>}
              {user?.teamRole !== 'client' && <button onClick={() => { setOpen(false); setConnectOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left"><Bot size={15} /> Connect to AI</button>}
              <div className="h-px bg-gray-100 my-1" />
              <button onClick={() => { setOpen(false); onLogout && onLogout(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 text-left"><LogOut size={15} /> Logout</button>
            </div>
          )}
        </div>
      </div>

      {accountModal && <Account user={user || {}} onClose={() => setAccountModal(false)} onUpdated={(u) => onUserChange && onUserChange(u)} onLogout={onLogout} />}
      {teamOpen && <Team user={user} onClose={() => setTeamOpen(false)} />}
      {connectOpen && <ConnectAI onClose={() => setConnectOpen(false)} />}
    </div>
  );
}
