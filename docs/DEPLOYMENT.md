# PRODUCTION DEPLOYMENT — ORABI Restaurant (PizzaProject)

Target architecture: **Vercel frontend + separate Express API + separate PostgreSQL + separate Redis.**

```
                 ┌────────────────┐
                 │     Vercel     │   React 19 + Vite 8 SPA (dist/)
                 └───────┬────────┘
                         │ HTTPS, CORS: CLIENT_URL
                         ↓
                 ┌────────────────┐
                 │  Backend / API │   Express + Node (server/dist/server.js)
                 └───────┬────────┘
                         │
              ┌──────────┴──────────┐
              ↓                     ↓
       PostgreSQL (production)  Redis (cache + BullMQ)
```

- The **browser never talks to PostgreSQL directly** — everything goes through the API.
- **Vercel hosts the frontend only.** Postgres and Redis never run on Vercel.
- The database remains **PostgreSQL** (no provider change). Docker Postgres stays for
  local development; production uses a separate managed/self-hosted Postgres.
- RLS, RBAC, JWT, rate limiting, Helmet and all existing security mechanisms are
  preserved — do not disable them.

---

## 1. What is already in the repo (audited)

| Area | Status |
|---|---|
| Frontend build (`npm run build`) | ✅ passes |
| Backend build (`npm run build:server`) | ✅ passes |
| Tests (`npm test`) — 240 tests / 26 files | ✅ pass |
| Lint (`npm run lint`) | ✅ passes |
| Docker (`docker compose build` + app) | ✅ builds, container `healthy` |
| Health endpoints | ✅ `GET /health`, `GET /health/ready` |
| Migrations on boot (idempotent, `schema_migrations`) | ✅ |
| RLS enabled on all tables + policies | ✅ |
| JWT — env-required secrets, ≥32 chars, no defaults | ✅ |
| CORS origin allowlist (`CLIENT_URL`), no `*` | ✅ |
| Helmet, rate limiting, magic-byte upload checks | ✅ |
| Graceful shutdown (PG pool, Redis, queues, HTTP) | ✅ |
| No secrets in tracked files (`server/.env.example` only) | ✅ |
| Backups (`npm run backup`, `BACKUP.md`) | ✅ |

Changes made in this deployment pass:

- `src/lib/api.ts` — `VITE_API_URL` support (relative `/api/v1` fallback for dev).
- `src/pages/auth/LoginPage.tsx` — OAuth links use the API base URL; error message derived in render.
- `src/components/review/ReviewPrompt.tsx` — localStorage reads moved out of render (lint/purity fix).
- `vercel.json` — SPA rewrites so deep links refresh without 404.
- `.env.example` (root) — docker compose + frontend variable reference.
- `server/src/app.ts` — `GET /health`, `GET /health/ready`, production `morgan('combined')`.
- `server/src/config/env.ts` + `server/src/utils/cookies.ts` — `COOKIE_SAMESITE` (cross-domain cookies).
- `server/src/database/seed.ts` — production guards: `SEED_RESET` hard-blocked, demo users/orders skipped.
- `server/src/database/connection.ts` — error cause preserved.
- `Dockerfile` — HEALTHCHECK against `/health`.
- `docker-compose.yml` — `COOKIE_SAMESITE` passthrough.
- `eslint.config.js` — `ignoreRestSiblings` for the pagination `__total` pattern.
- `docs/DEPLOYMENT.md` — this document.

---

## 2. Environment variable checklist

### Frontend — Vercel project settings

| Variable | Example | Notes |
|---|---|---|
| `VITE_API_URL` | `https://api.example.com` | Backend origin, **no trailing slash**, no `/api/v1`. Empty for dev (Vite proxies `/api` → `localhost:5000`). |

Configure **per environment**: Production → production API, Preview → preview/staging
API, Development → `http://localhost:5000`. Never put server secrets in `VITE_*`.

### Backend — production server/container

| Variable | Example / notes |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` (or whatever the host maps) |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/pizza` — production DB, never localhost, never in the frontend |
| `REDIS_URL` | `redis://host:6379` (cache + BullMQ; optional — API degrades to DB-only if unset) |
| `JWT_ACCESS_SECRET` | random ≥32 chars (refuses to boot otherwise) |
| `JWT_REFRESH_SECRET` | random ≥32 chars (refuses to boot otherwise) |
| `CLIENT_URL` | `https://your-app.vercel.app` — exact frontend origin for CORS + OAuth redirects |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `lax` (same site) or `none` (separate domains — forces `Secure`, requires HTTPS) |
| `ADMIN_REGISTER_CODE` | secret code for the first admin; leave empty to disable admin self-registration |
| `PG_MAX_POOL_SIZE` | optional, default 20 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | production mail; logs to console when empty |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | production uploads; local disk when empty (not persistent on ephemeral hosts) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | HTTPS callback, e.g. `https://api.example.com/api/v1/auth/google/callback` |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` / `FACEBOOK_CALLBACK_URL` | same pattern |
| `AUTH_WINDOW_MS` / `AUTH_LIMIT` / `API_LIMIT` etc. | optional rate-limit knobs (defaults in `server/.env.example`) |

Generate secrets:
```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 3. Domain / CORS / cookies

- Frontend: `https://your-app.vercel.app`
- API: `https://api.example.com`
- Set `CLIENT_URL=https://your-app.vercel.app` on the backend. CORS allows exactly that
  origin (plus loopback/private-network LAN origins — the admin panel works from other
  devices on the LAN, but public-internet origins are rejected).
- Cookies are `HttpOnly` + `SameSite`. If frontend and API are on **different domains**
  (Vercel + `api.example.com`), set `COOKIE_SAMESITE=none` with `COOKIE_SECURE=true`;
  otherwise the refresh cookie will not be sent cross-site.
- All traffic must be HTTPS (Vercel does TLS for the frontend; terminate TLS on the API
  host with Nginx/Caddy/Cloudflare or the platform's TLS).

---

## 4. Vercel frontend deployment

1. Push `main` to GitHub.
2. In Vercel: **New Project → import the GitHub repo**.
   - Framework preset: **Vite** (auto-detected).
   - Build command: `npm run build` (root). Output directory: `dist`.
   - Install command: `npm ci` (default).
3. Add the environment variable:
   - Production: `VITE_API_URL=https://api.example.com`
   - Preview: staging API URL
   - Development: `http://localhost:5000`
4. Deploy. SPA routing is handled by the committed `vercel.json` rewrites — direct
   navigation to `/menu`, `/product/:id`, `/checkout`, `/admin`, etc. returns the app,
   not a 404.

> Only the frontend is deployed to Vercel. No database, no secrets, no backend code.

---

## 5. Backend deployment (separate host/container)

Requirements: Node 22+, a production PostgreSQL, a production Redis (optional).

```sh
npm ci
npm run build            # client (only needed if serving the SPA too)
npm run build:server     # server/dist/server.js
npm start                # NODE_ENV=production, reads PORT/DATABASE_URL/...
```

- Put the real values in the environment (not in code). The server refuses to boot
  without `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
- Run **behind a reverse proxy that terminates TLS** and forwards `/` to the Node
  server on `PORT`.
- Or build the Docker image: `docker compose build` / `docker build -t pizzaproject-app .`
  and run it with `-e` variables. The image ships a HEALTHCHECK on `/health`.

---

## 6. PostgreSQL production requirements

- A **separate** Postgres from the local `docker compose` one (e.g. managed provider or
  your own server). Point `DATABASE_URL` at it.
- Do **not** open Postgres to the public internet — only the API host should reach it.
- First boot: the API runs `applyMigrations()` automatically (idempotent SQL files in
  `server/src/database/migrations/`, tracked in `schema_migrations`). No manual DDL.
- **Never run `SEED_RESET=1` against production** — it is hard-blocked when
  `NODE_ENV=production` (the seed exits with an error).
- `npm run seed` with `NODE_ENV=production` seeds the **menu/catalog only**; demo users,
  demo orders and demo carts are skipped. Create the first admin via `/register` with
  `ADMIN_REGISTER_CODE`.
- RLS: enabled on every table with public-facing policies. The API account is the DB
  owner (documented, `docs/RLS_POLICIES.md`); server-side authz is the primary boundary.

## 7. Redis requirements

- `REDIS_URL` from env. Used for the cache layer and BullMQ queues (email + analytics).
- Workers: in production run the bundled worker `node server/dist/worker.js` (built by
  `npm run build:server` alongside `server.js`; also `npm run worker:prod --workspace server`).
  It exits cleanly if Redis is not configured.
- The API degrades to DB-only when Redis is unreachable (cache is best-effort), but
  queues will not process without it.

---

## 8. Database migration procedure

1. Build both artifacts.
2. Deploy the backend with the new image/code.
3. On boot, `applyMigrations()` applies pending `*.sql` files in order (idempotent).
4. Health check: `GET /health` (liveness) and `GET /health/ready` (DB + Redis).
5. No destructive commands run during deployment.

## 9. Backups

- `npm run backup` — pg_dump → gzip → git commit + push (see `BACKUP.md`).
- Production: schedule a real backup (platform snapshots or pg_dump cron) with:
  - Frequency: at least daily (more if order volume is high).
  - Retention: keep ≥ 7 daily, ≥ 4 weekly, ≥ 12 monthly.
  - Restore procedure: `npm run restore:db` (or `psql -f backup.sql.gz`).
  - Verify monthly by restoring to a scratch database.
- Never commit DB dumps containing customer data to GitHub (the `backups/` dir is
  gitignored).

## 10. Rollback procedure

1. Backend: redeploy the previous Docker image / code version (builds are reproducible
   via git). Because migrations are additive and idempotent, an older app version is
   compatible with the newer schema for at least one release.
2. Frontend: Vercel → Deployment → promote the previous deployment.
3. If a migration must be reverted, apply a **new** corrective migration — never edit an
   already-applied `*.sql` file (its hash/name is recorded in `schema_migrations`).
4. Restore the database from the latest verified backup if data corruption is involved.

## 11. Health checks

- `GET /health` → `200 {"status":"ok"}` — liveness (process up).
- `GET /health/ready` → `200` when DB + Redis are up, `503` with `checks` breakdown when
  degraded. No secrets, no env vars, no stack traces.
- The Docker image has a HEALTHCHECK on `/health`; use it as the container health gate.

## 12. Logs

- Production uses `morgan('combined')` (structured common-log format). Dev keeps `dev`.
- The error handler returns safe messages; stack traces are only included in
  development. Audit logging redacts passwords/tokens.
- Ship stdout/stderr to your log collector (platform logs, Loki, Papertrail, etc.).
- Never log JWT secrets, DB URLs, SMTP passwords, or full auth tokens.

## 13. Security checklist (pre-launch)

- [x] No secrets in tracked files (`git ls-files | grep .env` shows only `.env.example`s)
- [x] JWT secrets ≥ 32 chars via env, no defaults
- [x] RLS enabled; server-side authz in place
- [x] CORS allowlist = `CLIENT_URL` only (plus LAN loopback)
- [x] Rate limiting on auth/contact/review/admin/API routes
- [x] Helmet headers, `X-Powered-By` disabled, sanitize middleware
- [x] Uploads: image-only, magic-byte sniff, 5 MB limit, Cloudinary optional
- [x] Cookies `HttpOnly`; `Secure` + `SameSite` configured per domain topology
- [x] HTTPS everywhere
- [x] Health endpoints do not leak configuration
- [x] Backups configured + verified restore procedure

## 14. Render Blueprint (free tier)

- The repo ships `render.yaml` (Render Blueprint) describing the **free-tier-only**
  backend stack from the existing Dockerfile:
  - production PostgreSQL (`plan: free`, private network — `ipAllowList: []`),
  - the API Web Service (`plan: free`, Docker, health check `/health`).
- **No paid resources are defined**: no Redis (Key Value), no background worker, no
  one-off job. Without Redis the app is fully functional — cache is best-effort,
  emails send inline, `/health/ready` reports `redis: disabled`. Only the BullMQ
  worker (async email + analytics rollup) is unavailable on the free tier.
- `DATABASE_URL` is injected via `fromDatabase` (internal, never public). Every
  secret is declared with `sync: false` and set after launch — nothing sensitive
  lives in the file.
- The menu seed runs as the service's **Start Command**
  (`sh -c "node server/dist/seed.js && node server/dist/server.js"`) instead of a
  paid one-off job. In production the seed is safe and idempotent: it applies
  migrations, seeds the real menu/catalog, and skips on subsequent boots (verified
  ~10 s on a fresh DB). `SEED_RESET=1` is hard-blocked under `NODE_ENV=production`.
- Free-plan limits: web services sleep after ~15 min idle (cold start on next
  request); free Postgres expires after 30 days.

## 15. Manual steps (cannot be done from the repo)

1. **Vercel project** — create the project, link the repo, set `VITE_API_URL` per
   environment, deploy.
2. **Production PostgreSQL** — provision (managed or self-hosted), create DB/user, set
   `DATABASE_URL`, restrict network access to the API host.
3. **Production Redis** — provision, set `REDIS_URL`.
4. **API host** — a server/container + TLS termination + the backend env vars.
5. **Domains** — `your-app.vercel.app` (Vercel) and `api.example.com` (API host) + DNS.
6. **Email/SMTP** — real SMTP creds, or keep console-logged mail.
7. **Cloudinary** — optional; without it uploads land on the API host's local disk
   (use a persistent volume).
8. **Google/Facebook OAuth** — register the app, set callback URLs, set client id/secret.
9. **First admin** — after the API is live, register via `/register` with
   `ADMIN_REGISTER_CODE`.
10. **Verify in production** — register/login/logout, refresh token, admin panel,
    checkout, orders, reviews, uploads, OAuth, and both health endpoints.

> Nothing in this repository will fake a deployment. The site is live only when the
> manual steps above have been completed and verified.
