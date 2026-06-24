/* ------------------------------------------------------------------ */
/*  Auth. Uses the backend when configured; otherwise a local mock.     */
/* ------------------------------------------------------------------ */
import { hasBackend, apiLogin, apiRegister, setToken, apiUpdateMe, apiChangePassword, apiDeleteMe, apiForgotPassword, apiResetPassword } from './api';

const KEY = 'sitemap-auth';

export function getAuth() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
}
export function setAuth(user) {
  try { localStorage.setItem(KEY, JSON.stringify(user)); } catch (e) {}
}
export function clearAuth() {
  try { localStorage.removeItem(KEY); } catch (e) {}
  setToken(null);
}
export function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* Sign in. Returns the user object. Throws on failure (backend mode). */
export async function loginUser(email, password) {
  if (hasBackend()) {
    const { token, user } = await apiLogin(email, password);
    setToken(token);
    setAuth(user);
    return user;
  }
  const user = { name: (email || '').split('@')[0] || 'User', email };
  setAuth(user);
  return user;
}

/* Create an account. Returns the user object. Throws on failure. */
export async function registerUser(name, email, password) {
  if (hasBackend()) {
    const { token, user } = await apiRegister(email, name, password);
    setToken(token);
    setAuth(user);
    return user;
  }
  const user = { name: (name && name.trim()) || (email || '').split('@')[0] || 'User', email };
  setAuth(user);
  return user;
}

export function logoutUser() {
  clearAuth();
}

/* Request a password-reset email. Resolves quietly (server never reveals if the email exists). */
export async function forgotPassword(email) {
  if (hasBackend()) return apiForgotPassword(email);
  return { ok: true };
}

/* Set a new password from a reset token, then sign the user in. Returns the user. */
export async function resetPassword(token, password) {
  if (!hasBackend()) throw new Error('Password reset needs the backend.');
  const { token: jwt, user } = await apiResetPassword(token, password);
  setToken(jwt);
  setAuth(user);
  return user;
}

/* Update profile (name/email/profile fields). Returns updated user. */
export async function updateProfile(patch) {
  if (hasBackend()) {
    const { user } = await apiUpdateMe(patch);
    setAuth(user);
    return user;
  }
  const user = { ...(getAuth() || {}), ...patch, profile: { ...((getAuth() || {}).profile || {}), ...(patch.profile || {}) } };
  setAuth(user);
  return user;
}

export async function changePassword(currentPassword, newPassword) {
  if (hasBackend()) return apiChangePassword(currentPassword, newPassword);
  return { ok: true }; // no-op in local mock mode
}

export async function deleteAccount() {
  if (hasBackend()) { try { await apiDeleteMe(); } catch (e) {} }
  clearAuth();
}
