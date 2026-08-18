# OPERATIONS.md

Operations guide for the ORABI PizzaProject stack (PostgreSQL + Redis + BullMQ).

## Stack

| Layer | Tech | Notes |
|---|---|---|
| API | Node.js + Express (`server/src`) | TypeScript, tsx watch in dev |
| Client | React SPA (Vite) | served by the API in production |
| Database | PostgreSQL (Supabase) | source of truth |
| Cache | Redis (`pizzaproject-redis-1`) | cache-aside + BullMQ |
| Workers | BullMQ (`server/`) | email + analytics rollup |
| Tests | Vitest + disposable Docker Postgres | see Tests below |

## Prerequisites

- Node.js 20+
- Docker Desktop (used for the disposable test Postgres container and k6)
- The live PostgreSQL database (local Supabase container, or any Postgres reachable via `DATABASE_URL`)
- Redis reachable via `REDIS_URL`

## Environment

`server/.env` (see `server/.env.example`):

| Var | Purpose |
|---|---|
| `PORT` | API port (default 5000) |
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | token signing |
| `SMTP_*` | optional real mail; absent → `[MAIL:dev]` console fallback |
| `GOOGLE_*` / `FACEBOOK_*` | optional OAuth (passport) |
| `ADMIN_CODE` | registration code for admin signup |
| `DISABLE_RATE_LIMIT` | `1` disables API + auth rate limiters — dev/load-test only |

## Running the stack

```bash
npm install
npm run seed            # seed categories/products/users (password: Pizza123!)
npm run dev:server      # API on http://localhost:5000
npm run worker          # BullMQ worker (email + analytics rollup)
npm run dev             # Vite client
```

### Worker

`npm run worker --workspace server` starts both workers:

- `orabi-email` — transactional email queue (concurrency 3). No SMTP → messages log to the console as `[MAIL:dev]`.
- `orabi-analytics` — daily stats rollup; repeatable job every 15 min (`*/15 * * * *` UTC) plus a boot-time run.

Run only ONE worker group per environment. A tsx watch restart or a second terminal starts a
second listener — duplicate groups are safe (BullMQ locks) but noisy; kill the older group
(example: `taskkill /T /F /PID <npx-pid>` on Windows).

## Queues & Redis inspection

Queue key prefixes: `bull:orabi-email:*`, `bull:orabi-analytics:*`.

```bash
# counts
docker exec pizzaproject-redis-1 redis-cli --scan --pattern 'bull:orabi-email:*'
# completed/failed counts by queue
docker exec pizzaproject-redis-1 redis-cli LLEN bull:orabi-email:completed
docker exec pizzaproject-redis-1 redis-cli LLEN bull:orabi-email:failed
docker exec pizzaproject-redis-1 redis-cli LLEN bull:orabi-analytics:completed
```

Normal state: `orabi-email:completed` grows with each registered user / placed order; empty
`*:failed`; `repeat:analytics-*` keys exist for the 15-minute scheduler; `cache:*` keys appear
on first public-menu hit.

## Tests

```bash
npm test                # = vitest run (server workspace)
```

`server/src/test/setup.ts` bootstraps a throwaway Postgres container (`orabi-test`) on every run:

1. starts a `postgres:16-alpine` container with `POSTGRES_HOST_AUTH_METHOD=trust`,
2. applies `server/src/database/migrations/001_init.sql` (which creates the
   `anon` / `authenticated` / `service_role` roles itself),
4. seeds minimal per-suite data; tests hit the real schema and the real repos.

Requirements: Docker running, port 5433 free. The DB is dropped automatically; no seed data is
shared with the dev database.

## Email behavior at runtime

1. `enqueueEmail(...)` → BullMQ job (default).
2. Redis unavailable → synchronous inline send (mail still goes out, no queue).
3. No SMTP configured (`SMTP_HOST` unset) → email body is logged with `[MAIL:dev]` and dev tokens/OTPs are read from the server console log.

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `no pg_hba.conf entry` on tests | stale postgres data directory; stop Docker and prune test containers, then rerun |
| `Queue name cannot contain :` | queue names are `orabi-email` / `orabi-analytics` (BullMQ forbids `:`) |
| orders return 429 | authLimiter 20/15min — dev/load: run with `DISABLE_RATE_LIMIT=1` |
| stale menu | Redis cache TTL is 60s by design; or `redis-cli --scan --pattern 'cache:*' \| xargs redis-cli DEL` |
| duplicate workers | kill older worker group (see Worker section) |

## Backup / restore

See root scripts: `npm run backup`, `npm run restore:db`, `npm run backup:db`, `npm run restore:db`.