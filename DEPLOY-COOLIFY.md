# Deploy to Coolify — design.upqode.com (server 167.99.128.249)

One domain serves everything: the React frontend at `design.upqode.com`, and its nginx
proxies `/api` to the Node backend on the internal network. Postgres is a separate Coolify
resource. The backend renders sites with **Puppeteer/Chromium** (bundled in its Docker image).

## 0. Prerequisites
- The repo is on GitHub/GitLab (Coolify deploys from Git). If not, push it first.
- Server has **≥ 2 GB RAM** (Chromium needs headroom). 4 GB is comfortable.

## 1. DNS
Add an **A record**: `design.upqode.com` → `167.99.128.249`. Wait for it to resolve.

## 2. Postgres (in Coolify)
1. Coolify → your Project → **+ New** → **Database** → **PostgreSQL** → create.
2. Open it → enable **"Connect To Predefined Network"** (so the app can reach it).
3. Copy its **internal connection string** (looks like
   `postgresql://postgres:<pass>@<service-name>:5432/postgres`). This is your `DATABASE_URL`.

## 3. The application (Docker Compose)
1. Coolify → Project → **+ New** → **Resource** → **Docker Compose** (or "Public/Private Git Repository" → Build Pack: **Docker Compose**).
2. Repository = this repo; Branch = `main` (or yours).
3. **Docker Compose file path**: `docker-compose.coolify.yml`.
4. Enable **"Connect To Predefined Network"** so it can reach the Postgres resource.

## 4. Environment variables (Coolify → the app → Environment Variables)
```
APP_URL=https://design.upqode.com
DATABASE_URL=postgresql://postgres:<pass>@<service-name>:5432/postgres
PGSSL=false
JWT_SECRET=<a long random string>
OPENAI_API_KEY=<your key>
OPENAI_MODEL=gpt-5.4
OPENAI_CHEAP_MODEL=gpt-5.4-mini
SCREENSHOTENGINE_API_KEY=<your key>
FIRECRAWL_API_KEY=<optional, can be blank>
RESEND_API_KEY=<optional, for emails>
MAIL_FROM=<optional, e.g. no-reply@upqode.com>
```
Note: `REACT_APP_API_URL` stays empty (the compose sets it) — the frontend talks to `/api`
on its own domain, so no CORS issues.

## 5. Domain → frontend
In the app's settings, map the domain **`design.upqode.com`** to the **`frontend`** service,
port **80**. Coolify issues HTTPS automatically (Let's Encrypt). Leave the `backend` service
**without** a public domain (it's internal-only).

## 6. Deploy
Click **Deploy**. First build is slow (Chromium download in the backend image). When it's up:
- open `https://design.upqode.com`
- the backend auto-creates all DB tables on first boot (idempotent schema).

## Troubleshooting
- **Frontend up but API 502/timeout**: the `frontend` and `backend` must be in the SAME compose
  (they are) so nginx can reach `http://backend:3000`. Re-deploy if needed.
- **DB connection refused**: make sure both the app and the Postgres resource have
  "Connect To Predefined Network" enabled, and `DATABASE_URL` uses the Postgres **service name**.
- **AI generation fails / Chromium crash**: usually low RAM — give the server ≥ 2 GB, or add swap.
  Puppeteer already runs with `--no-sandbox --disable-dev-shm-usage`.
- **Generation is slow**: nginx `/api` timeout is 300s; Puppeteer + model can take 30–90s per site.
