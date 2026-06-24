/* ------------------------------------------------------------------ */
/*  Board store. Async API.                                             */
/*  - If a backend is configured (REACT_APP_API_URL), calls the API.    */
/*  - Otherwise persists to localStorage (offline / dev).               */
/* ------------------------------------------------------------------ */
import {
  hasBackend, apiListBoards, apiGetBoard, apiCreateBoard,
  apiPatchBoard, apiDuplicateBoard, apiDeleteBoard,
} from './boardApi';

const KEY = 'qoders-boards-v1';

export const uid = () => Math.random().toString(36).slice(2, 9);

/* ----------------------- localStorage backend ----------------------- */
function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}
function write(boards) {
  try { localStorage.setItem(KEY, JSON.stringify(boards)); } catch (e) {}
}

const local = {
  list() {
    const boards = read() || [];
    return [...boards].sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id) { return (read() || []).find((p) => p.id === id) || null; },
  create(name, ac) {
    const boards = read() || [];
    const board = { id: uid(), name, createdAt: Date.now(), updatedAt: Date.now(), items: [], settings: {},
                    acProjectId: ac?.acProjectId || '', acProjectName: ac?.acProjectName || '' };
    write([board, ...boards]);
    return board;
  },
  patch(id, patch) {
    const boards = read() || [];
    write(boards.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)));
  },
  duplicate(id) {
    const boards = read() || [];
    const src = boards.find((p) => p.id === id);
    if (!src) return null;
    const copy = {
      id: uid(), name: `${src.name} copy`, createdAt: Date.now(), updatedAt: Date.now(),
      items: JSON.parse(JSON.stringify(src.items || [])), settings: src.settings || {},
    };
    write([copy, ...boards]);
    return copy;
  },
  remove(id) {
    const boards = read() || [];
    write(boards.filter((p) => p.id !== id));
  },
};

/* --------------------------- public API ----------------------------- */
export async function listBoards() {
  if (hasBackend()) return apiListBoards();
  return local.list();
}

export async function getBoard(id) {
  if (hasBackend()) {
    try { return await apiGetBoard(id); } catch (e) { return null; }
  }
  return local.get(id);
}

export async function createBoard(name = 'Untitled project', ac = {}) {
  if (hasBackend()) return apiCreateBoard({ name, items: [], settings: {}, acProjectId: ac.acProjectId || '', acProjectName: ac.acProjectName || '' });
  return local.create(name, ac);
}

export async function saveBoard(id, patch) {
  if (hasBackend()) { try { await apiPatchBoard(id, patch); } catch (e) {} return; }
  local.patch(id, patch);
}

export async function renameBoard(id, name) {
  return saveBoard(id, { name });
}

export async function duplicateBoard(id) {
  if (hasBackend()) return apiDuplicateBoard(id);
  return local.duplicate(id);
}

export async function archiveBoard(id, archived) {
  return saveBoard(id, { archived });
}

export async function completeBoard(id, completed) {
  return saveBoard(id, { completed });
}

export async function deleteBoard(id) {
  if (hasBackend()) { try { await apiDeleteBoard(id); } catch (e) {} return; }
  local.remove(id);
}
