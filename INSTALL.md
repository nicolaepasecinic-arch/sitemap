# Qoders — Installation & Setup Guide

This guide explains how to run the app from scratch — locally for development, and in
production on Coolify. Every step is commented so you can follow it without prior DevOps
experience.

---

## 1. What the app is made of

The project is a **monorepo** with two parts plus a database:

| Part         | Tech                         | Where                | Port (local) |
|--------------|------------------------------|----------------------|--------------|
| **Frontend** | React (Create React App)     | repo root (`src/`)   | 3000         |
| **Backend**  | Node + TypeScript + Express  | `backend/`           | 4000         |
| **Database** | PostgreSQL                   | external / Docker    | 5432         |

The backend also runs **Puppeteer (headless Chromium)** to read a website's real styles when
generating a style guide — so the production image ships Chromium (handled by the Dockerfile).

In **production** there is one public domain. The frontend (nginx) serves the site and
**proxies `/api` to the backend** on the internal network, so everything lives on one URL.

---

## 2. Prerequisites

- **Node.js 20+** and **npm** (for manual local dev)
- **Docker + Docker Compose** (for the easy local path and production)
- A **PostgreSQL** database (Docker Compose provides one locally)
- API keys:
  - **OpenAI** — required for AI features → https://platform.openai.com
  - **ScreenshotEngine** — recommended fallback for AI → https://screenshotengine.com
  - **Firecrawl** — optional (crawler) → https://firecrawl.dev
  - **Resend** — optional (emails) → https://resend.com

---

## 3. Local development

### Option A — Docker Compose (easiest: db + backend + frontend in one command)

```bash
# from the repo root
docker compose up --build
```
- Frontend → http://localhost:8080
- Backend  → http://localhost:3000
- Postgres → localhost:5432 (user/pass/db = qoders/qoders/qoders)

The backend creates all database tables automatically on first boot. Add your API keys to the
`backend` service env in `docker-compose.yml` (or an `.env`) before generating with AI.

### Option B — Run each part manually (best for active coding)

**1) Database** — start a Postgres (or use the compose db only):
```bash
docker compose up -d db
```

**2) Backend:**
```bash
cd backend
cp .env.example .env          # then edit .env (see the variables table below)
npm install                   # installs deps + downloads Chromium for Puppeteer
npm run dev                   # starts on http://localhost:4000 (hot reload)
```

**3) Frontend** (new terminal, repo root):
```bash
cp .env.example .env.local
# set REACT_APP_API_URL=http://localhost:4000 in .env.local
npm install
npm start                     # opens http://localhost:3000
```

> The first `npm install` in `backend/` downloads Chromium (~150 MB). If you don't need AI
> style-guide generation while developing, you can set `PUPPETEER_SKIP_DOWNLOAD=true` before
> installing to skip it.

---

## 4. Environment variables

Set these on the **backend** (`backend/.env` locally, or Coolify Environment Variables in prod).

| Variable                   | Required | What it is |
|----------------------------|----------|------------|
| `DATABASE_URL`             | ✅       | Postgres connection string. In Coolify use the **internal** URL of the Postgres resource (host = service name, not `localhost`). |
| `PGSSL`                    | ✅       | `true` only if your DB needs SSL. Coolify-hosted Postgres on the same network → `false`. |
| `JWT_SECRET`               | ✅       | Long random string used to sign login tokens. |
| `APP_URL`                  | ✅       | Public URL, e.g. `https://design.upqode.com`. Used for share links and baked into the frontend build. |
| `CORS_ORIGIN`              | ✅       | Allowed origin for the API — usually same as `APP_URL`. |
| `PORT`                     | ✅       | Backend port. `4000` locally, `3000` in the production container. |
| `OPENAI_API_KEY`           | ✅       | Powers AI generation. |
| `OPENAI_MODEL`             | ⬜       | Main model (default `gpt-5.4`). |
| `OPENAI_CHEAP_MODEL`       | ⬜       | Cheap model for tiny lookups (default `gpt-5.4-mini`). |
| `SCREENSHOTENGINE_API_KEY` | ⬜       | Screenshot fallback for AI. Recommended. |
| `FIRECRAWL_API_KEY`        | ⬜       | Crawler tab + optional style fallback. Can be blank. |
| `RESEND_API_KEY`           | ⬜       | Send share-invite emails. Blank = disabled. |
| `MAIL_FROM`                | ⬜       | From address for emails. |

The **frontend** has one build-time variable, `REACT_APP_API_URL` (the API base). In production
it's set automatically from `APP_URL` by `docker-compose.coolify.yml`.

---

## 5. Production deploy on Coolify

A one-domain setup: the frontend serves the site and proxies `/api` to the backend.
Files used: `docker-compose.coolify.yml`, `backend/Dockerfile` (with Chromium), `Dockerfile`
(frontend), `nginx.conf` (the `/api` proxy). Full walk-through is in **`DEPLOY-COOLIFY.md`**;
the short version:

1. **DNS** — point your domain (A record) to the server IP.
2. **Postgres** — Coolify → New → Database → PostgreSQL → Start.
   Enable **"Connect To Predefined Network"**. Copy its **internal** connection string.
3. **App** — Coolify → New → Git repository → Build Pack = **Docker Compose**,
   Compose file = `docker-compose.coolify.yml`. Enable "Connect To Predefined Network".
4. **Environment variables** — set everything from the table above (most importantly
   `APP_URL`, `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, `SCREENSHOTENGINE_API_KEY`,
   `PORT=3000`, `CORS_ORIGIN`, `PGSSL=false`).
5. **Domain** — map your domain to the **frontend** service (port 80). Leave **backend**
   with no public domain (internal only). Coolify issues HTTPS automatically.
6. **Deploy** (not just Restart — `APP_URL` is used at build time).

**Server size:** give the server **≥ 2 GB RAM** (4 GB ideal). Chromium + the React build are
memory-hungry; on a 1 GB box the build can OOM.

---

## 6. Troubleshooting (issues we actually hit)

- **Build uses Nixpacks / `npm ci` fails on lock file** → the Build Pack is wrong. Set it to
  **Docker Compose** with file `docker-compose.coolify.yml`.
- **Frontend build fails at `npm run build` + SSH "Connection reset"** → out of memory. The
  frontend Dockerfile already disables source maps; if it still fails, resize the server to
  2–4 GB RAM (or add swap).
- **App is "unhealthy" / red "Connect to AI needs the backend"** → required env vars are empty.
  Fill `APP_URL`, `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY` (and `PORT=3000`), then **Redeploy**.
- **`ERR_CERT_AUTHORITY_INVALID` (HTTPS not trusted)** → Let's Encrypt hasn't issued the cert.
  Set the domain as `https://...` on the frontend service, make sure DNS points to the server and
  is **not proxied** through Cloudflare (grey cloud / DNS-only), and ports 80+443 are open.
- **Backend can't reach the database** → use the Postgres **internal** URL (service name, not
  `localhost`) and enable "Connect To Predefined Network" on both resources.
- **AI generation crashes (Chromium)** → low RAM. Increase server RAM/swap. Puppeteer already
  runs with `--no-sandbox --disable-dev-shm-usage`.

---

## 7. Useful files

| File                          | Purpose |
|-------------------------------|---------|
| `docker-compose.yml`          | Local full stack (db + backend + frontend). |
| `docker-compose.coolify.yml`  | Production stack for Coolify (frontend + backend). |
| `Dockerfile`                  | Frontend image (CRA build → nginx). |
| `backend/Dockerfile`          | Backend image (Node + Chromium for Puppeteer). |
| `nginx.conf`                  | Frontend nginx: serves the SPA + proxies `/api` → backend. |
| `backend/.env.example`        | All backend env vars, commented. |
| `.env.example`                | Frontend env var. |
| `DEPLOY-COOLIFY.md`           | Detailed Coolify deployment walk-through. |
| `backend/scripts/clear-styleguides.js` | Delete all style guides (fresh testing). |
