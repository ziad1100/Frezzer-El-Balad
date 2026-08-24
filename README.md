# Welad Halal (ولاد حلال)

Full-stack Egyptian frozen-food / meat / chicken e-commerce platform — an RTL-first bilingual (Arabic/English)
storefront, a customer dashboard, and an admin panel, backed by an Express REST API on
PostgreSQL (Docker) with Redis caching, BullMQ queues, role-based access control, and a
hardened security posture.

> Detailed documentation: **[PROJECT.md](./PROJECT.md)** (architecture, DB, seeding),
> **[BACKUP.md](./BACKUP.md)** (backups & restore), **[docs/](./docs/)** (security audit,
> auth, RLS policies, threat model, operations, load tests).

## Stack

- **Client**: React 19, Vite 8, TypeScript, Tailwind CSS v4, Redux Toolkit, TanStack Query v5,
  react-hook-form + zod, i18next (ar/en, RTL), react-router v8, sonner, swiper, framer-motion
- **Server**: Express, TypeScript, PostgreSQL (`pg`, Docker), Redis (ioredis) + BullMQ,
  zod, helmet, express-rate-limit, multer, nodemailer, Passport (Google/Facebook), JWT
- **Monorepo**: npm workspaces (root + `server`), single root `npm install`

## Quickstart (dev)

1. **Install** — Node 24+, then:

   ```sh
   npm ci
   ```

2. **Database** — PostgreSQL is required (`DATABASE_URL`). The project ships its own
   Docker Postgres (schema auto-applies on first start):

   ```sh
   docker compose up -d postgres redis
   ```

3. **Configure the server** — no defaults are allowed:

   ```sh
   cd server
   cp .env.example .env    # fill in DATABASE_URL + JWT_ACCESS_SECRET + JWT_REFRESH_SECRET
   ```

   JWT secrets must be ≥ 32 chars:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

4. **Run** (from repo root):

   ```sh
   npm run seed        # idempotent seed: roles, 21-item frozen food catalog, demo users (skips if data exists; SEED_RESET=1 forces a wipe)
   npm run dev:all     # Vite client (:5173) + API server (:5000)
   ```

   Demo users (password `Frezzer123!`): `admin@frezzerelbalad.dev`, `manager@frezzerelbalad.dev`,
   `employee@frezzerelbalad.dev`, `customer@frezzerelbalad.dev`.

## Verify

```sh
npm test              # Vitest + Supertest: unit + API integration
npm run lint          # ESLint
npm run build         # client: tsc -b + vite build → dist/
npm run build:server  # server: tsc --noEmit + esbuild → server/dist/server.js
npm run smoke:ui      # puppeteer end-to-end (dev servers must be running)
```

Tests run against a disposable Postgres: a `postgres:16-alpine` container on port 54329
(autostarted, schema from `server/src/database/migrations/`), or any PG via
`TEST_DATABASE_URL`.

## Environment

Documented inline in `server/.env.example` (including a production checklist).
**Required**: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. The server refuses
to boot without them (no insecure defaults). Optional: `REDIS_URL`,
`CLOUDINARY_*`, `SMTP_*`, `GOOGLE_*`/`FACEBOOK_*`, `ADMIN_REGISTER_CODE`, rate-limit knobs.

## Security

Hardening across auth, orders, uploads, logging, and rate limits is implemented and
documented — see `docs/SECURITY_AUDIT.md` for the full baseline (S1–S12) and statuses,
plus `docs/SECURITY.md`, `docs/AUTHENTICATION.md`, `docs/ADMIN_AUTHORIZATION.md`,
`docs/RLS_POLICIES.md`, `docs/THREAT_MODEL.md`, and the incident/secret-rotation runbooks.

## Production

- `npm run build` + `npm run build:server`, then `npm start` (serves SPA + API on `PORT`,
  default 5000) — or `docker compose up --build`.
- Requires PostgreSQL (Docker Postgres or any managed PG), Redis for cache/queues, and
  real JWT/SMTP/Cloudinary/OAuth config — see the production checklist in
  `server/.env.example`.
- **Vercel frontend + Render backend**: Frontend deployed to Vercel, backend to Render.
  See `render.yaml` and `vercel.json` for deployment configuration.
