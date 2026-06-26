/* ------------------------------------------------------------------ */
/*  Backend API client.                                                 */
/*  If REACT_APP_API_URL is set, the app talks to the Node backend.     */
/*  If not, the store falls back to localStorage (offline / dev).       */
/* ------------------------------------------------------------------ */

const API = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'qoders-token';

export const hasBackend = () => !!API;
export const getApiBase = () => API;
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} };

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

/* ---- auth ---- */
export const apiRegister = (email, name, password) => request('/api/auth/register', { method: 'POST', body: { email, name, password } });
export const apiLogin = (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } });
export const apiForgotPassword = (email) => request('/api/auth/forgot', { method: 'POST', body: { email } });
export const apiResetPassword = (token, password) => request('/api/auth/reset', { method: 'POST', body: { token, password } });
export const apiMe = () => request('/api/auth/me');
export const apiUpdateMe = (patch) => request('/api/auth/me', { method: 'PATCH', body: patch });
export const apiChangePassword = (currentPassword, newPassword) => request('/api/auth/me/password', { method: 'POST', body: { currentPassword, newPassword } });
export const apiDeleteMe = () => request('/api/auth/me', { method: 'DELETE' });

/* ---- public (read-only, no auth) ---- */
export const apiPublicProject = (id) => request(`/api/public/projects/${id}`);

/* ---- import a remote sitemap.xml (backend fetches it to avoid CORS) ---- */
export const apiImportSitemap = (url) => request(`/api/import/sitemap?url=${encodeURIComponent(url)}`);
export const apiCrawlSite = (url) => request(`/api/import/crawl?url=${encodeURIComponent(url)}`);

/* ---- AI: generate the content map (sections) for one page ---- */
export const apiGenerateContentMap = (prompt, pageName) =>
  request('/api/ai/contentmap', { method: 'POST', body: { prompt, pageName } });

/* ---- AI: generate a whole sitemap (new project: name + page tree) ---- */
export const apiGenerateSitemap = (prompt) =>
  request('/api/ai/sitemap', { method: 'POST', body: { prompt } });

/* ---- AI: conversational assistant that edits the current project ---- */
export const apiAssistant = (message, project) =>
  request('/api/ai/assistant', { method: 'POST', body: { message, project } });

/* ---- MCP (Connect to AI): per-account token for the external MCP endpoint ---- */
export const apiGetMcpToken = () => request('/api/auth/me/mcp');
export const apiRegenerateMcpToken = () => request('/api/auth/me/mcp/regenerate', { method: 'POST' });

/* ---- projects ---- */
export const apiListProjects = () => request('/api/projects');
export const apiGetProject = (id) => request(`/api/projects/${id}`);
export const apiCreateProject = (payload) => request('/api/projects', { method: 'POST', body: payload });
export const apiPatchProject = (id, patch) => request(`/api/projects/${id}`, { method: 'PATCH', body: patch });
export const apiDuplicateProject = (id) => request(`/api/projects/${id}/duplicate`, { method: 'POST' });
export const apiSetProjectActiveCollab = (id, acProjectId) => request(`/api/projects/${id}/activecollab`, { method: 'POST', body: { acProjectId } });
export const apiCreateProjectActiveCollab = (id, createName) => request(`/api/projects/${id}/activecollab`, { method: 'POST', body: { createName } });
export const apiSyncProjectTask = (id, payload) => request(`/api/projects/${id}/activecollab/task`, { method: 'POST', body: payload });
export const apiDeleteProject = (id) => request(`/api/projects/${id}`, { method: 'DELETE' });

/* ---- sharing ---- */
/* teams */
export const apiGetTeam = () => request('/api/team');
export const apiCreateTeam = (name) => request('/api/team', { method: 'POST', body: { name } });
export const apiLeaveTeam = () => request('/api/team/leave', { method: 'DELETE' });
export const apiAddTeamMember = (email, role) => request('/api/team/members', { method: 'POST', body: { email, role } });
export const apiUpdateTeamMember = (userId, role) => request(`/api/team/members/${userId}`, { method: 'PATCH', body: { role } });
export const apiRemoveTeamMember = (userId) => request(`/api/team/members/${userId}`, { method: 'DELETE' });
export const apiRemoveTeamInvite = (email) => request(`/api/team/invites/${encodeURIComponent(email)}`, { method: 'DELETE' });

export const apiListMembers = (id) => request(`/api/projects/${id}/members`);
export const apiAddMember = (id, email, role) => request(`/api/projects/${id}/members`, { method: 'POST', body: { email, role } });
export const apiRemoveMember = (id, userId) => request(`/api/projects/${id}/members/${userId}`, { method: 'DELETE' });
export const apiRemoveInvite = (id, email) => request(`/api/projects/${id}/invites/${encodeURIComponent(email)}`, { method: 'DELETE' });

/* ---- moodboards ---- */
export const apiListMoodboards = () => request('/api/moodboards');
export const apiGetMoodboard = (id) => request(`/api/moodboards/${id}`);
export const apiCreateMoodboard = (payload) => request('/api/moodboards', { method: 'POST', body: payload });
export const apiPatchMoodboard = (id, patch) => request(`/api/moodboards/${id}`, { method: 'PATCH', body: patch });
export const apiDuplicateMoodboard = (id) => request(`/api/moodboards/${id}/duplicate`, { method: 'POST' });
export const apiDeleteMoodboard = (id) => request(`/api/moodboards/${id}`, { method: 'DELETE' });
export const apiUploadMoodboardImage = (id, dataUrl) => request(`/api/moodboards/${id}/images`, { method: 'POST', body: { dataUrl } });
/* moodboard sharing (same shape InvitePanel expects) */
export const apiListMoodboardMembers = (id) => request(`/api/moodboards/${id}/members`);
export const apiAddMoodboardMember = (id, email, role) => request(`/api/moodboards/${id}/members`, { method: 'POST', body: { email, role } });
export const apiRemoveMoodboardMember = (id, userId) => request(`/api/moodboards/${id}/members/${userId}`, { method: 'DELETE' });
export const apiRemoveMoodboardInvite = (id, email) => request(`/api/moodboards/${id}/invites/${encodeURIComponent(email)}`, { method: 'DELETE' });
