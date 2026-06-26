import React, { useState, useEffect } from 'react';
import Dashboard from './sitemap/Dashboard';
import SitemapBuilder from './sitemap/SitemapBuilder';
import Login from './Login';
import ResetPassword from './ResetPassword';
import BrandStar from './components/Brand';
import ProductTabs from './markup/ProductTabs';
import MarkupDashboard from './markup/MarkupDashboard';
import MarkupEditor from './markup/MarkupEditor';
import DesignEditor from './design/DesignEditor';
import BoardDashboard from './board/BoardDashboard';
import ProjectShell from './board/ProjectShell';
import StyleGuideDashboard from './styleguide/StyleGuideDashboard';
import StyleGuideEditor from './styleguide/StyleGuideEditor';
import StyleGuideView from './styleguide/StyleGuideView';
import MoodboardDashboard from './moodboard/MoodboardDashboard';
import MoodboardEditor from './moodboard/MoodboardEditor';
import { getProject, getPublicProject, saveProject } from './projectStore';
import { getAuth, clearAuth } from './auth';

// password reset link (#/reset?token=...)
function parseReset() {
  const m = (window.location.hash || '').match(/^#\/reset(?:\?(.*))?$/);
  if (!m) return null;
  try { return new URLSearchParams(m[1] || '').get('token') || ''; } catch (e) { return ''; }
}

// invite signup link (#/signup?email=...) — returns the prefilled email, or null when not an invite link
function parseInvite() {
  const m = (window.location.hash || '').match(/^#\/signup(?:\?(.*))?$/);
  if (!m) return null;
  try { return new URLSearchParams(m[1] || '').get('email') || ''; } catch (e) { return ''; }
}

// read the project id from the URL hash (#/p/<id>)
function parseHash() {
  const m = (window.location.hash || '').match(/^#\/p\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}
// public read-only view (#/view/<id>)
function parseView() {
  const m = (window.location.hash || '').match(/^#\/view\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}
// markup module routes (#/markup, #/markup/p/<id>, #/markup/view/<id>)
function parseMarkup() {
  const h = window.location.hash || '';
  const commentOf = (qs) => { try { return new URLSearchParams(qs || '').get('comment') || ''; } catch (e) { return ''; } };
  const pubv = h.match(/^#\/markup\/view\/([^?]+)(?:\?(.*))?$/);
  if (pubv) return { id: decodeURIComponent(pubv[1]), pub: true, commentId: commentOf(pubv[2]) };
  const e = h.match(/^#\/markup\/p\/([^?]+)(?:\?(.*))?$/);
  if (e) return { id: decodeURIComponent(e[1]), commentId: commentOf(e[2]) };
  if (h === '#/markup' || h.startsWith('#/markup')) return { id: null };
  return null;
}
// design module routes (#/design, #/design/p/<id>) — edits the same projects as Markup
function parseDesign() {
  const h = window.location.hash || '';
  const e = h.match(/^#\/design\/p\/([^?]+)$/);
  if (e) return { id: decodeURIComponent(e[1]) };
  if (h === '#/design' || h.startsWith('#/design')) return { id: null };
  return null;
}
// projects module routes (#/projects, #/projects/p/<id>) — the Boards canvas (PM/Production)
function parseProjects() {
  const h = window.location.hash || '';
  const e = h.match(/^#\/projects\/p\/([^?]+)$/);
  if (e) return { id: decodeURIComponent(e[1]) };
  if (h === '#/projects' || h.startsWith('#/projects')) return { id: null };
  return null;
}
// style guides module routes (#/styleguides, #/styleguides/p/<id>)
function parseStyleGuides() {
  const h = window.location.hash || '';
  const e = h.match(/^#\/styleguides\/p\/([^?]+)$/);
  if (e) return { id: decodeURIComponent(e[1]) };
  if (h === '#/styleguides' || h.startsWith('#/styleguides')) return { id: null };
  return null;
}
// moodboard module routes (#/moodboard, #/moodboard/p/<id>)
function parseMoodboard() {
  const h = window.location.hash || '';
  const m = h.match(/^#\/moodboard\/p\/(.+)$/);
  if (m) return { id: decodeURIComponent(m[1]) };
  if (h === '#/moodboard' || h.startsWith('#/moodboard')) return { id: null };
  return null;
}
// public read-only style guide (#/styleguides/view/<id>)
function parseStyleGuideView() {
  const m = (window.location.hash || '').match(/^#\/styleguides\/view\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Centered pulsing brand star + indeterminate progress bar (shown while a project loads)
function Loader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#FBFCFE]">
      <style>{`@keyframes qbar{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
        @keyframes qpulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.7}}`}</style>
      <div style={{ animation: 'qpulse 1.1s ease-in-out infinite' }}><BrandStar size={48} /></div>
      <div className="mt-6 w-44 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full w-2/5 rounded-full bg-[#473AE0]" style={{ animation: 'qbar 1.1s ease-in-out infinite' }} />
      </div>
      <div className="mt-3 text-xs text-gray-400">Loading project…</div>
    </div>
  );
}

export default function App() {
  const [auth, setAuthState] = useState(() => getAuth());
  const [openId, setOpenId] = useState(() => parseHash());
  const [viewId, setViewId] = useState(() => parseView());
  const [markup, setMarkup] = useState(() => parseMarkup());
  const [design, setDesign] = useState(() => parseDesign());
  const [boards, setBoards] = useState(() => parseProjects());
  const [styleGuides, setStyleGuides] = useState(() => parseStyleGuides());
  const [moodboard, setMoodboard] = useState(() => parseMoodboard());
  const [sgView, setSgView] = useState(() => parseStyleGuideView());
  const [resetToken, setResetToken] = useState(() => parseReset());
  const [invite, setInvite] = useState(() => parseInvite());
  const [viewProject, setViewProject] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);

  // only show the loader if loading takes a moment — avoids a flash/jump on fast loads
  useEffect(() => {
    if (!loading) { setShowLoader(false); return; }
    const t = setTimeout(() => setShowLoader(true), 180);
    return () => clearTimeout(t);
  }, [loading]);

  // keep state in sync with browser navigation (back/forward, manual URL)
  useEffect(() => {
    const onHash = () => { setOpenId(parseHash()); setViewId(parseView()); setMarkup(parseMarkup()); setDesign(parseDesign()); setBoards(parseProjects()); setStyleGuides(parseStyleGuides()); setMoodboard(parseMoodboard()); setSgView(parseStyleGuideView()); setResetToken(parseReset()); setInvite(parseInvite()); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // load the public read-only project (#/view/<id>) — no auth needed
  useEffect(() => {
    if (!viewId) { setViewProject(null); return; }
    let active = true;
    setViewProject(null);
    getPublicProject(viewId).then((p) => { if (active) setViewProject(p || false); });
    return () => { active = false; };
  }, [viewId]);

  // load the open project (async — backend or localStorage)
  useEffect(() => {
    if (!auth || !openId) { setProject(null); return; }
    let active = true;
    setLoading(true);
    getProject(openId).then((p) => { if (active) { setProject(p); setLoading(false); } });
    return () => { active = false; };
  }, [auth, openId]);

  const open = (id) => {
    if (window.location.hash !== `#/p/${id}`) window.location.hash = `#/p/${id}`;
    setOpenId(id);
  };
  const back = () => {
    if (window.location.hash !== '#/') window.location.hash = '#/';
    setOpenId(null);
  };
  const logout = () => { clearAuth(); setAuthState(null); back(); };

  // password reset link (no login required)
  if (resetToken !== null) {
    return <ResetPassword token={resetToken} onDone={(u) => { setAuthState(u); setResetToken(null); window.location.hash = '#/'; }} />;
  }

  // public read-only view (no login required)
  if (viewId) {
    if (viewProject === null) return <Loader />;
    if (viewProject === false) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#FBFCFE] text-gray-500 gap-3">
          <BrandStar size={40} />
          <div className="text-sm">This shared project doesn’t exist or was removed.</div>
        </div>
      );
    }
    return (
      <SitemapBuilder key={`view-${viewId}`} project={viewProject} readOnly onBack={() => { window.location.hash = '#/'; }} onChange={() => {}} />
    );
  }

  // public style guide share link (no login required)
  if (sgView) {
    return <StyleGuideView key={`sgview-${sgView}`} id={sgView} />;
  }

  // public markup share link (no login required)
  if (markup && markup.pub && markup.id) {
    return <MarkupEditor key={`mview-${markup.id}`} id={markup.id} pub focusCommentId={markup.commentId || ''} onBack={() => { window.location.hash = '#/'; }} />;
  }

  if (!auth) return <Login onLogin={(u) => { setAuthState(u); if ((window.location.hash || '').startsWith('#/signup')) window.location.hash = '#/'; }} initialMode={invite !== null ? 'signup' : 'login'} initialEmail={invite || ''} />;

  // ---- Markup module ----
  if (markup) {
    const openMarkup = (id) => { window.location.hash = `#/markup/p/${id}`; setMarkup({ id }); };
    if (markup.id) {
      return <MarkupEditor key={markup.id} id={markup.id} user={auth} focusCommentId={markup.commentId || ''} onLogout={logout} onUserChange={setAuthState} onBack={() => { window.location.hash = '#/markup'; setMarkup({ id: null }); }} />;
    }
    return (
      <div className="fixed inset-0 flex flex-col bg-[#FBFCFE]">
        <ProductTabs active="markup" user={auth} onLogout={logout} onUserChange={setAuthState} />
        <div className="flex-1 relative min-h-0">
          <MarkupDashboard onOpen={openMarkup} user={auth} onLogout={logout} onUserChange={setAuthState} />
        </div>
      </div>
    );
  }

  // ---- Design module (PM + Production only) ----
  if (design && !['pm', 'production'].includes(auth?.teamRole)) {
    // Not permitted — send them to Markup instead.
    if (window.location.hash.startsWith('#/design')) window.location.hash = '#/markup';
    return (
      <div className="fixed inset-0 flex flex-col bg-[#FBFCFE]">
        <ProductTabs active="markup" user={auth} onLogout={logout} onUserChange={setAuthState} />
        <div className="flex-1 relative min-h-0">
          <MarkupDashboard onOpen={(id) => { window.location.hash = `#/markup/p/${id}`; setMarkup({ id }); }} user={auth} onLogout={logout} onUserChange={setAuthState} />
        </div>
      </div>
    );
  }
  if (design) {
    const openDesign = (id) => { window.location.hash = `#/design/p/${id}`; setDesign({ id }); };
    if (design.id) {
      return <DesignEditor key={design.id} id={design.id} user={auth} onLogout={logout} onUserChange={setAuthState} onBack={() => { window.location.hash = '#/design'; setDesign({ id: null }); }} />;
    }
    return (
      <div className="fixed inset-0 flex flex-col bg-[#FBFCFE]">
        <ProductTabs active="design" user={auth} onLogout={logout} onUserChange={setAuthState} />
        <div className="flex-1 relative min-h-0">
          <MarkupDashboard onOpen={openDesign} heading="Design projects" designMode user={auth} onLogout={logout} onUserChange={setAuthState} />
        </div>
      </div>
    );
  }

  // ---- Projects module (Boards canvas — PM + Production only) ----
  if (boards && !['pm', 'production'].includes(auth?.teamRole)) {
    if (window.location.hash.startsWith('#/projects')) window.location.hash = '#/';
    return (
      <div className="fixed inset-0 flex flex-col bg-[#FBFCFE]">
        <ProductTabs active="sitemap" user={auth} onLogout={logout} onUserChange={setAuthState} />
        <div className="flex-1 relative min-h-0">
          <Dashboard onOpen={open} user={auth} onLogout={logout} onUserChange={setAuthState} />
        </div>
      </div>
    );
  }
  if (boards) {
    const openBoard = (bid) => { window.location.hash = `#/projects/p/${bid}`; setBoards({ id: bid }); };
    if (boards.id) {
      return <ProjectShell key={boards.id} id={boards.id} user={auth} onLogout={logout} onUserChange={setAuthState} onBack={() => { window.location.hash = '#/projects'; setBoards({ id: null }); }} />;
    }
    return (
      <div className="fixed inset-0 flex flex-col bg-[#FBFCFE]">
        <ProductTabs active="projects" user={auth} onLogout={logout} onUserChange={setAuthState} />
        <div className="flex-1 relative min-h-0">
          <BoardDashboard onOpen={openBoard} />
        </div>
      </div>
    );
  }

  // ---- Moodboard module ----
  if (moodboard) {
    const openMoodboard = (mid) => { window.location.hash = `#/moodboard/p/${mid}`; setMoodboard({ id: mid }); };
    if (moodboard.id) {
      return <MoodboardEditor key={moodboard.id} id={moodboard.id} user={auth} onBack={() => { window.location.hash = '#/moodboard'; setMoodboard({ id: null }); }} />;
    }
    return (
      <div className="fixed inset-0 flex flex-col bg-[#FBFCFE]">
        <ProductTabs active="moodboard" user={auth} onLogout={logout} onUserChange={setAuthState} />
        <div className="flex-1 relative min-h-0">
          <MoodboardDashboard onOpen={openMoodboard} />
        </div>
      </div>
    );
  }

  // ---- Style Guides module (all roles) ----
  if (styleGuides) {
    const openGuide = (sid) => { window.location.hash = `#/styleguides/p/${sid}`; setStyleGuides({ id: sid }); };
    if (styleGuides.id) {
      return <StyleGuideEditor key={styleGuides.id} id={styleGuides.id} user={auth} onLogout={logout} onUserChange={setAuthState} onBack={() => { window.location.hash = '#/styleguides'; setStyleGuides({ id: null }); }} />;
    }
    return (
      <div className="fixed inset-0 flex flex-col bg-[#FBFCFE]">
        <ProductTabs active="styleguides" user={auth} onLogout={logout} onUserChange={setAuthState} />
        <div className="flex-1 relative min-h-0">
          <StyleGuideDashboard onOpen={openGuide} user={auth} />
        </div>
      </div>
    );
  }

  if (!openId) return (
    <div className="fixed inset-0 flex flex-col bg-[#FBFCFE]">
      <ProductTabs active="sitemap" user={auth} onLogout={logout} onUserChange={setAuthState} />
      <div className="flex-1 relative min-h-0">
        <Dashboard onOpen={open} user={auth} onLogout={logout} onUserChange={setAuthState} />
      </div>
    </div>
  );

  if (loading) return showLoader ? <Loader /> : <div className="fixed inset-0 bg-[#FBFCFE]" />;
  if (!project) return (
    <div className="fixed inset-0 flex flex-col bg-[#FBFCFE]">
      <ProductTabs active="sitemap" user={auth} onLogout={logout} onUserChange={setAuthState} />
      <div className="flex-1 relative min-h-0">
        <Dashboard onOpen={open} user={auth} onLogout={logout} onUserChange={setAuthState} />
      </div>
    </div>
  );

  return (
    <div key={project.id} style={{ animation: 'qfadein .22s ease-out' }}>
      <style>{`@keyframes qfadein{from{opacity:0}to{opacity:1}}`}</style>
      <SitemapBuilder
        project={project}
        user={auth}
        onBack={back}
        onLogout={logout}
        onUserChange={setAuthState}
        onChange={(patch) => saveProject(project.id, patch)}
      />
    </div>
  );
}
