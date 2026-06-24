/* ------------------------------------------------------------------ */
/*  Style Guides module API client. Talks to /api/styleguides.          */
/*  A style guide is a self-contained design-system HTML document.      */
/* ------------------------------------------------------------------ */
import { getApiBase, getToken, hasBackend } from '../api';

// Download the design-system HTML document (auth header required → fetch a blob).
export async function downloadStyleGuide(id) {
  const token = getToken();
  const res = await fetch(`${getApiBase()}/api/styleguides/${id}/export`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    let msg = 'Could not export this style guide';
    try { msg = (await res.json()).error || msg; } catch (e) {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename="?([^"]+)"?/);
  const fname = (m && m[1]) || 'style-guide.html';
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

/* public read-only access (share link, no auth) */
export async function apiGetPublicStyleGuide(id) {
  const res = await fetch(`${getApiBase()}/api/styleguides/public/${id}`);
  if (!res.ok) return null;
  try { return await res.json(); } catch (e) { return null; }
}

/* versions (v1, v2…) — save on versions, switch, delete */
export const apiListSgVersions = (id) => req(`/api/styleguides/${id}/versions`);
export const apiGetSgVersion = (vid) => req(`/api/styleguides/versions/${vid}`);
export const apiCreateSgVersion = (id, content) => req(`/api/styleguides/${id}/versions`, { method: 'POST', body: content !== undefined ? { content } : {} });
export const apiPatchSgVersion = (vid, content) => req(`/api/styleguides/versions/${vid}`, { method: 'PATCH', body: { content } });
export const apiDeleteSgVersion = (vid) => req(`/api/styleguides/versions/${vid}`, { method: 'DELETE' });

/* AI generation from one or more website URLs (+ optional content site). Backend creates
   the guide with a version per site (+ a Mix). Returns { id, name, versions }. */
export const apiGenerateStyleGuide = (payload) => req('/api/styleguides/generate', { method: 'POST', body: payload });

/* AI assistant — edits the open style guide; returns { reply, tokenUpdates, roleFonts } */
export const apiStyleGuideAssistant = (id, message) => req(`/api/styleguides/${id}/assistant`, { method: 'POST', body: { message } });

/* style guides */
export const apiListStyleGuides = () => req('/api/styleguides');
export const apiGetStyleGuide = (id) => req(`/api/styleguides/${id}`);
export const apiGetStyleGuideTheme = (id) => req(`/api/styleguides/${id}/theme`);
export const apiCreateStyleGuide = (payload) => req('/api/styleguides', { method: 'POST', body: payload });
export const apiPatchStyleGuide = (id, patch) => req(`/api/styleguides/${id}`, { method: 'PATCH', body: patch });
export const apiDuplicateStyleGuide = (id) => req(`/api/styleguides/${id}/duplicate`, { method: 'POST' });
export const apiDeleteStyleGuide = (id) => req(`/api/styleguides/${id}`, { method: 'DELETE' });

/* Active Collab (reuses the shared AC client on the backend; PM-only) */
export const apiVerifyStyleGuideActiveCollab = (acProjectId) => req('/api/styleguides/activecollab/verify', { method: 'POST', body: { acProjectId } });
export const apiSetStyleGuideActiveCollab = (id, acProjectId) => req(`/api/styleguides/${id}/activecollab`, { method: 'POST', body: { acProjectId } });

/* sharing (plugs into InvitePanel via its `api` prop) */
export const apiListStyleGuideMembers = (id) => req(`/api/styleguides/${id}/members`);
export const apiAddStyleGuideMember = (id, email, role) => req(`/api/styleguides/${id}/members`, { method: 'POST', body: { email, role } });
export const apiRemoveStyleGuideMember = (id, userId) => req(`/api/styleguides/${id}/members/${userId}`, { method: 'DELETE' });
export const apiRemoveStyleGuideInvite = (id, email) => req(`/api/styleguides/${id}/invites/${encodeURIComponent(email)}`, { method: 'DELETE' });
