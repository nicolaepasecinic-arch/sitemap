import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { pool } from './db';
import { sendInviteEmail } from './mailer';
import { requireAuth, AuthedRequest } from './auth';

/* Where pasted/uploaded moodboard images are stored on disk, served via /moodboard-files. */
export const MOODBOARD_DIR = process.env.MOODBOARD_DIR || path.join(process.cwd(), 'uploads', 'moodboard');
fs.mkdirSync(MOODBOARD_DIR, { recursive: true });

const IMG_EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp', 'image/avif': 'avif',
};

// Decode a base64 image data-URL and store it under MOODBOARD_DIR/<moodboardId>/.
// Returns { url, width?, height?, type, size }.
function saveImage(moodboardId: string, dataUrl: string) {
  const s = String(dataUrl || '');
  const comma = s.indexOf(',');
  const meta = comma >= 0 ? s.slice(0, comma) : '';
  const b64 = comma >= 0 ? s.slice(comma + 1) : s;
  const mime = (meta.match(/data:([^;]+)/) || [])[1] || '';
  const ext = IMG_EXT[mime];
  if (!ext) throw new Error('Only image files are allowed');
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length) throw new Error('Empty image');
  if (buf.length > 25 * 1024 * 1024) throw new Error('Image too large (max 25MB)');
  const dir = path.join(MOODBOARD_DIR, moodboardId);
  fs.mkdirSync(dir, { recursive: true });
  const fname = `${randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(dir, fname), buf);
  return { url: `/moodboard-files/${moodboardId}/${fname}`, type: mime, size: buf.length };
}

/* Public, read-only access by link — no auth. */
export const publicMoodboardsRouter = Router();
publicMoodboardsRouter.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT id, name, items, settings FROM moodboards WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Moodboard not found' });
  const r = rows[0];
  res.json({ id: r.id, name: r.name, items: r.items, settings: r.settings, readOnly: true });
});

export const moodboardsRouter = Router();
moodboardsRouter.use(requireAuth);

const toApi = (r: any) => ({
  id: r.id,
  name: r.name,
  items: r.items,
  settings: r.settings,
  archived: r.archived,
  completed: r.completed,
  role: r.role || 'owner',
  shared: r.role && r.role !== 'owner',
  createdAt: new Date(r.created_at).getTime(),
  updatedAt: new Date(r.updated_at).getTime(),
});

// This user's access role for a moodboard: 'owner' | 'pm' | 'editor' | 'viewer' | null.
async function accessRole(id: string, userId: string): Promise<string | null> {
  const owned = await pool.query('SELECT 1 FROM moodboards WHERE id = $1 AND user_id = $2', [id, userId]);
  if (owned.rows[0]) return 'owner';
  const member = await pool.query('SELECT role FROM moodboard_members WHERE moodboard_id = $1 AND user_id = $2', [id, userId]);
  if (member.rows[0]?.role) return member.rows[0].role;
  const team = await pool.query(
    `SELECT mine.role
       FROM moodboards b
       JOIN team_members owner_m ON owner_m.user_id = b.user_id
       JOIN team_members mine ON mine.team_id = owner_m.team_id AND mine.user_id = $2
      WHERE b.id = $1 AND mine.role = 'pm'
      LIMIT 1`,
    [id, userId]
  );
  return team.rows[0]?.role || null;
}

// GET /api/moodboards — boards this user owns or is a member of (minus ones they've left)
moodboardsRouter.get('/', async (req: AuthedRequest, res: Response) => {
  const { rows } = await pool.query(
    `SELECT b.*,
       CASE WHEN b.user_id = $1 THEN 'owner'
            WHEN m.role IS NOT NULL THEN m.role
            ELSE (SELECT mine.role FROM team_members om JOIN team_members mine ON mine.team_id = om.team_id AND mine.user_id = $1 WHERE om.user_id = b.user_id AND mine.role = 'pm' LIMIT 1)
       END AS role
     FROM moodboards b
     LEFT JOIN moodboard_members m ON m.moodboard_id = b.id AND m.user_id = $1
     WHERE (b.user_id = $1 OR m.user_id = $1
        OR EXISTS (SELECT 1 FROM team_members om JOIN team_members mine ON mine.team_id = om.team_id AND mine.user_id = $1 WHERE om.user_id = b.user_id AND mine.role = 'pm'))
       AND NOT EXISTS (SELECT 1 FROM moodboard_hidden h WHERE h.moodboard_id = b.id AND h.user_id = $1)
     ORDER BY b.updated_at DESC`,
    [req.userId]
  );
  res.json(rows.map(toApi));
});

// GET /api/moodboards/:id
moodboardsRouter.get('/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Moodboard not found' });
  const { rows } = await pool.query('SELECT * FROM moodboards WHERE id = $1', [req.params.id]);
  res.json(toApi({ ...rows[0], role }));
});

// POST /api/moodboards — create (owned by the requester)
moodboardsRouter.post('/', async (req: AuthedRequest, res: Response) => {
  const { name = 'Untitled moodboard', items = [], settings = {} } = req.body || {};
  const { rows } = await pool.query(
    `INSERT INTO moodboards (user_id, name, items, settings) VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.userId, name, JSON.stringify(items), JSON.stringify(settings)]
  );
  res.status(201).json(toApi(rows[0]));
});

// PATCH /api/moodboards/:id — owner or editor
moodboardsRouter.patch('/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Moodboard not found' });
  if (role === 'viewer') return res.status(403).json({ error: 'You have view-only access to this moodboard' });

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
  const { rows } = await pool.query(`UPDATE moodboards SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  res.json(toApi({ ...rows[0], role }));
});

// POST /api/moodboards/:id/images  { dataUrl } — upload a pasted/dropped image. Owner or editor.
moodboardsRouter.post('/:id/images', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Moodboard not found' });
  if (role === 'viewer') return res.status(403).json({ error: 'You have view-only access to this moodboard' });
  try {
    const out = saveImage(req.params.id, req.body?.dataUrl);
    res.status(201).json(out);
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

// POST /api/moodboards/:id/duplicate — anyone with access; copy owned by requester
moodboardsRouter.post('/:id/duplicate', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Moodboard not found' });
  const { rows: src } = await pool.query('SELECT * FROM moodboards WHERE id = $1', [req.params.id]);
  const s = src[0];
  const { rows } = await pool.query(
    `INSERT INTO moodboards (user_id, name, items, settings) VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.userId, `${s.name} copy`, JSON.stringify(s.items), JSON.stringify(s.settings)]
  );
  res.status(201).json(toApi(rows[0]));
});

// DELETE /api/moodboards/:id — owner deletes; a member just leaves (and we hide it).
moodboardsRouter.delete('/:id', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Moodboard not found' });
  if (role === 'owner') {
    await pool.query('DELETE FROM moodboards WHERE id = $1', [req.params.id]);
    try { fs.rmSync(path.join(MOODBOARD_DIR, req.params.id), { recursive: true, force: true }); } catch (e) { /* ignore */ }
  } else {
    await pool.query('DELETE FROM moodboard_members WHERE moodboard_id = $1 AND user_id = $2', [req.params.id, req.userId]);
    await pool.query('INSERT INTO moodboard_hidden (moodboard_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, req.userId]);
  }
  res.status(204).end();
});

/* ----------------------------- sharing ----------------------------- */

// GET /api/moodboards/:id/members
moodboardsRouter.get('/:id/members', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (!role) return res.status(404).json({ error: 'Moodboard not found' });
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email, 'owner' AS role, false AS pending
       FROM moodboards b JOIN users u ON u.id = b.user_id WHERE b.id = $1
     UNION ALL
     SELECT u.id AS user_id, u.name, u.email, m.role, false AS pending
       FROM moodboard_members m JOIN users u ON u.id = m.user_id WHERE m.moodboard_id = $1
     UNION ALL
     SELECT NULL AS user_id, i.email AS name, i.email, i.role, true AS pending
       FROM moodboard_invites i WHERE i.moodboard_id = $1`,
    [req.params.id]
  );
  res.json(rows.map((r) => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role, pending: r.pending })));
});

// DELETE /api/moodboards/:id/invites/:email — cancel a pending invite (owner only)
moodboardsRouter.delete('/:id/invites/:email', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can manage sharing' });
  await pool.query('DELETE FROM moodboard_invites WHERE moodboard_id = $1 AND email = $2',
    [req.params.id, decodeURIComponent(req.params.email).toLowerCase()]);
  res.status(204).end();
});

// POST /api/moodboards/:id/members  { email, role } — owner only
moodboardsRouter.post('/:id/members', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can share this moodboard' });
  const { email, role: memberRole = 'editor' } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const r = ['editor', 'viewer'].includes(memberRole) ? memberRole : 'editor';

  const cleanEmail = String(email).toLowerCase().trim();
  const { rows: users } = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
  const target = users[0];

  if (!target) {
    await pool.query(
      `INSERT INTO moodboard_invites (moodboard_id, email, role) VALUES ($1, $2, $3)
       ON CONFLICT (moodboard_id, email) DO UPDATE SET role = EXCLUDED.role`,
      [req.params.id, cleanEmail, r]
    );
    sendInviteEmail({ req, email: cleanEmail, what: 'a moodboard' });
    return res.status(201).json({ userId: null, name: cleanEmail, email: cleanEmail, role: r, pending: true });
  }

  const { rows: owner } = await pool.query('SELECT user_id FROM moodboards WHERE id = $1', [req.params.id]);
  if (owner[0].user_id === target.id) return res.status(400).json({ error: 'That user already owns this moodboard' });

  await pool.query(
    `INSERT INTO moodboard_members (moodboard_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (moodboard_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [req.params.id, target.id, r]
  );
  // re-sharing un-hides a board the user previously left
  await pool.query('DELETE FROM moodboard_hidden WHERE moodboard_id = $1 AND user_id = $2', [req.params.id, target.id]);
  res.status(201).json({ userId: target.id, name: target.name, email: target.email, role: r, pending: false });
});

// DELETE /api/moodboards/:id/members/:userId — owner only
moodboardsRouter.delete('/:id/members/:userId', async (req: AuthedRequest, res: Response) => {
  const role = await accessRole(req.params.id, req.userId!);
  if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can manage sharing' });
  await pool.query('DELETE FROM moodboard_members WHERE moodboard_id = $1 AND user_id = $2', [req.params.id, req.params.userId]);
  res.status(204).end();
});
