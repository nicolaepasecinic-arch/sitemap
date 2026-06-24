import { Router, Request, Response } from 'express';
import { pool } from './db';
import { sendInviteEmail } from './mailer';
import { requireAuth, AuthedRequest, teamRoleOf } from './auth';
import { fetchAcProject, createAcProject, syncAcTask } from './activecollab';

/* Public, read-only access by link — no auth. Anyone with the project id can view. */
export const publicProjectsRouter = Router();
publicProjectsRouter.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT id, name, nodes, items, settings FROM projects WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
  const r = rows[0];
  res.json({ id: r.id, name: r.name, nodes: r.nodes, items: r.items, settings: r.settings, readOnly: true });
});

export const projectsRouter = Router();
projectsRouter.use(requireAuth); // every project route is scoped to the logged-in user

// shape returned to the frontend (camelCase, epoch millis — matches the old localStorage store)
const toApi = (r: any) => ({
  id: r.id,
  name: r.name,
  nodes: r.nodes,
  items: r.items,
  settings: r.settings,
  archived: r.archived,
  completed: r.completed,
  role: r.role || 'owner',                 // owner | editor | viewer (this user's access)
  shared: r.role && r.role !== 'owner',    // true if it's someone else's project shared with you
  acProjectId: r.ac_project_id || '',      // linked Active Collab project
  acProjectName: r.ac_project_name || '',
  createdAt: new Date(r.created_at).getTime(),
  updatedAt: new Date(r.updated_at).getTime(),
});

// This user's Active Collab API token (from their profile; '' falls back to env in the AC client).
export async function userAcToken(userId: string): Promise<string> {
  const { rows } = await pool.query('SELECT profile FROM users WHERE id = $1', [userId]);
  return String(rows[0]?.profile?.acToken || '');
}

// Returns this user's access role for a project: 'owner' | 'pm' | 'production' | 'client'
// | 'editor' | 'viewer' | null. Team co-membership (the project owner and this user
// share a team) grants access with the user's team role.
async function accessRole(projectId: string, userId: string): Promise<string | null> {
  const owned = await pool.query('SELECT 1 FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
  if (owned.rows[0]) return 'owner';
  const member = await pool.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
  if (member.rows[0]?.role) return member.rows[0].role;
  // Team-wide access is only for PMs. Clients/Production must be shared each project
  // explicitly (project_members), so they don't see everything in the team.
  const team = await pool.query(
    `SELECT mine.role
       FROM projects p
       JOIN team_members owner_m ON owner_m.user_id = p.user_id
       JOIN team_members mine ON mine.team_id = owner_m.team_id AND mine.user_id = $2
      WHERE p.id = $1 AND mine.role = 'pm'
      LIMIT 1`,
    [projectId, userId]
  );
  return team.rows[0]?.role || null;
}

// capability helpers (shared role vocabulary across sitemap + markup)
export const canEditRole = (role: string) => ['owner', 'pm', 'production', 'client', 'editor'].includes(role);
export const canSyncAcRole = (role: string) => ['owner', 'pm', 'production', 'editor'].includes(role);

// GET /api/projects — projects this user owns OR is a member of
projectsRouter.get('/', async (req: AuthedRequest, res: Response) => {
  const { rows } = await pool.query(
    `SELECT p.*,
       CASE WHEN p.user_id = $1 THEN 'owner'
            WHEN m.role IS NOT NULL THEN m.role
            ELSE (SELECT mine.role FROM team_members om JOIN team_members mine ON mine.team_id = om.team_id AND mine.user_id = $1 WHERE om.user_id = p.user_id AND mine.role = 'pm' LIMIT 1)
       END AS role
     FROM projects p
     LEFT JOIN project_members m ON m.project_id = p.id AND m.user_id = $1
     WHERE p.user_id = $1 OR m.user_id = $1
        OR EXISTS (SELECT 1 FROM team_members om JOIN team_members mine ON mine.team_id = om.team_id AND mine.user_id = $1 WHERE om.user_id = p.user_id AND mine.role = 'pm')
     ORDER BY p.updated_at DESC`,
    [req.userId]
  );
  res.json(rows.map(toApi));
});

// GET /api/projects/:id
projectsRouter.get('/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  res.json(toApi({ ...rows[0], role }));
});

// POST /api/projects — create (owned by the requester)
projectsRouter.post('/', async (req: AuthedRequest, res: Response) => {
  const { name = 'Untitled project', nodes = [], items = [], settings = {} } = req.body || {};
  const { rows } = await pool.query(
    `INSERT INTO projects (user_id, name, nodes, items, settings)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.userId, name, JSON.stringify(nodes), JSON.stringify(items), JSON.stringify(settings)]
  );
  res.status(201).json(toApi(rows[0]));
});

// PATCH /api/projects/:id — owner or editor
projectsRouter.patch('/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  if (role === 'viewer') return res.status(403).json({ error: 'You have view-only access to this project' });

  const allowed = ['name', 'nodes', 'items', 'settings', 'archived', 'completed'];
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const key of allowed) {
    if (key in (req.body || {})) {
      const jsonCol = ['nodes', 'items', 'settings'].includes(key);
      sets.push(`${key} = $${i}`);
      vals.push(jsonCol ? JSON.stringify(req.body[key]) : req.body[key]);
      i++;
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  sets.push('updated_at = now()');
  vals.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE projects SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  res.json(toApi({ ...rows[0], role }));
});

// POST /api/projects/:id/activecollab  { acProjectId } — verify against Active Collab
// and save id + name. Empty acProjectId clears the link. Owner or editor.
projectsRouter.post('/:id/activecollab', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  if (!canSyncAcRole(role)) return res.status(403).json({ error: 'Your role can’t configure Active Collab.' });
  if ((await teamRoleOf(req.userId!)).role !== 'pm') return res.status(403).json({ error: 'Only PM can assign an Active Collab project.' });
  const raw = String(req.body?.acProjectId || '').trim();
  const createName = String(req.body?.createName || '').trim();
  if (!raw && !createName) {
    const { rows } = await pool.query(
      `UPDATE projects SET ac_project_id = '', ac_project_name = '', updated_at = now() WHERE id = $1 RETURNING *`, [req.params.id]);
    return res.json(toApi({ ...rows[0], role }));
  }
  const acToken = await userAcToken(req.userId!);
  let info;
  try { info = createName ? await createAcProject(acToken, createName) : await fetchAcProject(acToken, raw); }
  catch (e) { return res.status(400).json({ error: (e as Error).message }); }
  const { rows } = await pool.query(
    `UPDATE projects SET ac_project_id = $1, ac_project_name = $2, updated_at = now() WHERE id = $3 RETURNING *`,
    [info.id, info.name, req.params.id]);
  res.json(toApi({ ...rows[0], role }));
});

// POST /api/projects/:id/activecollab/task — create/update an AC task for one page.
// Body: { name, body, taskId? }. Uses the project's linked AC project. Returns { taskId }.
projectsRouter.post('/:id/activecollab/task', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  if (!canSyncAcRole(role)) return res.status(403).json({ error: 'Your role can’t sync with Active Collab.' });
  const { rows } = await pool.query('SELECT ac_project_id FROM projects WHERE id = $1', [req.params.id]);
  const acProjectId = rows[0]?.ac_project_id || '';
  if (!acProjectId) return res.status(400).json({ error: 'No Active Collab project assigned.' });
  const acToken = await userAcToken(req.userId!);
  try {
    const out = await syncAcTask(acToken, acProjectId, { name: req.body?.name, body: req.body?.body, taskId: req.body?.taskId });
    res.json(out);
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

// POST /api/projects/:id/duplicate — anyone with access; copy is owned by the requester
projectsRouter.post('/:id/duplicate', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  const { rows: src } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  const s = src[0];
  const { rows } = await pool.query(
    `INSERT INTO projects (user_id, name, nodes, items, settings)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.userId, `${s.name} copy`, JSON.stringify(s.nodes), JSON.stringify(s.items), JSON.stringify(s.settings)]
  );
  res.status(201).json(toApi(rows[0]));
});

// DELETE /api/projects/:id — owner only. Members just leave (remove their membership).
projectsRouter.delete('/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  if (role === 'owner') {
    await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
  } else {
    await pool.query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [req.params.id, req.userId]);
  }
  res.status(204).end();
});

/* ----------------------------- sharing ----------------------------- */

// GET /api/projects/:id/members — owner + shared users
projectsRouter.get('/:id/members', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email, 'owner' AS role, false AS pending
       FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = $1
     UNION ALL
     SELECT u.id AS user_id, u.name, u.email, m.role, false AS pending
       FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = $1
     UNION ALL
     SELECT NULL AS user_id, i.email AS name, i.email, i.role, true AS pending
       FROM project_invites i WHERE i.project_id = $1`,
    [req.params.id]
  );
  res.json(rows.map((r) => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role, pending: r.pending })));
});

// DELETE /api/projects/:id/invites/:email — cancel a pending invite (owner only)
projectsRouter.delete('/:id/invites/:email', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can manage sharing' });
  await pool.query('DELETE FROM project_invites WHERE project_id = $1 AND email = $2',
    [req.params.id, decodeURIComponent(req.params.email).toLowerCase()]);
  res.status(204).end();
});

// POST /api/projects/:id/members  { email, role } — owner only
projectsRouter.post('/:id/members', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can share this project' });
  const { email, role: memberRole = 'editor' } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const r = ['editor', 'viewer'].includes(memberRole) ? memberRole : 'editor';

  const cleanEmail = String(email).toLowerCase().trim();
  const { rows: users } = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
  const target = users[0];

  if (!target) {
    // No account yet — store a pending invite, claimed automatically when they sign up.
    await pool.query(
      `INSERT INTO project_invites (project_id, email, role) VALUES ($1, $2, $3)
       ON CONFLICT (project_id, email) DO UPDATE SET role = EXCLUDED.role`,
      [req.params.id, cleanEmail, r]
    );
    sendInviteEmail({ req, email: cleanEmail, what: 'a project' });
    return res.status(201).json({ userId: null, name: cleanEmail, email: cleanEmail, role: r, pending: true });
  }

  const { rows: owner } = await pool.query('SELECT user_id FROM projects WHERE id = $1', [req.params.id]);
  if (owner[0].user_id === target.id) return res.status(400).json({ error: 'That user already owns this project' });

  await pool.query(
    `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [req.params.id, target.id, r]
  );
  res.status(201).json({ userId: target.id, name: target.name, email: target.email, role: r, pending: false });
});

// DELETE /api/projects/:id/members/:userId — owner only
projectsRouter.delete('/:id/members/:userId', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can manage sharing' });
  await pool.query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [req.params.id, req.params.userId]);
  res.status(204).end();
});
