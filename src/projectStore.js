/* ------------------------------------------------------------------ */
/*  Project store. Async API.                                           */
/*  - If a backend is configured (REACT_APP_API_URL), calls the API.    */
/*  - Otherwise persists to localStorage (offline / dev).               */
/* ------------------------------------------------------------------ */
import {
  hasBackend, apiListProjects, apiGetProject, apiCreateProject,
  apiPatchProject, apiDuplicateProject, apiDeleteProject, apiPublicProject,
} from './api';

const KEY = 'sitemap-projects-v1';

export const uid = () => Math.random().toString(36).slice(2, 9);

/* Default page tree for a brand-new project (mirrors the reference). */
export const seedNodes = () => {
  const home = {
    id: 'home', label: 'Page', parentId: null, group: 'main', color: 'blue', link: '', pageFrame: 'window',
    blocks: [
      { id: uid(), name: 'Header',       color: 'teal',   frame: 'carousel', arrows: false },
      { id: uid(), name: 'Introduction', color: 'blue',   frame: 'text',     arrows: false },
      { id: uid(), name: 'Services',     color: 'blue',   frame: 'cols3',    arrows: false },
      { id: uid(), name: 'Latest News',  color: 'blue',   frame: 'cards3',   arrows: false },
      { id: uid(), name: 'Footer',       color: 'purple', frame: 'cols4',    arrows: false },
    ],
  };
  const child = (l) => ({ id: uid(), label: l, parentId: 'home', group: 'main', color: 'blue', link: '', pageFrame: 'window', blocks: [] });
  const sect = (l) => ({ id: uid(), label: l, parentId: null, group: 'section', color: 'blue', link: '', pageFrame: 'window', blocks: [] });
  return [home, child('Page'), child('Page'), child('Page'), sect('Cookies'), sect('404 Error')];
};

/* ----------------------- localStorage backend ----------------------- */
function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}
function write(projects) {
  try { localStorage.setItem(KEY, JSON.stringify(projects)); } catch (e) {}
}

const local = {
  list() {
    let projects = read();
    if (!projects) {
      projects = [{ id: uid(), name: 'Untitled project', createdAt: Date.now(), updatedAt: Date.now(), nodes: seedNodes(), items: [] }];
      write(projects);
    }
    return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id) { return (read() || []).find((p) => p.id === id) || null; },
  create(name, nodes) {
    const projects = read() || [];
    const project = { id: uid(), name, createdAt: Date.now(), updatedAt: Date.now(), nodes: nodes || seedNodes(), items: [] };
    write([project, ...projects]);
    return project;
  },
  patch(id, patch) {
    const projects = read() || [];
    write(projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)));
  },
  duplicate(id) {
    const projects = read() || [];
    const src = projects.find((p) => p.id === id);
    if (!src) return null;
    const copy = {
      id: uid(), name: `${src.name} copy`, createdAt: Date.now(), updatedAt: Date.now(),
      nodes: JSON.parse(JSON.stringify(src.nodes)), items: JSON.parse(JSON.stringify(src.items || [])), settings: src.settings,
    };
    write([copy, ...projects]);
    return copy;
  },
  remove(id) {
    const projects = read() || [];
    write(projects.filter((p) => p.id !== id));
  },
};

/* --------------------------- public API ----------------------------- */
export async function listProjects() {
  if (hasBackend()) return apiListProjects();
  return local.list();
}

export async function getProject(id) {
  if (hasBackend()) {
    try { return await apiGetProject(id); } catch (e) { return null; }
  }
  return local.get(id);
}

// read-only fetch for the public share link (no auth)
export async function getPublicProject(id) {
  if (hasBackend()) {
    try { return await apiPublicProject(id); } catch (e) { return null; }
  }
  return local.get(id);
}

export async function createProject(name = 'Untitled project') {
  if (hasBackend()) return apiCreateProject({ name, nodes: seedNodes(), items: [] });
  return local.create(name);
}

export async function createProjectFromTemplate(name, nodes) {
  if (hasBackend()) return apiCreateProject({ name, nodes, items: [] });
  return local.create(name, nodes);
}

export async function saveProject(id, patch) {
  if (hasBackend()) { try { await apiPatchProject(id, patch); } catch (e) {} return; }
  local.patch(id, patch);
}

export async function renameProject(id, name) {
  return saveProject(id, { name });
}

export async function duplicateProject(id) {
  if (hasBackend()) return apiDuplicateProject(id);
  return local.duplicate(id);
}

export async function archiveProject(id, archived) {
  return saveProject(id, { archived });
}

export async function completeProject(id, completed) {
  return saveProject(id, { completed });
}

export async function deleteProject(id) {
  if (hasBackend()) { try { await apiDeleteProject(id); } catch (e) {} return; }
  local.remove(id);
}
