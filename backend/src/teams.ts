import { Router, Response } from 'express';
import { pool } from './db';
import { sendInviteEmail } from './mailer';
import { requireAuth, AuthedRequest } from './auth';

export const TEAM_ROLES = ['pm', 'production', 'client'];

// The single team a user belongs to (owned or invited). A user can be in at most one
// team. Returns { id, name, role, ownerId } or null when they have none yet.
export async function myTeam(userId: string): Promise<{ id: string; name: string; role: string; ownerId: string } | null> {
  const { rows } = await pool.query(
    `SELECT t.id, t.name, t.owner_id, m.role
       FROM team_members m JOIN teams t ON t.id = m.team_id
      WHERE m.user_id = $1
      ORDER BY (t.owner_id = $1) DESC
      LIMIT 1`,
    [userId]
  );
  if (rows[0]) return { id: rows[0].id, name: rows[0].name, role: rows[0].role, ownerId: rows[0].owner_id };
  return null;
}

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

// GET /api/team — the current user's team with members + pending invites.
teamsRouter.get('/', async (req: AuthedRequest, res: Response) => {
  const team = await myTeam(req.userId!);
  if (!team) return res.json({ team: null, members: [] });
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email, m.role, false AS pending
       FROM team_members m JOIN users u ON u.id = m.user_id WHERE m.team_id = $1
     UNION ALL
     SELECT NULL AS user_id, i.email AS name, i.email, i.role, true AS pending
       FROM team_invites i WHERE i.team_id = $1
     ORDER BY pending ASC`,
    [team.id]
  );
  res.json({
    team: { id: team.id, name: team.name, role: team.role, ownerId: team.ownerId },
    members: rows.map((r) => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role, pending: r.pending })),
  });
});

// POST /api/team { name } — create a team (only if the user isn't in one already).
teamsRouter.post('/', async (req: AuthedRequest, res: Response) => {
  const existing = await myTeam(req.userId!);
  if (existing) return res.status(400).json({ error: 'You already belong to a team.' });
  const name = String(req.body?.name || '').trim().slice(0, 80) || 'My Team';
  const t = await pool.query('INSERT INTO teams (owner_id, name) VALUES ($1, $2) RETURNING id, name, owner_id', [req.userId, name]);
  await pool.query('INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)', [t.rows[0].id, req.userId, 'pm']);
  res.status(201).json({ team: { id: t.rows[0].id, name: t.rows[0].name, role: 'pm', ownerId: t.rows[0].owner_id } });
});

// DELETE /api/team/leave — a non-owner member leaves their team (frees them to join/create another).
teamsRouter.delete('/leave', async (req: AuthedRequest, res: Response) => {
  const team = await myTeam(req.userId!);
  if (!team) return res.status(400).json({ error: 'You are not in a team.' });
  if (team.ownerId === req.userId) return res.status(400).json({ error: "You own this team and can't leave it." });
  await pool.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [team.id, req.userId]);
  res.status(204).end();
});

// helper: is this user the PM/owner of their team?
async function requirePm(userId: string): Promise<{ id: string; ownerId: string } | null> {
  const team = await myTeam(userId);
  if (!team || team.role !== 'pm') return null;
  return { id: team.id, ownerId: team.ownerId };
}

// POST /api/team/members { email, role } — invite/add a member (PM only).
teamsRouter.post('/members', async (req: AuthedRequest, res: Response) => {
  const team = await requirePm(req.userId!);
  if (!team) return res.status(403).json({ error: 'Only the team PM can manage members.' });
  const { email, role = 'production' } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const r = TEAM_ROLES.includes(role) ? role : 'production';
  const cleanEmail = String(email).toLowerCase().trim();

  const { rows: users } = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [cleanEmail]);
  const target = users[0];
  if (!target) {
    await pool.query(
      `INSERT INTO team_invites (team_id, email, role) VALUES ($1, $2, $3)
       ON CONFLICT (team_id, email) DO UPDATE SET role = EXCLUDED.role`,
      [team.id, cleanEmail, r]
    );
    sendInviteEmail({ req, email: cleanEmail, what: 'their team' });
    return res.status(201).json({ userId: null, name: cleanEmail, email: cleanEmail, role: r, pending: true });
  }
  if (target.id === team.ownerId) return res.status(400).json({ error: 'That user owns this team.' });
  // a user can only be in one team
  const inTeam = await pool.query('SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1', [target.id]);
  if (inTeam.rows[0] && inTeam.rows[0].team_id !== team.id) {
    return res.status(400).json({ error: 'That user already belongs to another team.' });
  }
  await pool.query(
    `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [team.id, target.id, r]
  );
  res.status(201).json({ userId: target.id, name: target.name, email: target.email, role: r, pending: false });
});

// PATCH /api/team/members/:userId { role } — change a member's role (PM only).
teamsRouter.patch('/members/:userId', async (req: AuthedRequest, res: Response) => {
  const team = await requirePm(req.userId!);
  if (!team) return res.status(403).json({ error: 'Only the team PM can manage members.' });
  if (req.params.userId === team.ownerId) return res.status(400).json({ error: "The owner's role can't be changed." });
  const role = req.body?.role;
  if (!TEAM_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  await pool.query('UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3', [role, team.id, req.params.userId]);
  res.json({ ok: true });
});

// DELETE /api/team/members/:userId — remove a member (PM only; not the owner).
teamsRouter.delete('/members/:userId', async (req: AuthedRequest, res: Response) => {
  const team = await requirePm(req.userId!);
  if (!team) return res.status(403).json({ error: 'Only the team PM can manage members.' });
  if (req.params.userId === team.ownerId) return res.status(400).json({ error: "You can't remove the team owner." });
  await pool.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [team.id, req.params.userId]);
  res.status(204).end();
});

// DELETE /api/team/invites/:email — cancel a pending invite (PM only).
teamsRouter.delete('/invites/:email', async (req: AuthedRequest, res: Response) => {
  const team = await requirePm(req.userId!);
  if (!team) return res.status(403).json({ error: 'Only the team PM can manage members.' });
  await pool.query('DELETE FROM team_invites WHERE team_id = $1 AND email = $2', [team.id, decodeURIComponent(req.params.email).toLowerCase()]);
  res.status(204).end();
});
