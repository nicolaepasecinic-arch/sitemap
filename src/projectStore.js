/* ------------------------------------------------------------------ */
/*  Project store — projects persisted in localStorage                 */
/*  project = { id, name, updatedAt, nodes: [...] }                    */
/* ------------------------------------------------------------------ */

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

/* Returns all projects, newest first. Seeds one starter project on first run. */
export function listProjects() {
  let projects = read();
  if (!projects) {
    const starter = { id: uid(), name: 'Untitled project', createdAt: Date.now(), updatedAt: Date.now(), nodes: seedNodes(), items: [] };
    // one-time migration from the old single-canvas key, if present
    try {
      const legacy = localStorage.getItem('sitemap-canvas-v2');
      if (legacy) {
        const nodes = JSON.parse(legacy);
        if (Array.isArray(nodes) && nodes.length) starter.nodes = nodes;
      }
    } catch (e) {}
    projects = [starter];
    write(projects);
  }
  return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProject(id) {
  return (read() || []).find((p) => p.id === id) || null;
}

export function createProject(name = 'Untitled project') {
  const projects = read() || [];
  const project = { id: uid(), name, createdAt: Date.now(), updatedAt: Date.now(), nodes: seedNodes(), items: [] };
  write([project, ...projects]);
  return project;
}

export function createProjectFromTemplate(name, nodes) {
  const projects = read() || [];
  const project = { id: uid(), name, createdAt: Date.now(), updatedAt: Date.now(), nodes, items: [] };
  write([project, ...projects]);
  return project;
}

export function saveProject(id, patch) {
  const projects = read() || [];
  const next = projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p));
  write(next);
}

export function renameProject(id, name) {
  saveProject(id, { name });
}

export function duplicateProject(id) {
  const projects = read() || [];
  const src = projects.find((p) => p.id === id);
  if (!src) return null;
  const copy = {
    id: uid(),
    name: `${src.name} copy`,
    updatedAt: Date.now(),
    nodes: JSON.parse(JSON.stringify(src.nodes)),
    items: JSON.parse(JSON.stringify(src.items || [])),
  };
  write([copy, ...projects]);
  return copy;
}

export function archiveProject(id, archived) {
  const projects = read() || [];
  write(projects.map((p) => (p.id === id ? { ...p, archived } : p)));
}

export function completeProject(id, completed) {
  const projects = read() || [];
  write(projects.map((p) => (p.id === id ? { ...p, completed } : p)));
}

export function deleteProject(id) {
  const projects = read() || [];
  write(projects.filter((p) => p.id !== id));
}
