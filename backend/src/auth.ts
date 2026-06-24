import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, claimInvites } from './db';
import { sendMail, resetEmail } from './mailer';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL = '30d';

export interface AuthedRequest extends Request {
  userId?: string;
}

function sign(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

const publicUser = (u: any) => ({ id: u.id, email: u.email, name: u.name, profile: u.profile || {} });

// the user's team role (prefer the team they own); drives UI gating
export async function teamRoleOf(userId: string): Promise<{ role: string; isOwner: boolean }> {
  const { rows } = await pool.query(
    `SELECT m.role, (t.owner_id = $1) AS is_owner
       FROM team_members m JOIN teams t ON t.id = m.team_id
      WHERE m.user_id = $1
      ORDER BY is_owner DESC LIMIT 1`,
    [userId]
  );
  return rows[0] ? { role: rows[0].role, isOwner: rows[0].is_owner } : { role: 'pm', isOwner: true };
}
async function userPayload(u: any) {
  const t = await teamRoleOf(u.id);
  return { ...publicUser(u), teamRole: t.role, isTeamOwner: t.isOwner };
}

export const authRouter = Router();

// POST /api/auth/register  { email, name, password }
authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, name, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const displayName = (name && String(name).trim()) || String(email).split('@')[0];
    const { rows } = await pool.query(
      'INSERT INTO users (email, name, password) VALUES ($1, $2, $3) RETURNING *',
      [String(email).toLowerCase().trim(), displayName, hash]
    );
    const user = rows[0];
    await claimInvites(user.id, user.email); // grant any projects/teams shared to this email before signup
    // No auto team: if they weren't invited into one, they can create their own from the Team page.
    res.json({ token: sign(user.id), user: await userPayload(user) });
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    res.status(500).json({ error: 'Could not create account' });
  }
});

// POST /api/auth/login  { email, password }
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase().trim()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  await claimInvites(user.id, user.email); // catch any invites added meanwhile
  res.json({ token: sign(user.id), user: await userPayload(user) });
});

// POST /api/auth/forgot { email } — email a reset link. Always responds ok (no email enumeration).
authRouter.post('/forgot', async (req: Request, res: Response) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (email) {
    const { rows } = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);
    const u = rows[0];
    if (u) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.query('UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3', [token, expires, u.id]);
      const base = (process.env.APP_URL || req.headers.origin || '').replace(/\/+$/, '');
      const link = `${base}/#/reset?token=${token}`;
      const { subject, html, text } = resetEmail(u.name, link);
      try { await sendMail(email, subject, html, text); } catch (e) { /* logged in mailer */ }
    }
  }
  res.json({ ok: true });
});

// POST /api/auth/reset { token, password } — set a new password and sign the user in.
authRouter.post('/reset', async (req: Request, res: Response) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const { rows } = await pool.query('SELECT * FROM users WHERE reset_token = $1 AND reset_expires > now()', [String(token)]);
  const u = rows[0];
  if (!u) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  const hash = await bcrypt.hash(String(password), 10);
  await pool.query('UPDATE users SET password = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2', [hash, u.id]);
  res.json({ token: sign(u.id), user: await userPayload(u) });
});

// GET /api/auth/me — returns the current user (requires auth)
authRouter.get('/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: await userPayload(rows[0]) });
});

// PATCH /api/auth/me — update name / email / profile (company, country, formats…)
authRouter.patch('/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { name, email, profile } = req.body || {};
  const { rows: cur } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!cur[0]) return res.status(404).json({ error: 'User not found' });
  const newName = name !== undefined ? String(name).trim() || cur[0].name : cur[0].name;
  const newEmail = email !== undefined ? String(email).toLowerCase().trim() : cur[0].email;
  const newProfile = profile !== undefined ? { ...cur[0].profile, ...profile } : cur[0].profile;
  // Clients can't set the Active Collab token — keep whatever was there.
  if (profile !== undefined && 'acToken' in (profile || {})) {
    const t = await teamRoleOf(req.userId!);
    if (t.role === 'client') newProfile.acToken = cur[0].profile?.acToken || '';
  }
  try {
    const { rows } = await pool.query(
      'UPDATE users SET name = $1, email = $2, profile = $3 WHERE id = $4 RETURNING *',
      [newName, newEmail, JSON.stringify(newProfile), req.userId]
    );
    res.json({ user: await userPayload(rows[0]) });
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'That email is already in use' });
    res.status(500).json({ error: 'Could not update profile' });
  }
});

// POST /api/auth/me/password — change password (verify current first)
authRouter.post('/me/password', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required' });
  if (String(newPassword).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.userId]);
  res.json({ ok: true });
});

// DELETE /api/auth/me — permanently delete the account (cascades projects)
authRouter.delete('/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);
  res.status(204).end();
});

const newMcpToken = () => 'qmcp_' + crypto.randomBytes(24).toString('hex');

// GET /api/auth/me/mcp — return this user's MCP token (creating it on first use)
authRouter.get('/me/mcp', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { rows } = await pool.query('SELECT mcp_token FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  let token = rows[0].mcp_token;
  if (!token) {
    token = newMcpToken();
    await pool.query('UPDATE users SET mcp_token = $1 WHERE id = $2', [token, req.userId]);
  }
  res.json({ token });
});

// POST /api/auth/me/mcp/regenerate — issue a fresh token (invalidates the old one)
authRouter.post('/me/mcp/regenerate', requireAuth, async (req: AuthedRequest, res: Response) => {
  const token = newMcpToken();
  await pool.query('UPDATE users SET mcp_token = $1 WHERE id = $2', [token, req.userId]);
  res.json({ token });
});

// Auth middleware — expects "Authorization: Bearer <token>"
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
