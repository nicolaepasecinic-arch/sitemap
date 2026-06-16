import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import SitemapBuilder from './SitemapBuilder';
import Login from './Login';
import { getProject, saveProject } from './projectStore';
import { getAuth, setAuth, clearAuth } from './auth';

// read the project id from the URL hash (#/p/<id>)
function parseHash() {
  const m = (window.location.hash || '').match(/^#\/p\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function App() {
  const [auth, setAuthState] = useState(() => getAuth());
  const [openId, setOpenId] = useState(() => parseHash());

  // keep state in sync with browser navigation (back/forward, manual URL)
  useEffect(() => {
    const onHash = () => setOpenId(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const open = (id) => {
    if (window.location.hash !== `#/p/${id}`) window.location.hash = `#/p/${id}`;
    setOpenId(id);
  };
  const back = () => {
    if (window.location.hash !== '#/') window.location.hash = '#/';
    setOpenId(null);
  };
  const logout = () => {
    clearAuth();
    setAuthState(null);
    back();
  };

  if (!auth) {
    return <Login onLogin={(u) => { setAuth(u); setAuthState(u); }} />;
  }

  if (!openId) {
    return <Dashboard onOpen={open} user={auth} onLogout={logout} />;
  }

  const project = getProject(openId);
  if (!project) {
    return <Dashboard onOpen={open} user={auth} onLogout={logout} />;
  }

  return (
    <SitemapBuilder
      key={project.id}
      project={project}
      onBack={back}
      onChange={(patch) => saveProject(project.id, patch)}
    />
  );
}
