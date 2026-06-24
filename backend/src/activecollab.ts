// Active Collab integration. The API token comes from the requesting user's profile
// (Account settings); the env ACTIVECOLLAB_TOKEN is only a fallback. Base URL is from env.
// Use https — an http→https redirect turns our POST into a GET (so creates silently fail).
const AC_URL = (process.env.ACTIVECOLLAB_URL || 'https://client.upqode.com').replace(/\/+$/, '').replace(/^http:\/\//, 'https://');
const AC_TOKEN_FALLBACK = process.env.ACTIVECOLLAB_TOKEN || '';

const resolveToken = (token?: string) => String(token || '').trim() || AC_TOKEN_FALLBACK;
const authHeaders = (token: string, withBody = false) => ({
  'X-Angie-AuthApiToken': token,
  Accept: 'application/json',
  ...(withBody ? { 'Content-Type': 'application/json' } : {}),
});

// Pull a { id, name } out of whatever shape AC returns (object, { single }, etc.).
function pickProject(d: any): { id: string; name: string } | null {
  if (!d || typeof d !== 'object') return null;
  const c = d.single || d.project || d.data || d;
  if (c && c.id != null && String(c.id).trim()) return { id: String(c.id).trim(), name: String(c.name || '').trim() };
  return null;
}

// Look up an Active Collab project by ID. Resolves to { id, name } or throws.
export async function fetchAcProject(token: string, acId: string): Promise<{ id: string; name: string }> {
  const T = resolveToken(token);
  if (!T) throw new Error('Add your Active Collab API token in Account settings first.');
  const id = String(acId || '').trim().replace(/[^0-9]/g, '');
  if (!id) throw new Error('Enter a numeric Active Collab project ID.');

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  let r: any;
  try { r = await fetch(`${AC_URL}/api/v1/projects/${id}`, { headers: authHeaders(T), signal: ctrl.signal }); }
  catch (e) { clearTimeout(to); throw new Error('Could not reach Active Collab.'); }
  clearTimeout(to);

  if (r.status === 404) throw new Error(`No Active Collab project found with ID ${id}.`);
  if (r.status === 401 || r.status === 403) throw new Error('Active Collab rejected the API token.');
  if (!r.ok) throw new Error(`Active Collab error (${r.status}).`);

  let data: any;
  try { data = await r.json(); } catch { throw new Error('Active Collab returned an unexpected response.'); }
  const p = data?.single || data;
  const name = String(p?.name || '').trim();
  if (!name) throw new Error(`Active Collab project ${id} has no name.`);
  return { id, name };
}

// Fallback: find the newest AC project whose name matches (after creating one).
async function findAcProjectByName(token: string, nm: string): Promise<{ id: string; name: string } | null> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  let r: any;
  try { r = await fetch(`${AC_URL}/api/v1/projects`, { headers: authHeaders(token), signal: ctrl.signal }); }
  catch { clearTimeout(to); return null; }
  clearTimeout(to);
  if (!r.ok) return null;
  let data: any; try { data = await r.json(); } catch { return null; }
  const list: any[] = Array.isArray(data) ? data : (Array.isArray(data?.projects) ? data.projects : []);
  const matches = list.filter((p) => String(p?.name || '').trim() === nm && p?.id != null);
  if (!matches.length) return null;
  matches.sort((a, b) => Number(b.id) - Number(a.id));
  return { id: String(matches[0].id), name: String(matches[0].name || nm).trim() };
}

// Fallback: find the newest non-trashed task in a project whose name matches.
async function findAcTaskByName(token: string, pid: string, nm: string): Promise<{ id: string; number: string } | null> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  let r: any;
  try { r = await fetch(`${AC_URL}/api/v1/projects/${pid}/tasks`, { headers: authHeaders(token), signal: ctrl.signal }); }
  catch { clearTimeout(to); return null; }
  clearTimeout(to);
  if (!r.ok) return null;
  let data: any; try { data = await r.json(); } catch { return null; }
  const list: any[] = Array.isArray(data) ? data : (Array.isArray(data?.tasks) ? data.tasks : []);
  const matches = list.filter((t) => String(t?.name || '').trim() === nm && t?.id != null && !t?.is_trashed);
  if (!matches.length) return null;
  matches.sort((a, b) => Number(b.id) - Number(a.id));
  const t = matches[0];
  return { id: String(t.id), number: t.task_number != null ? String(t.task_number) : String(t.id) };
}

// Create or update an Active Collab TASK inside a project. Returns the task id + number.
export async function syncAcTask(
  token: string,
  acProjectId: string,
  opts: { name: string; body?: string; taskId?: string }
): Promise<{ taskId: string; taskNumber: string }> {
  const T = resolveToken(token);
  if (!T) throw new Error('Add your Active Collab API token in Account settings first.');
  const pid = String(acProjectId || '').trim();
  if (!pid) throw new Error('No Active Collab project assigned.');
  const name = String(opts.name || '').trim().slice(0, 191) || 'Untitled page';
  const body = String(opts.body || '');
  const taskId = String(opts.taskId || '').trim();

  const doRequest = async (method: 'POST' | 'PUT', url: string) => {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 20000);
    let r: any;
    try { r = await fetch(url, { method, headers: authHeaders(T, true), body: JSON.stringify({ name, body }), signal: ctrl.signal }); }
    catch (e) { clearTimeout(to); throw new Error('Could not reach Active Collab.'); }
    clearTimeout(to);
    return r;
  };

  const base = `${AC_URL}/api/v1/projects/${pid}/tasks`;

  // Does a task still exist (and isn't trashed)? Someone may have deleted it — then recreate.
  const taskExists = async (tid: string): Promise<boolean> => {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 15000);
    let g: any;
    try { g = await fetch(`${base}/${tid}`, { headers: authHeaders(T), signal: ctrl.signal }); }
    catch { clearTimeout(to); return false; }
    clearTimeout(to);
    if (!g.ok) return false;
    let d: any = null; try { d = await g.json(); } catch { return true; }
    const t = d?.single || d?.task || d;
    if (!t || t.id == null) return false;
    if (t.is_trashed || t.is_archived) return false;
    return true;
  };

  let r: any;
  if (taskId && (await taskExists(taskId))) {
    r = await doRequest('PUT', `${base}/${taskId}`);
    if (r.status === 404) r = await doRequest('POST', base); // raced deletion — recreate
  } else {
    r = await doRequest('POST', base); // no id, or task was deleted/trashed — create new
  }

  if (r.status === 401 || r.status === 403) throw new Error('Active Collab rejected the API token.');
  if (!r.ok) {
    let msg = `Active Collab error (${r.status}).`;
    try { const e: any = await r.json(); if (e?.message) msg = `Active Collab: ${e.message}`; if (e?.field_errors) msg += ' ' + JSON.stringify(e.field_errors); } catch { /* ignore */ }
    throw new Error(msg);
  }
  let data: any = null;
  try { data = await r.json(); } catch { /* ignore */ }
  const t = data?.single || data?.task || data;
  let id = t && t.id != null ? String(t.id) : '';
  let number = t && t.task_number != null ? String(t.task_number) : '';
  if (!id) {
    console.error('AC task: could not read id from response:', JSON.stringify(data).slice(0, 500));
    const found = await findAcTaskByName(T, pid, name);
    if (found) { id = found.id; number = found.number; }
  }
  if (!id) throw new Error('Active Collab did not return the task ID.');
  return { taskId: id, taskNumber: number || id };
}

// Create or update an Active Collab SUBTASK under a task. Subtasks only carry a `body`
// (their text). Returns the subtask id + number. Recreates if the subtask was deleted.
export async function syncAcSubtask(
  token: string,
  acProjectId: string,
  taskId: string,
  opts: { body: string; subtaskId?: string; completed?: boolean }
): Promise<{ subtaskId: string; subtaskNumber: string }> {
  const T = resolveToken(token);
  if (!T) throw new Error('Add your Active Collab API token in Account settings first.');
  const pid = String(acProjectId || '').trim();
  const tid = String(taskId || '').trim();
  if (!pid || !tid) throw new Error('Sync the page first.');
  const body = String(opts.body || '').trim().slice(0, 5000) || 'Comment';
  const subId = String(opts.subtaskId || '').trim();
  const base = `${AC_URL}/api/v1/projects/${pid}/tasks/${tid}/subtasks`;

  const doRequest = async (method: 'POST' | 'PUT', url: string) => {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 20000);
    let r: any;
    try { r = await fetch(url, { method, headers: authHeaders(T, true), body: JSON.stringify({ body }), signal: ctrl.signal }); }
    catch (e) { clearTimeout(to); throw new Error('Could not reach Active Collab.'); }
    clearTimeout(to);
    return r;
  };

  const subExists = async (sid: string): Promise<boolean> => {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 15000);
    let g: any;
    try { g = await fetch(`${base}/${sid}`, { headers: authHeaders(T), signal: ctrl.signal }); }
    catch { clearTimeout(to); return false; }
    clearTimeout(to);
    if (!g.ok) return false;
    let d: any = null; try { d = await g.json(); } catch { return true; }
    const s = d?.single || d?.subtask || d;
    if (!s || s.id == null) return false;
    if (s.is_trashed) return false;
    return true;
  };

  let r: any;
  if (subId && (await subExists(subId))) {
    r = await doRequest('PUT', `${base}/${subId}`);
    if (r.status === 404) r = await doRequest('POST', base);
  } else {
    r = await doRequest('POST', base);
  }

  if (r.status === 401 || r.status === 403) throw new Error('Active Collab rejected the API token.');
  if (!r.ok) {
    let msg = `Active Collab error (${r.status}).`;
    try { const e: any = await r.json(); if (e?.message) msg = `Active Collab: ${e.message}`; if (e?.field_errors) msg += ' ' + JSON.stringify(e.field_errors); } catch { /* ignore */ }
    throw new Error(msg);
  }
  let data: any = null; try { data = await r.json(); } catch { /* ignore */ }
  const s = data?.single || data?.subtask || data;
  const id = s && s.id != null ? String(s.id) : '';
  if (!id) throw new Error('Active Collab did not return the subtask ID.');

  // Reflect the comment's done state on the subtask (best-effort).
  if (opts.completed !== undefined) {
    const isDone = !!s.is_completed;
    if (opts.completed !== isDone) {
      const action = opts.completed ? 'complete' : 'open';
      try {
        const c2 = new AbortController();
        const t2 = setTimeout(() => c2.abort(), 15000);
        await fetch(`${AC_URL}/api/v1/${action}/subtask/${id}`, { method: 'PUT', headers: authHeaders(T, true), body: '{}', signal: c2.signal });
        clearTimeout(t2);
      } catch { /* ignore — completion is best-effort */ }
    }
  }
  return { subtaskId: id, subtaskNumber: s.task_number != null ? String(s.task_number) : id };
}

// Create a brand-new project in Active Collab and return { id, name }.
export async function createAcProject(token: string, name: string): Promise<{ id: string; name: string }> {
  const T = resolveToken(token);
  if (!T) throw new Error('Add your Active Collab API token in Account settings first.');
  const nm = String(name || '').trim();
  if (!nm) throw new Error('Enter a name for the new project.');

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  let r: any;
  try { r = await fetch(`${AC_URL}/api/v1/projects`, { method: 'POST', headers: authHeaders(T, true), body: JSON.stringify({ name: nm.slice(0, 191) }), signal: ctrl.signal }); }
  catch (e) { clearTimeout(to); throw new Error('Could not reach Active Collab.'); }
  clearTimeout(to);

  if (r.status === 401 || r.status === 403) throw new Error('Active Collab rejected the API token.');
  if (!r.ok) {
    let msg = `Active Collab error (${r.status}).`;
    try { const e: any = await r.json(); if (e?.message) msg = `Active Collab: ${e.message}`; if (e?.field_errors) msg += ' ' + JSON.stringify(e.field_errors); } catch { /* ignore */ }
    throw new Error(msg);
  }

  let data: any = null;
  try { data = await r.json(); } catch { /* AC may return an empty/odd body on success */ }
  let found = pickProject(data);
  if (!found) found = await findAcProjectByName(T, nm);
  if (!found) throw new Error('Project may have been created, but Active Collab did not return its ID. Refresh and link it by ID.');
  return { id: found.id, name: found.name || nm };
}
