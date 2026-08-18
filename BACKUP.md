# BACKUP & RESTORE — ORABI Restaurant

Everything here is wired so the project survives a dead laptop disk / accidental deletion.
There are **three independent layers**: GitHub (code), OneDrive (data archives), and a
scheduled task (daily automation).

---

## What is covered

| Data | Where it lives | Backed up by |
|---|---|---|
| All source code + history | `git` (local + GitHub) | `npm run backup` / git |
| Live DB — PostgreSQL (Docker) | container `pizzaproject-postgres-1`, volume `pizzaproject_postgres-data` | `npm run backup:db` → `pg_dump` → `postgres-pizza-*.sql.gz` |
| Redis cache | Docker volume `pizzaproject_redis-data` | (not backed up — cache only, rebuilt on demand) |
| Uploads | Docker volume `pizzaproject_uploads-data` or local `server/src/uploads` | (empty by default; archived when present) |
| Secrets (`.env`, `server/.env`) | disk | copied to `backups/secrets/` (git-ignored) |

> Legacy Mongo volume `pizzaproject_mongo-data` + `server/.data` are **retired and no
> longer backed up** — the stack is PostgreSQL-only. The volume is kept on disk untouched.

Backup target: **`C:\Users\<you>\OneDrive\PizzaBackups`** (overridable via `BACKUP_DIR`).
Because it's inside OneDrive, every archive auto-syncs to the cloud.

## Commands

```powershell
npm run backup        # DB dump + data copy + git commit + push (one command)
npm run backup:db     # the Postgres dump
npm run restore:db    # restore the latest Postgres archive into the Docker DB
npm run restore:db postgres-pizza-YYYYMMDD-HHMM.sql.gz   # restore a specific archive
```

### Postgres dump orchestration

`npm run backup:db` produces one archive for the live DB:
- `postgres-pizza-<stamp>.sql.gz` — the **authoritative** dump (plain SQL, gzipped,
  `pg_dump --no-owner --no-privileges --no-comments`).

The dump resolves the toolchain in this order (first hit wins):
1. `pg_dump` on PATH — dumps the DB from `DATABASE_URL`.
2. `docker exec pizzaproject-postgres-1 pg_dump` — the project's Docker Postgres container.

Setting `DATABASE_URL` is recommended so the dump targets the right database; without
it the script falls back to the canonical local Docker URL
(`postgresql://postgres:postgres@127.0.0.1:5432/pizza`).

**Restoring Postgres** — `npm run restore:db` pipes the decompressed archive into
`docker exec -i pizzaproject-postgres-1 psql -U postgres -d pizza` (destructive —
replaces schema + data, so run it only against a DB you intend to overwrite).

## Restoring everything after losing the laptop

1. **Code**: install Node 24 + Docker Desktop, `git clone` your GitHub private repo,
   `npm ci`, copy `backups/secrets/*.env` back into `.env` + `server/.env`.
2. **DB**: `docker compose up -d postgres` (schema auto-applies on a fresh volume),
   then restore the `postgres-pizza-*.sql.gz` archive via `npm run restore:db`.
3. **Run**: `docker compose up --build` (or `npm start`), validate with `npm run smoke:ui`.

The catalog itself (68 items) is reproducible by `npm run seed`, so even the DB dump
is only needed to keep user-generated data (orders, reviews, accounts).

## Scheduled daily backup

A Windows Task Scheduler task runs `npm run backup` every day at 03:00 (saved as
`scripts/backup.ps1`):
- Requires your OneDrive folder present + git remote reachable.
- If the laptop is off at 03:00 it simply runs the next time it's on.
- Re-create the task on a new machine: `schtasks /create /tn ORABIBackup /tr "powershell -File C:\Self Work\PizzaProject\scripts\backup.ps1" /sc daily /st 03:00 /f`

## Notes / caveats

- The SQL dump accumulates (size depends on data) — prune old ones manually or add
  retention in `backup-db.mjs`.
- First `npm run backup` pushes the whole repo; later runs commit small deltas.
- `backups/` and all `.env` files are git-ignored — secrets never reach GitHub.
- The Postgres dump uses `--no-owner --no-privileges` so it restores across machines without
  role conflicts.