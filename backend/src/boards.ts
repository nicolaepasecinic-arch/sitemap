import { Router, Response, NextFunction } from 'express';
import { pool } from './db';
import { requireAuth, AuthedRequest, teamRoleOf } from './auth';
import { userAcToken } from './projects';
import { fetchAcProject } from './activecollab';
import { MARKUP_DIR } from './markup';
import { generateBoardPdf } from './pdf';

/* ------------------------------------------------------------------ */
/*  Boards module — UI tab "Projects". A board is a free-form canvas    */
/*  of items (block text, files, comments, notes). Mirrors the Sitemap  */
/*  projects model (CRUD + status + sharing) but item-only, and the     */
/*  whole module is restricted to PM / Production team roles.           */
/* ------------------------------------------------------------------ */

export const boardsRouter = Router();
boardsRouter.use(requireAuth);

// The Boards module is only for PM and Production. Independent users (no team)
// are treated as PM by teamRoleOf, so they get access too. Clients are blocked.
boardsRouter.use(async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const { role } = await teamRoleOf(req.userId!);
    if (!['pm', 'production'].includes(role)) {
      return res.status(403).json({ error: 'Projects are available to PM and Production only.' });
    }
    next();
  } catch (e) {
    res.status(500).json({ error: 'Could not verify your role.' });
  }
});

// shape returned to the frontend (camelCase, epoch millis)
const toApi = (r: any) => ({
  id: r.id,
  name: r.name,
  items: r.items,
  settings: r.settings,
  archived: r.archived,
  completed: r.completed,
  role: r.role || 'owner',                 // owner | editor | viewer (this user's access)
  shared: r.role && r.role !== 'owner',    // true if it's someone else's board shared with you
  acProjectId: r.ac_project_id || '',      // linked Active Collab project
  acProjectName: r.ac_project_name || '',
  createdAt: new Date(r.created_at).getTime(),
  updatedAt: new Date(r.updated_at).getTime(),
});

// This user's access role for a board: 'owner' | 'pm' | 'production' | 'editor' | 'viewer' | null.
// Team co-membership (board owner and this user share a team) grants PM-wide access.
async function accessRole(boardId: string, userId: string): Promise<string | null> {
  const owned = await pool.query('SELECT 1 FROM boards WHERE id = $1 AND user_id = $2', [boardId, userId]);
  if (owned.rows[0]) return 'owner';
  const member = await pool.query('SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2', [boardId, userId]);
  if (member.rows[0]?.role) return member.rows[0].role;
  const team = await pool.query(
    `SELECT mine.role
       FROM boards b
       JOIN team_members owner_m ON owner_m.user_id = b.user_id
       JOIN team_members mine ON mine.team_id = owner_m.team_id AND mine.user_id = $2
      WHERE b.id = $1 AND mine.role = 'pm'
      LIMIT 1`,
    [boardId, userId]
  );
  return team.rows[0]?.role || null;
}

// GET /api/boards — boards this user owns OR is a member of OR team-wide (PM)
boardsRouter.get('/', async (req: AuthedRequest, res: Response) => {
  const { rows } = await pool.query(
    `SELECT b.*,
       CASE WHEN b.user_id = $1 THEN 'owner'
            WHEN m.role IS NOT NULL THEN m.role
            ELSE (SELECT mine.role FROM team_members om JOIN team_members mine ON mine.team_id = om.team_id AND mine.user_id = $1 WHERE om.user_id = b.user_id AND mine.role = 'pm' LIMIT 1)
       END AS role
     FROM boards b
     LEFT JOIN board_members m ON m.board_id = b.id AND m.user_id = $1
     WHERE b.user_id = $1 OR m.user_id = $1
        OR EXISTS (SELECT 1 FROM team_members om JOIN team_members mine ON mine.team_id = om.team_id AND mine.user_id = $1 WHERE om.user_id = b.user_id AND mine.role = 'pm')
     ORDER BY b.updated_at DESC`,
    [req.userId]
  );
  res.json(rows.map(toApi));
});

// GET /api/boards/:id
boardsRouter.get('/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  const { rows } = await pool.query('SELECT * FROM boards WHERE id = $1', [req.params.id]);
  res.json(toApi({ ...rows[0], role }));
});

// POST /api/boards/activecollab/verify  { acProjectId } — verify an EXISTING Active Collab
// project by id (reuses the shared AC client) and return its id + name. Does not persist.
boardsRouter.post('/activecollab/verify', async (req: AuthedRequest, res: Response) => {
  const raw = String(req.body?.acProjectId || '').trim();
  if (!raw) return res.json({ acProjectId: '', acProjectName: '' });
  const acToken = await userAcToken(req.userId!);
  try {
    const info = await fetchAcProject(acToken, raw);
    res.json({ acProjectId: info.id, acProjectName: info.name });
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

// POST /api/boards — create (owned by the requester). Accepts an optional verified
// Active Collab link (acProjectId + acProjectName) to store at creation time.
boardsRouter.post('/', async (req: AuthedRequest, res: Response) => {
  const { name = 'Untitled project', items = [], settings = {}, acProjectId = '', acProjectName = '' } = req.body || {};
  const { rows } = await pool.query(
    `INSERT INTO boards (user_id, name, items, settings, ac_project_id, ac_project_name)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.userId, name, JSON.stringify(items), JSON.stringify(settings), String(acProjectId || ''), String(acProjectName || '')]
  );
  res.status(201).json(toApi(rows[0]));
});

// PATCH /api/boards/:id — owner or editor
boardsRouter.patch('/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  if (role === 'viewer') return res.status(403).json({ error: 'You have view-only access to this project' });

  const allowed = ['name', 'items', 'settings', 'archived', 'completed'];
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const key of allowed) {
    if (key in (req.body || {})) {
      const jsonCol = ['items', 'settings'].includes(key);
      sets.push(`${key} = $${i}`);
      vals.push(jsonCol ? JSON.stringify(req.body[key]) : req.body[key]);
      i++;
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  sets.push('updated_at = now()');
  vals.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE boards SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  res.json(toApi({ ...rows[0], role }));
});

// GET /api/boards/:id/pdf — export every Page (text element) to a single PDF.
// Pages flow in reading order (top-to-bottom, left-to-right) separated by a rule.
boardsRouter.get('/:id/pdf', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  const { rows } = await pool.query('SELECT name, items FROM boards WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
  const name = rows[0].name || 'Project';
  const items: any[] = Array.isArray(rows[0].items) ? rows[0].items : [];
  try {
    const buf = await generateBoardPdf(items, { markupDir: MARKUP_DIR, title: name });
    const safe = name.replace(/[^a-z0-9_\- ]/gi, '').trim() || 'project';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safe}.pdf"`);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: 'Could not generate PDF: ' + (e as Error).message });
  }
});

// POST /api/boards/:id/activecollab  { acProjectId } — verify against Active Collab and save
// id + name on an existing board. Empty acProjectId clears the link. Owner or editor.
boardsRouter.post('/:id/activecollab', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  if (role === 'viewer') return res.status(403).json({ error: 'You have view-only access to this project' });
  const raw = String(req.body?.acProjectId || '').trim();
  if (!raw) {
    const { rows } = await pool.query(
      `UPDATE boards SET ac_project_id = '', ac_project_name = '', updated_at = now() WHERE id = $1 RETURNING *`, [req.params.id]);
    return res.json(toApi({ ...rows[0], role }));
  }
  const acToken = await userAcToken(req.userId!);
  let info;
  try { info = await fetchAcProject(acToken, raw); }
  catch (e) { return res.status(400).json({ error: (e as Error).message }); }
  const { rows } = await pool.query(
    `UPDATE boards SET ac_project_id = $1, ac_project_name = $2, updated_at = now() WHERE id = $3 RETURNING *`,
    [info.id, info.name, req.params.id]);
  res.json(toApi({ ...rows[0], role }));
});

// POST /api/boards/:id/duplicate — anyone with access; copy is owned by the requester
boardsRouter.post('/:id/duplicate', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  const { rows: src } = await pool.query('SELECT * FROM boards WHERE id = $1', [req.params.id]);
  const s = src[0];
  const { rows } = await pool.query(
    `INSERT INTO boards (user_id, name, items, settings)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.userId, `${s.name} copy`, JSON.stringify(s.items), JSON.stringify(s.settings)]
  );
  res.status(201).json(toApi(rows[0]));
});

// DELETE /api/boards/:id — owner deletes; members just leave
boardsRouter.delete('/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  if (role === 'owner') {
    await pool.query('DELETE FROM boards WHERE id = $1', [req.params.id]);
  } else {
    await pool.query('DELETE FROM board_members WHERE board_id = $1 AND user_id = $2', [req.params.id, req.userId]);
  }
  res.status(204).end();
});

/* ----------------------------- sharing ----------------------------- */

// GET /api/boards/:id/members — owner + shared users + pending invites
boardsRouter.get('/:id/members', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Project not found' });
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email, 'owner' AS role, false AS pending
       FROM boards b JOIN users u ON u.id = b.user_id WHERE b.id = $1
     UNION ALL
     SELECT u.id AS user_id, u.name, u.email, m.role, false AS pending
       FROM board_members m JOIN users u ON u.id = m.user_id WHERE m.board_id = $1
     UNION ALL
     SELECT NULL AS user_id, i.email AS name, i.email, i.role, true AS pending
       FROM board_invites i WHERE i.board_id = $1`,
    [req.params.id]
  );
  res.json(rows.map((r) => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role, pending: r.pending })));
});

// POST /api/boards/:id/members  { email, role } — owner only
boardsRouter.post('/:id/members', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can share this project' });
  const { email, role: memberRole = 'editor' } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const r = ['editor', 'viewer'].includes(memberRole) ? memberRole : 'editor';

  const cleanEmail = String(email).toLowerCase().trim();
  const { rows: users } = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
  const target = users[0];

  if (!target) {
    await pool.query(
      `INSERT INTO board_invites (board_id, email, role) VALUES ($1, $2, $3)
       ON CONFLICT (board_id, email) DO UPDATE SET role = EXCLUDED.role`,
      [req.params.id, cleanEmail, r]
    );
    return res.status(201).json({ userId: null, name: cleanEmail, email: cleanEmail, role: r, pending: true });
  }

  const { rows: owner } = await pool.query('SELECT user_id FROM boards WHERE id = $1', [req.params.id]);
  if (owner[0].user_id === target.id) return res.status(400).json({ error: 'That user already owns this project' });

  await pool.query(
    `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [req.params.id, target.id, r]
  );
  res.status(201).json({ userId: target.id, name: target.name, email: target.email, role: r, pending: false });
});

// DELETE /api/boards/:id/members/:userId — owner only
boardsRouter.delete('/:id/members/:userId', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can manage sharing' });
  await pool.query('DELETE FROM board_members WHERE board_id = $1 AND user_id = $2', [req.params.id, req.params.userId]);
  res.status(204).end();
});

// DELETE /api/boards/:id/invites/:email — cancel a pending invite (owner only)
boardsRouter.delete('/:id/invites/:email', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can manage sharing' });
  await pool.query('DELETE FROM board_invites WHERE board_id = $1 AND email = $2',
    [req.params.id, decodeURIComponent(req.params.email).toLowerCase()]);
  res.status(204).end();
});
