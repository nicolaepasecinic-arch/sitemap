/* ------------------------------------------------------------------ */
/*  Markup module API client. Talks to /api/markup on the backend.      */
/*  Markup needs the backend (ZIP unzip + static serving); no offline.  */
/* ------------------------------------------------------------------ */
import { getApiBase, getToken, hasBackend } from '../api';

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
// Relative URLs so the iframe is SAME-ORIGIN (CRA proxy in dev / nginx in prod) —
// lets us read scroll + capture clicks inside the iframe.
export const markupFileUrl = (id, p) => `/markup-files/${id}/${String(p || '').replace(/^\/+/, '')}`;
export const markupProxyUrl = (versionId) => `/api/markup/proxy?version=${encodeURIComponent(versionId)}`;

export const listMarkupProjects = () => req('/api/markup/projects');
export const getMarkupProject = (id) => req(`/api/markup/projects/${id}`);
export const createMarkupFromUrl = (name, url) => req('/api/markup/projects', { method: 'POST', body: { name, url } });
export const uploadMarkupZip = (name, zipBase64) => req('/api/markup/projects/upload', { method: 'POST', body: { name, zipBase64 } });
export const createBlankDesign = (name) => req('/api/markup/projects/blank', { method: 'POST', body: { name } });
export const deleteMarkupProject = (id) => req(`/api/markup/projects/${id}`, { method: 'DELETE' });
export const patchMarkupProject = (id, patch) => req(`/api/markup/projects/${id}`, { method: 'PATCH', body: patch });
/* Design style library (project-wide design system): { colors:[], text:[], link:[] } */
export const saveMarkupStyles = (id, styles) => req(`/api/markup/projects/${id}`, { method: 'PATCH', body: { styles } });
export const duplicateMarkupProject = (id) => req(`/api/markup/projects/${id}/duplicate`, { method: 'POST' });
export const setMarkupActiveCollab = (id, acProjectId) => req(`/api/markup/projects/${id}/activecollab`, { method: 'POST', body: { acProjectId } });
export const createMarkupActiveCollab = (id, createName) => req(`/api/markup/projects/${id}/activecollab`, { method: 'POST', body: { createName } });
/* AC sync: page→task, comment→subtask */
export const syncMarkupPage = (id, payload) => req(`/api/markup/projects/${id}/ac/page`, { method: 'POST', body: payload });
export const syncMarkupComment = (cid, payload) => req(`/api/markup/comments/${cid}/ac`, { method: 'POST', body: payload });

/* sharing — shape matches the sitemap member API so InvitePanel can be reused */
export const markupListMembers = (id) => req(`/api/markup/projects/${id}/members`);
export const markupAddMember = (id, email, role) => req(`/api/markup/projects/${id}/members`, { method: 'POST', body: { email, role } });
export const markupRemoveMember = (id, userId) => req(`/api/markup/projects/${id}/members/${userId}`, { method: 'DELETE' });
export const markupRemoveInvite = (id, email) => req(`/api/markup/projects/${id}/invites/${encodeURIComponent(email)}`, { method: 'DELETE' });

/* versions */
export const listMarkupVersions = (id) => req(`/api/markup/projects/${id}/versions`);
export const addMarkupVersionUrl = (id, url, mode = 'new') => req(`/api/markup/projects/${id}/versions`, { method: 'POST', body: { url, mode } });
export const addMarkupVersionZip = (id, zipBase64, mode = 'new') => req(`/api/markup/projects/${id}/versions/upload`, { method: 'POST', body: { zipBase64, mode } });
export const regenMarkupScreenshot = (versionId) => req(`/api/markup/versions/${versionId}/screenshot`, { method: 'POST' });
export const saveMarkupPage = (versionId, path, html) => req(`/api/markup/versions/${versionId}/page`, { method: 'POST', body: { path, html } });
export const createMarkupPage = (versionId, page) => req(`/api/markup/versions/${versionId}/pages`, { method: 'POST', body: page });
export const updateMarkupPage = (versionId, body) => req(`/api/markup/versions/${versionId}/page-meta`, { method: 'PATCH', body });
export const duplicateMarkupPageFile = (versionId, path) => req(`/api/markup/versions/${versionId}/page-duplicate`, { method: 'POST', body: { path } });
export const deleteMarkupPage = (versionId, path) => req(`/api/markup/versions/${versionId}/page-delete`, { method: 'POST', body: { path } });

/* comments */
export const listMarkupProjectComments = (id) => req(`/api/markup/projects/${id}/comments`);
export const listPublicMarkupProjectComments = (id) => req(`/api/markup/public/projects/${id}/comments`);
export const listMarkupComments = (versionId) => req(`/api/markup/versions/${versionId}/comments`);
export const addMarkupComment = (versionId, c) => req(`/api/markup/versions/${versionId}/comments`, { method: 'POST', body: c });
export const updateMarkupComment = (cid, patch) => req(`/api/markup/comments/${cid}`, { method: 'PATCH', body: patch });
export const deleteMarkupComment = (cid) => req(`/api/markup/comments/${cid}`, { method: 'DELETE' });
export const addMarkupReply = (cid, body) => req(`/api/markup/comments/${cid}/replies`, { method: 'POST', body });
export const addPublicMarkupReply = (cid, body) => req(`/api/markup/public/comments/${cid}/replies`, { method: 'POST', body });
export const deleteMarkupReply = (cid, rid) => req(`/api/markup/comments/${cid}/replies/${rid}`, { method: 'DELETE' });
export const listMarkupPeople = (id) => req(`/api/markup/projects/${id}/people`);

/* public share-link access (no account needed) */
export const getPublicMarkupProject = (id) => req(`/api/markup/public/projects/${id}`);
export const listPublicMarkupVersions = (id) => req(`/api/markup/public/projects/${id}/versions`);
export const listPublicMarkupComments = (vid) => req(`/api/markup/public/versions/${vid}/comments`);
export const addPublicMarkupComment = (vid, c) => req(`/api/markup/public/versions/${vid}/comments`, { method: 'POST', body: c });

/* comment file attachments — upload a base64 data-URL, get back { id, name, url, size, type } */
export const uploadMarkupAttachment = (name, dataUrl) => req('/api/markup/attachments', { method: 'POST', body: { name, dataUrl } });
export const uploadPublicMarkupAttachment = (name, dataUrl) => req('/api/markup/public/attachments', { method: 'POST', body: { name, dataUrl } });
