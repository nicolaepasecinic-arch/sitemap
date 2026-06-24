import { Pool } from 'pg';

// Single shared connection pool. Connection string comes from Coolify's Postgres.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Coolify-managed Postgres on the same network usually doesn't need SSL.
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

// Create tables on boot (idempotent). Keeps deploys simple — no separate migration step.
export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email       TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      password    TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      nodes       JSONB NOT NULL DEFAULT '[]'::jsonb,
      items       JSONB NOT NULL DEFAULT '[]'::jsonb,
      settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
      archived    BOOLEAN NOT NULL DEFAULT false,
      completed   BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- extra profile fields (company, country, formats, notifications…) kept as JSON
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb;

    -- per-account token for the MCP server (Connect to AI). Lets an external AI client
    -- act on this user's projects. NULL until the user opens "Connect to AI".
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mcp_token TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS users_mcp_token_idx ON users(mcp_token) WHERE mcp_token IS NOT NULL;

    -- password reset (forgot password via email)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS users_reset_token_idx ON users(reset_token) WHERE reset_token IS NOT NULL;

    CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);

    -- People a project is shared with (besides the owner in projects.user_id).
    CREATE TABLE IF NOT EXISTS project_members (
      project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role        TEXT NOT NULL DEFAULT 'editor',  -- 'editor' | 'viewer'
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (project_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON project_members(user_id);

    -- Pending invites by email, for people who don't have an account yet.
    -- Claimed automatically when that email registers.
    CREATE TABLE IF NOT EXISTS project_invites (
      project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      email       TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'editor',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (project_id, email)
    );

    CREATE INDEX IF NOT EXISTS project_invites_email_idx ON project_invites(email);

    -- ====================== Teams ======================
    -- One team per account (the owner). Members are invited with a role:
    -- 'pm' (full incl. team admin), 'production' (all but team admin), 'client'
    -- (all but AC sync / AC token / team admin). The owner is a 'pm' member.
    CREATE TABLE IF NOT EXISTS teams (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL DEFAULT 'My Team',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS teams_owner_idx ON teams(owner_id);

    CREATE TABLE IF NOT EXISTS team_members (
      team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role        TEXT NOT NULL DEFAULT 'production',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (team_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS team_members_user_idx ON team_members(user_id);

    CREATE TABLE IF NOT EXISTS team_invites (
      team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      email       TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'production',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (team_id, email)
    );
    CREATE INDEX IF NOT EXISTS team_invites_email_idx ON team_invites(email);
    -- No auto teams: users create a team from the Team page, or join one via invite.

    -- ====================== Markup module (separate from Sitemap) ======================
    -- A markup project is a website (from a URL, or an uploaded static ZIP) that people
    -- annotate with comment pins. Kept fully separate from the sitemap 'projects' table.
    CREATE TABLE IF NOT EXISTS markup_projects (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL,                 -- 'url' | 'zip'
      url         TEXT NOT NULL DEFAULT '',      -- live site URL (type='url')
      pages       JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{path,title}] for zip; [] for url
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS markup_projects_user_id_idx ON markup_projects(user_id);

    -- Comment pins on a markup project. 'page' identifies which page the pin is on
    -- (a zip page path, or '' for a single URL). x/y are 0..1 fractions of the viewport.
    CREATE TABLE IF NOT EXISTS markup_comments (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id  UUID NOT NULL REFERENCES markup_projects(id) ON DELETE CASCADE,
      user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      page        TEXT NOT NULL DEFAULT '',
      x           DOUBLE PRECISION NOT NULL DEFAULT 0,
      y           DOUBLE PRECISION NOT NULL DEFAULT 0,
      text        TEXT NOT NULL DEFAULT '',
      author      TEXT NOT NULL DEFAULT '',
      resolved    BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS markup_comments_project_idx ON markup_comments(project_id);

    -- Markup project status + sharing (mirrors the Sitemap projects model).
    ALTER TABLE markup_projects ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE markup_projects ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false;

    CREATE TABLE IF NOT EXISTS markup_members (
      project_id  UUID NOT NULL REFERENCES markup_projects(id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role        TEXT NOT NULL DEFAULT 'editor',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (project_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS markup_members_user_idx ON markup_members(user_id);

    CREATE TABLE IF NOT EXISTS markup_invites (
      project_id  UUID NOT NULL REFERENCES markup_projects(id) ON DELETE CASCADE,
      email       TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'editor',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (project_id, email)
    );
    CREATE INDEX IF NOT EXISTS markup_invites_email_idx ON markup_invites(email);

    -- Versions: a markup project can have several versions (each a URL or unzipped ZIP),
    -- each with its own comments. Unzipped files live at MARKUP_DIR/<version id>/.
    CREATE TABLE IF NOT EXISTS markup_versions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id  UUID NOT NULL REFERENCES markup_projects(id) ON DELETE CASCADE,
      label       TEXT NOT NULL DEFAULT 'v1',
      type        TEXT NOT NULL,                 -- 'url' | 'zip'
      url         TEXT NOT NULL DEFAULT '',
      pages       JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS markup_versions_project_idx ON markup_versions(project_id);

    ALTER TABLE markup_comments ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES markup_versions(id) ON DELETE CASCADE;
    ALTER TABLE markup_versions ADD COLUMN IF NOT EXISTS screenshot TEXT NOT NULL DEFAULT '';
    ALTER TABLE markup_comments ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'none';
    ALTER TABLE markup_comments ADD COLUMN IF NOT EXISTS drawing JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE markup_comments ADD COLUMN IF NOT EXISTS replies JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE markup_comments ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE markup_comments ADD COLUMN IF NOT EXISTS device TEXT NOT NULL DEFAULT 'desktop';
    ALTER TABLE markup_comments ADD COLUMN IF NOT EXISTS mentions JSONB NOT NULL DEFAULT '[]'::jsonb;

    -- Linked Active Collab project (id + cached name) for both product types.
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS ac_project_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS ac_project_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE markup_projects ADD COLUMN IF NOT EXISTS ac_project_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE markup_projects ADD COLUMN IF NOT EXISTS ac_project_name TEXT NOT NULL DEFAULT '';
    -- pageKey -> { taskId, taskNumber } for markup page→AC-task sync
    ALTER TABLE markup_projects ADD COLUMN IF NOT EXISTS ac_tasks JSONB NOT NULL DEFAULT '{}'::jsonb;
    -- Design module style library (project-wide design system): { colors:[], text:[], link:[] }.
    -- Each style is applied to page elements via a generated CSS class (dz-text-<id>, etc).
    ALTER TABLE markup_projects ADD COLUMN IF NOT EXISTS styles JSONB NOT NULL DEFAULT '{}'::jsonb;
    -- each comment can be an AC subtask under its page's task
    ALTER TABLE markup_comments ADD COLUMN IF NOT EXISTS ac_subtask_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE markup_comments ADD COLUMN IF NOT EXISTS ac_subtask_number TEXT NOT NULL DEFAULT '';
    -- Where the pin sits in the page: { selector, mkId, tag, id, classes, text, html, parents,
    -- sectionId, sectionHeading, computedStyles } captured at comment time, so an AI reading
    -- comments knows exactly which element/area to fix.
    ALTER TABLE markup_comments ADD COLUMN IF NOT EXISTS anchor JSONB NOT NULL DEFAULT '{}'::jsonb;
    -- Structured intent so short comments are unambiguous: change category, how far it applies,
    -- an explicit target value, and a cropped screenshot of the region.
    ALTER TABLE markup_comments ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'other';
    ALTER TABLE markup_comments ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'element';
    ALTER TABLE markup_comments ADD COLUMN IF NOT EXISTS desired_value TEXT NOT NULL DEFAULT '';
    ALTER TABLE markup_comments ADD COLUMN IF NOT EXISTS screenshot TEXT NOT NULL DEFAULT '';

    -- ====================== Boards module (UI tab: "Projects", PM/Production only) ======================
    -- A board is a free-form canvas of items (block text, files, comments, notes).
    -- Mirrors the Sitemap 'projects' model (CRUD + status + sharing) but item-only:
    -- there is no page tree, everything lives in the 'items' JSONB array.
    CREATE TABLE IF NOT EXISTS boards (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      items       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- canvas objects: {type:'text'|'file'|'comment'|'note', ...}
      settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
      archived    BOOLEAN NOT NULL DEFAULT false,
      completed   BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS boards_user_id_idx ON boards(user_id);

    -- Linked Active Collab project (id + cached name), same as Sitemap/Markup.
    ALTER TABLE boards ADD COLUMN IF NOT EXISTS ac_project_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE boards ADD COLUMN IF NOT EXISTS ac_project_name TEXT NOT NULL DEFAULT '';

    -- People a board is shared with (besides the owner in boards.user_id).
    CREATE TABLE IF NOT EXISTS board_members (
      board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role        TEXT NOT NULL DEFAULT 'editor',  -- 'editor' | 'viewer'
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (board_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS board_members_user_idx ON board_members(user_id);

    -- Pending board invites by email (claimed when that email registers).
    CREATE TABLE IF NOT EXISTS board_invites (
      board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      email       TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'editor',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (board_id, email)
    );
    CREATE INDEX IF NOT EXISTS board_invites_email_idx ON board_invites(email);

    -- ====================== Style Guides module (UI tab: "Style Guides") ======================
    -- A style guide is a self-contained design-system document (a full HTML doc with a token
    -- layer: colours, typography, spacing, brand, forms, components). 'content' holds the HTML
    -- document; 'settings' holds editor/meta state. Mirrors the Sitemap 'projects' model
    -- (CRUD + status + sharing + Active Collab) and is available to all team roles.
    CREATE TABLE IF NOT EXISTS style_guides (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      content     TEXT NOT NULL DEFAULT '',           -- the design-system HTML document
      settings    JSONB NOT NULL DEFAULT '{}'::jsonb, -- editor/meta state (theme, tokens cache…)
      archived    BOOLEAN NOT NULL DEFAULT false,
      completed   BOOLEAN NOT NULL DEFAULT false,
      ac_project_id   TEXT NOT NULL DEFAULT '',        -- linked Active Collab project
      ac_project_name TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS style_guides_user_id_idx ON style_guides(user_id);

    -- People a style guide is shared with (besides the owner in style_guides.user_id).
    CREATE TABLE IF NOT EXISTS style_guide_members (
      style_guide_id UUID NOT NULL REFERENCES style_guides(id) ON DELETE CASCADE,
      user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role           TEXT NOT NULL DEFAULT 'editor',   -- 'editor' | 'viewer'
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (style_guide_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS style_guide_members_user_idx ON style_guide_members(user_id);

    -- Pending style-guide invites by email (claimed when that email registers).
    CREATE TABLE IF NOT EXISTS style_guide_invites (
      style_guide_id UUID NOT NULL REFERENCES style_guides(id) ON DELETE CASCADE,
      email          TEXT NOT NULL,
      role           TEXT NOT NULL DEFAULT 'editor',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (style_guide_id, email)
    );
    CREATE INDEX IF NOT EXISTS style_guide_invites_email_idx ON style_guide_invites(email);

    -- Versions of a style guide (v1, v2…). Each holds its own full HTML document.
    CREATE TABLE IF NOT EXISTS style_guide_versions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      style_guide_id  UUID NOT NULL REFERENCES style_guides(id) ON DELETE CASCADE,
      label           TEXT NOT NULL DEFAULT 'v1',
      content         TEXT NOT NULL DEFAULT '',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS style_guide_versions_sg_idx ON style_guide_versions(style_guide_id);

    -- Guides a (non-owner) user has dismissed from their list ("Leave"). Works regardless of
    -- whether access came from an explicit share or team-wide PM access.
    CREATE TABLE IF NOT EXISTS style_guide_hidden (
      style_guide_id UUID NOT NULL REFERENCES style_guides(id) ON DELETE CASCADE,
      user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (style_guide_id, user_id)
    );

    -- Backfill: every existing guide gets a 'v1' from its current content.
    INSERT INTO style_guide_versions (style_guide_id, label, content, created_at)
      SELECT s.id, 'v1', s.content, s.created_at FROM style_guides s
       WHERE NOT EXISTS (SELECT 1 FROM style_guide_versions v WHERE v.style_guide_id = s.id);

    -- Backfill: give every project without a version a 'v1' from its own columns,
    -- and attach existing comments to it.
    INSERT INTO markup_versions (project_id, label, type, url, pages, created_at)
      SELECT p.id, 'v1', p.type, p.url, p.pages, p.created_at
        FROM markup_projects p
       WHERE NOT EXISTS (SELECT 1 FROM markup_versions v WHERE v.project_id = p.id);
    UPDATE markup_comments c
       SET version_id = v.id
      FROM markup_versions v
     WHERE c.version_id IS NULL AND v.project_id = c.project_id;
  `);
}

// Move pre-versioning unzipped folders (MARKUP_DIR/<projectId>/) to their v1 version
// folder (MARKUP_DIR/<versionId>/). Best-effort; safe to call on every boot.
export async function migrateMarkupFiles(markupDir: string) {
  const fs = await import('fs');
  const path = await import('path');
  try {
    const { rows } = await pool.query(
      `SELECT v.id AS vid, v.project_id FROM markup_versions v WHERE v.type = 'zip'`
    );
    for (const r of rows) {
      const versionPath = path.join(markupDir, r.vid);
      const legacyPath = path.join(markupDir, r.project_id);
      if (!fs.existsSync(versionPath) && fs.existsSync(legacyPath)) {
        fs.renameSync(legacyPath, versionPath);
      }
    }
  } catch (e) { /* ignore */ }
}

// Turn any pending email-invites for this address into real memberships.
export async function claimInvites(userId: string, email: string) {
  const e = String(email).toLowerCase().trim();
  await pool.query(
    `INSERT INTO project_members (project_id, user_id, role)
       SELECT project_id, $1, role FROM project_invites WHERE email = $2
     ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [userId, e]
  );
  await pool.query('DELETE FROM project_invites WHERE email = $1', [e]);
  // same for markup invites
  await pool.query(
    `INSERT INTO markup_members (project_id, user_id, role)
       SELECT project_id, $1, role FROM markup_invites WHERE email = $2
     ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [userId, e]
  );
  await pool.query('DELETE FROM markup_invites WHERE email = $1', [e]);
  // board invites
  await pool.query(
    `INSERT INTO board_members (board_id, user_id, role)
       SELECT board_id, $1, role FROM board_invites WHERE email = $2
     ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [userId, e]
  );
  await pool.query('DELETE FROM board_invites WHERE email = $1', [e]);
  // style guide invites
  await pool.query(
    `INSERT INTO style_guide_members (style_guide_id, user_id, role)
       SELECT style_guide_id, $1, role FROM style_guide_invites WHERE email = $2
     ON CONFLICT (style_guide_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [userId, e]
  );
  await pool.query('DELETE FROM style_guide_invites WHERE email = $1', [e]);
  // team invites
  await pool.query(
    `INSERT INTO team_members (team_id, user_id, role)
       SELECT team_id, $1, role FROM team_invites WHERE email = $2
     ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [userId, e]
  );
  await pool.query('DELETE FROM team_invites WHERE email = $1', [e]);
}

// Ensure the user owns a personal team (created on register). Returns the team id.
export async function ensurePersonalTeam(userId: string, userName?: string) {
  const existing = await pool.query('SELECT id FROM teams WHERE owner_id = $1 LIMIT 1', [userId]);
  let teamId = existing.rows[0]?.id;
  if (!teamId) {
    const name = `${(userName || 'My').trim() || 'My'}'s Team`;
    const ins = await pool.query('INSERT INTO teams (owner_id, name) VALUES ($1, $2) RETURNING id', [userId, name]);
    teamId = ins.rows[0].id;
  }
  await pool.query(
    `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'pm')
     ON CONFLICT (team_id, user_id) DO NOTHING`,
    [teamId, userId]
  );
  return teamId;
}
