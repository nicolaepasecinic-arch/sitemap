/* ------------------------------------------------------------------ */
/*  Boards module API client. Talks to /api/boards on the backend.      */
/*  UI tab: "Projects" (PM / Production only).                          */
/* ------------------------------------------------------------------ */
import { getApiBase, getToken, hasBackend } from '../api';

// Download all Pages of a board as a single PDF (auth header required, so we fetch a blob).
export async function downloadBoardPdf(id) {
  const token = getToken();
  const res = await fetch(`${getApiBase()}/api/boards/${id}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    let msg = 'Could not generate the PDF';
    try { msg = (await res.json()).error || msg; } catch (e) {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename="?([^"]+)"?/);
  const fname = (m && m[1]) || 'project.pdf';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fname;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function req(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${getApiBase()}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

export { hasBackend };

/* boards */
export const apiListBoards = () => req('/api/boards');
export const apiGetBoard = (id) => req(`/api/boards/${id}`);
export const apiCreateBoard = (payload) => req('/api/boards', { method: 'POST', body: payload });
export const apiPatchBoard = (id, patch) => req(`/api/boards/${id}`, { method: 'PATCH', body: patch });
export const apiDuplicateBoard = (id) => req(`/api/boards/${id}/duplicate`, { method: 'POST' });
export const apiDeleteBoard = (id) => req(`/api/boards/${id}`, { method: 'DELETE' });

/* Active Collab (reuses the shared AC client on the backend) */
// Verify an existing AC project by id (no board yet) — returns { acProjectId, acProjectName }.
export const apiVerifyBoardActiveCollab = (acProjectId) => req('/api/boards/activecollab/verify', { method: 'POST', body: { acProjectId } });
// Verify + persist the AC link on an existing board ('' clears it).
export const apiSetBoardActiveCollab = (id, acProjectId) => req(`/api/boards/${id}/activecollab`, { method: 'POST', body: { acProjectId } });

/* sharing (plugs into InvitePanel via its `api` prop) */
export const apiListBoardMembers = (id) => req(`/api/boards/${id}/members`);
export const apiAddBoardMember = (id, email, role) => req(`/api/boards/${id}/members`, { method: 'POST', body: { email, role } });
export const apiRemoveBoardMember = (id, userId) => req(`/api/boards/${id}/members/${userId}`, { method: 'DELETE' });
export const apiRemoveBoardInvite = (id, email) => req(`/api/boards/${id}/invites/${encodeURIComponent(email)}`, { method: 'DELETE' });
