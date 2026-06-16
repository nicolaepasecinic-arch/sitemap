/* ------------------------------------------------------------------ */
/*  Minimal local auth (no backend) — stores the signed-in user        */
/* ------------------------------------------------------------------ */
const KEY = 'sitemap-auth';

export function getAuth() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
}
export function setAuth(user) {
  try { localStorage.setItem(KEY, JSON.stringify(user)); } catch (e) {}
}
export function clearAuth() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
export function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
