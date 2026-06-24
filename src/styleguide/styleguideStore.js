/* ------------------------------------------------------------------ */
/*  Style guide store. Async API.                                       */
/*  - With a backend (REACT_APP_API_URL): calls /api/styleguides.       */
/*  - Otherwise persists to localStorage (offline / dev).              */
/* ------------------------------------------------------------------ */
import {
  hasBackend, apiListStyleGuides, apiGetStyleGuide, apiCreateStyleGuide,
  apiPatchStyleGuide, apiDuplicateStyleGuide, apiDeleteStyleGuide, apiGetPublicStyleGuide,
} from './styleguideApi';

const KEY = 'qoders-styleguides-v1';

export const uid = () => Math.random().toString(36).slice(2, 9);

// Minimal offline fallback document (the rich template lives on the backend).
const BLANK_DOC = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Style guide</title>'
  + '<style>:root{--color-brand:#2D0A44;--color-accent:#FF5227}body{font-family:-apple-system,Segoe UI,sans-serif;margin:0;padding:48px;color:var(--color-brand)}h1{font-size:48px}</style>'
  + '</head><body><h1>Style guide</h1><p>Start editing — click any element.</p></body></html>';

/* ----------------------- localStorage backend ----------------------- */
function read() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  return null;
}
function write(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }

const local = {
  list() { return [...(read() || [])].sort((a, b) => b.updatedAt - a.updatedAt); },
  get(id) { return (read() || []).find((p) => p.id === id) || null; },
  create(name, ac) {
    const list = read() || [];
    const sg = { id: uid(), name, createdAt: Date.now(), updatedAt: Date.now(), content: BLANK_DOC, settings: {},
                 acProjectId: ac?.acProjectId || '', acProjectName: ac?.acProjectName || '' };
    write([sg, ...list]);
    return sg;
  },
  patch(id, patch) {
    const list = read() || [];
    write(list.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)));
  },
  duplicate(id) {
    const list = read() || [];
    const src = list.find((p) => p.id === id);
    if (!src) return null;
    const copy = { id: uid(), name: `${src.name} copy`, createdAt: Date.now(), updatedAt: Date.now(),
                   content: src.content || BLANK_DOC, settings: src.settings || {} };
    write([copy, ...list]);
    return copy;
  },
  remove(id) { write((read() || []).filter((p) => p.id !== id)); },
};

/* --------------------------- public API ----------------------------- */
export async function listStyleGuides() {
  if (hasBackend()) return apiListStyleGuides();
  return local.list();
}

export async function getStyleGuide(id) {
  if (hasBackend()) { try { return await apiGetStyleGuide(id); } catch (e) { return null; } }
  return local.get(id);
}

// Public read-only fetch for share links (no auth).
export async function getPublicStyleGuide(id) {
  if (hasBackend()) return apiGetPublicStyleGuide(id);
  return local.get(id);
}

export async function createStyleGuide(name = 'Untitled style guide', opts = {}) {
  const content = typeof opts.content === 'string' ? opts.content : undefined;
  if (hasBackend()) return apiCreateStyleGuide({ name, settings: {}, ...(content !== undefined ? { content } : {}) });
  const sg = local.create(name, {});
  if (content !== undefined) { local.patch(sg.id, { content }); return { ...sg, content }; }
  return sg;
}

export async function saveStyleGuide(id, patch) {
  if (hasBackend()) { try { await apiPatchStyleGuide(id, patch); } catch (e) {} return; }
  local.patch(id, patch);
}

export async function renameStyleGuide(id, name) { return saveStyleGuide(id, { name }); }
export async function duplicateStyleGuide(id) {
  if (hasBackend()) return apiDuplicateStyleGuide(id);
  return local.duplicate(id);
}
export async function archiveStyleGuide(id, archived) { return saveStyleGuide(id, { archived }); }
export async function completeStyleGuide(id, completed) { return saveStyleGuide(id, { completed }); }
export async function deleteStyleGuide(id) {
  if (hasBackend()) { try { await apiDeleteStyleGuide(id); } catch (e) {} return; }
  local.remove(id);
}
