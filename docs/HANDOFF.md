# Qoders — Handoff / Continue-Here Doc

> Octopus.do clone: a visual sitemap & website-planning tool.
> Use this doc to continue development from a fresh chat. Last updated: 2026-06-16.

---

## 1. What this project is

**Qoders** is a self-hosted clone of [octopus.do](https://octopus.do): a canvas where you lay out a
website's pages as cards, add **sections/blocks** to each page (each with a **wireframe glyph**, a
**color**, content and optional **arrows** to other pages), and share the result. It belongs to the
**PurpleBear** Wix-apps project but is a standalone React + Node app.

- **Frontend:** React 18 (Create React App / react-scripts 5) + Tailwind (core utilities only) + lucide-react.
- **Backend:** Express 4 + TypeScript + Postgres (`pg`) + bcryptjs + jsonwebtoken. Compiled with `tsc`, dev via `tsx watch`.
- **Hosting target:** self-hosted via **Coolify on DigitalOcean** (NOT Supabase). Postgres is a normal Postgres DB.
- **Offline mode:** if `REACT_APP_API_URL` is **not** set, the whole app runs on **localStorage** (no backend needed). When it IS set, it talks to the Node API. This dual mode is intentional — keep it.

---

## 2. Repo layout

```
sitemap-builder/
├── src/                      # React frontend
│   ├── App.jsx               # hash router + auth gate + public-view + loader
│   ├── Login.jsx             # register / login screen
│   ├── Dashboard.jsx         # projects grid, ImportModal, account menu, share/delete
│   ├── SitemapBuilder.jsx    # THE editor canvas (~2100 lines) — pages, blocks, notes, links, comments
│   ├── Account.jsx           # account settings (profile / password / delete)
│   ├── InvitePanel.jsx       # invite people to a project by email
│   ├── importSitemap.js      # Octopus XML/CSV + sitemap.xml parsers → our node model
│   ├── projectStore.js       # CRUD; switches between backend API and localStorage
│   ├── api.js                # backend API client (fetch wrappers + token)
│   ├── auth.js               # client auth helpers (token, current user, initials)
│   ├── templates.js          # starter templates (seed nodes)
│   ├── Brand.jsx             # BrandStar logo component
│   └── SitemapBuilder 2.jsx  # ⚠️ stray duplicate — safe to delete, not imported
├── backend/
│   ├── src/
│   │   ├── index.ts          # express app, /api/import/sitemap, /api/import/crawl (Firecrawl)
│   │   ├── auth.ts           # register/login/me, PATCH me, change pw, delete me, claimInvites
│   │   ├── projects.ts       # project CRUD, members/invites, public read-only router
│   │   └── db.ts             # Postgres schema init (users, projects, project_members, project_invites)
│   ├── .env                  # DATABASE_URL, JWT_SECRET, CORS_ORIGIN, PORT, PGSSL, FIRECRAWL_API_KEY
│   └── package.json
├── docs/                     # this folder (handoff, deployment, octopus analysis, etc.)
├── Dockerfile, docker-compose.yml, nginx.conf   # deployment
└── package.json              # frontend
```

---

## 3. How to run locally

**Frontend (localStorage mode — no backend):**
```bash
cd sitemap-builder
npm install
npm start            # http://localhost:3000
```

**Full stack (with backend + Postgres):**
```bash
# 1. Backend
cd sitemap-builder/backend
cp .env.example .env     # if present; otherwise edit .env directly
#   set DATABASE_URL, JWT_SECRET. PORT defaults to 4000 locally.
npm install
npm run dev              # tsx watch → http://localhost:4000

# 2. Frontend, pointed at the backend
cd sitemap-builder
echo "REACT_APP_API_URL=http://localhost:4000" > .env.local
npm start
```

The backend auto-creates its tables on boot (`initDb()` in `db.ts`). Node 22 is used (global `fetch`).

**⚠️ Restart the backend after changing `.env` or backend code** — `tsx watch` reloads code but a manual restart is safest for env changes.

---

## 4. Build / verify (do this before declaring anything done)

```bash
# Frontend — CI=true makes warnings fail the build (catches unused vars etc.)
cd sitemap-builder
CI=true npx eslint src/*.jsx src/*.js
CI=true npx react-scripts build

# Backend — typecheck
cd backend
npx tsc --noEmit
```

All three must exit 0. This is the standard gate used throughout the project.

---

## 5. Data model (the "node")

A project = `{ id, name, nodes[], items[], settings }`. The two important arrays:

**`nodes`** — one per page:
```js
{
  id, label,                 // page name
  parentId,                  // tree parent (null = root)
  group: 'main' | 'section', // 'main' = the page tree; 'section' = loose grouped pages
  color,                     // page color (preset key or hex)
  link,                      // external URL (optional)
  pageFrame: 'window',
  blocks: [                  // the sections/wireframes stacked on the page
    {
      id, name, color,       // color = preset key (see COLORS) or raw hex
      frame,                 // wireframe glyph key (see FRAME_KEYS) or 'none'
      done: false,           // checkmark toggle
      arrowTargets: [nodeId],// cross-page arrows
      description,           // text content
    }
  ]
}
```

**`items`** — free canvas objects: notes (4 colors), link cards, comment pins.

**Colors** (`COLORS` in `SitemapBuilder.jsx`): `blue, teal, green, lime, orange, red, pink, fuchsia, purple, indigo, slate, steel` (+ `topaz`/`tealy` back-compat aliases). A color can also be a **raw hex string** — `resolveColor()` handles both.

**Wireframe glyphs** (`FRAME_KEYS` in `SitemapBuilder.jsx`, 27 keys):
`bar, text, carousel, cols2, text2, dots, cols3, text3, banner, cols4, text4, table, carousel2, cards2, text2b, carousel3, cards3, dashes, media-text, list2, text-media, cards-grid, media-split, video, iconrow, video-center, list`.
`frame: 'none'` removes the wireframe (the "clean" option). `FrameGlyph` returns `null` for `'none'`.

---

## 6. Import pipeline (`importSitemap.js`) — current focus area

Entry point: **`parseImport(text, filename)`** → array of nodes. Format detection order: Octopus XML → CSV → sitemap urlset.

| Export | Function | Fidelity |
|---|---|---|
| **Octopus native XML** ✅ best | `parseOctopusXml` | pages + sections + **real wireframes** (`<form>`) + notes |
| Octopus CSV | `parseOctopusCsv` | pages + sections + content (no wireframes/colors) |
| Any `sitemap.xml` | `parseSitemapXml` | pages only, from URL paths |

**Decision (user, 2026-06-16): focus on XML import. CSV is de-emphasized** — the File tab now accepts `.xml` only, though `parseOctopusCsv` still exists as a fallback inside `parseImport`.

Key pieces:
- **`FORM_TO_FRAME`** — definitive map from Octopus's `<form>` block names → our `FRAME_KEYS` glyph. Built from Octopus's full "all blocks" export (30 block types). e.g. `wide→bar, hero_with_arrows→carousel, double→cols2, slider→dots, triple→cols3, logos→cols4, table_2→table, image→media-text, image_right→text-media, catalog→cards-grid, video→video, text_and_video_2→video-center`. **If a block imports with the wrong wireframe, fix the mapping here.**
- **`colorFor(name, idx)`** — Octopus exports carry **no colors**, so colors are reconstructed heuristically from the block's role/name (header→teal, footer→purple, cta→pink, faq→blue, …). This is a known compromise; colors will never be 1:1 with Octopus because the data isn't exported.
- **`finalizeZones(nodes)`** — largest tree = `main`; other roots flattened into a `section` group.
- **`rebuildArrows(nodes)`** — Octopus encodes cross-page links only as `"→ PageName"` text hints; this matches them back to page ids and fills `arrowTargets`.
- **`cleanProjectName(filename, nodes)`** — XML has **no project-name field**, so the project is named after the **downloaded filename** (Octopus names the file after the project). Strips the browser `" (4)"` dedup suffix; for generic names ("Untitled project", "export") falls back to the meaningful Home page label.

**To get an Octopus XML export:** in octopus.do → `···` menu → Export → XML.

---

## 7. Backend API surface

Auth: `Authorization: Bearer <jwt>`. Token stored client-side as `qoders-token`.

```
POST   /api/auth/register        {email,name,password} → {token,user}
POST   /api/auth/login           {email,password}      → {token,user}
GET    /api/auth/me                                     → user
PATCH  /api/auth/me              {profile patch}
POST   /api/auth/me/password     {currentPassword,newPassword}
DELETE /api/auth/me                                     (cascade delete account)

GET    /api/projects                                    → list (owned + shared)
POST   /api/projects             {name,nodes,items}     → project
GET    /api/projects/:id
PATCH  /api/projects/:id         {patch}
POST   /api/projects/:id/duplicate
DELETE /api/projects/:id          (owner = delete all; member = just leave)
GET    /api/projects/:id/members ; POST add ; DELETE member/:userId ; DELETE invites/:email

GET    /api/public/projects/:id   (read-only, NO auth — powers #/view/<id>)

GET    /api/import/sitemap?url=   → {xml} or {index:true, sitemaps:[...]} for sitemap indexes
GET    /api/import/crawl?url=     → {xml,count} — uses Firecrawl map(), falls back to BFS fetch crawler
```

**Sharing model:** invite by email even if the person has no account yet → stored in `project_invites`, **claimed on register/login** (`claimInvites`). A non-owner who hits Delete only removes their own membership; the owner keeps the project. Public link = `/#/view/<id>` (read-only, content layer has `pointerEvents:none`, chrome hidden).

**Hash routes (frontend):** `#/p/<id>` = edit, `#/view/<id>` = public read-only.

---

## 8. Firecrawl (crawler) — status: behind "Coming soon"

- The **Crawler tab is disabled in the UI** with a `SOON` badge + "coming soon" panel (per user, 2026-06-16). Re-enable by reverting the `tab === 'crawler'` branch in `Dashboard.jsx`'s `ImportModal`.
- Backend is **already wired**: `backend/src/index.ts` creates a `Firecrawl` client from `FIRECRAWL_API_KEY` (saved in `backend/.env`). `/api/import/crawl` calls `firecrawl.map(url, {limit:500})` to list every URL, builds a synthetic `<urlset>`, and **falls back** to the old fetch-based BFS crawler if the key is missing or the call fails.
- `firecrawl` npm package (v4.27) is installed in `backend/`.
- **Not yet live-tested** — the dev sandbox can't reach `api.firecrawl.dev` (network allowlist). It should work on the real Coolify/DigitalOcean backend. **First thing to do when resuming the crawler: deploy and test `/api/import/crawl?url=https://upqode.com`.**

---

## 9. What's DONE

- Full canvas editor: pages tree, drag-and-drop, blocks with wireframe glyph + color + arrows + done-toggle, page/section context menus, notes, link cards, comment pins, pan/zoom.
- Auth (register/login/logout), projects saved per-user, account settings (profile / change password / delete account).
- Sharing: invite by email (pending invites claimed on signup), member "leave" vs owner "delete", public read-only share link.
- Dashboard: live homepage preview on cards, micro-preloader + fade on open, dark-mode card colors.
- Import: **Octopus XML** (pages + sections + real wireframes), **Sitemap.xml** (incl. sitemap-index multi-select), preloader + success screen, project name from filename. CSV parser exists but de-emphasized.
- Firecrawl crawler wired in backend (UI gated behind "Coming soon").

## 10. What's PENDING / next ideas

1. **Crawler** — deploy backend, live-test Firecrawl on upqode.com, then re-enable the tab.
2. **Colors on import** — fundamentally limited (Octopus doesn't export colors). Options: keep heuristic, or let user recolor fast post-import. Discuss before investing.
3. **Block library 1:1 with Octopus** — user floated rebuilding our blocks to match Octopus's exact set so `FORM_TO_FRAME` becomes identity. Current mapping works; this is optional polish.
4. **Cleanup** — delete `src/SitemapBuilder 2.jsx` (stray duplicate, not imported).
5. Verify the full deploy path (Dockerfile + nginx + Coolify env vars) end to end.

## 11. Conventions / gotchas

- Tailwind: **core utility classes only** (no JIT/arbitrary-value compiler in this setup beyond what CRA provides — stick to standard classes; inline `style={{}}` for one-offs like brand hex `#473AE0`).
- `CI=true` turns ESLint warnings into errors — unused imports/vars WILL fail the build. Always run the gate in §4.
- Keep the **localStorage fallback** working alongside the backend (`hasBackend()` in `api.js` / `projectStore.js` is the switch).
- Brand purple `#473AE0`, Octopus-green accents `#10B981`.
- The editor file `SitemapBuilder.jsx` is large (~2100 lines); search by feature keyword (e.g. `arrowTargets`, `FrameGlyph`, `readOnly`, `CardMenu`).

---

*Prompt to start a new chat:* "Continue the Qoders project (Octopus.do clone) in PurpleBear. Read `sitemap-builder/docs/HANDOFF.md` first, then [your task]."
