# BACKUP & RESTORE — Frezzer El Balad

Everything here is wired so the project survives a dead laptop disk / accidental deletion.
There are **three independent layers**: GitHub (code), OneDrive (data archives), and a
scheduled task (daily automation).

---

## What is covered

| Data | Where it lives | Backed up by |
|---|---|---|
| All source code + history | `git` (local + GitHub) | `npm run backup` / git |
| Live DB — Neon PostgreSQL | hosted on Neon (serverless Postgres) | `npm run backup:remote` → `remote-postgres-*.sql.gz` |
| Redis cache | (not used) | — |
| Uploads | server-side (empty by default) | — |
| Secrets (`.env`, `server/.env`) | disk | copied to `backups/secrets/` (git-ignored) |

Backup target: **`C:\Users\<you>\OneDrive\PizzaBackups`** (overridable via `BACKUP_DIR`).
Because it's inside OneDrive, every archive auto-syncs to the cloud.

---

## Commands

```powershell
# Remote database (production — Neon PostgreSQL)
npm run backup:remote                             # dump latest → OneDrive\PizzaBackups\db\
npm run restore:remote                             # restore latest backup into DATABASE_URL
npm run restore:remote -- --dry-run                # preview without changes
npm run restore:remote -- --no-drop                # merge mode (don't truncate first)
TARGET_URL=postgresql://... npm run restore:remote # restore into a different database

# Local Docker database (legacy)
npm run backup:db                                  # pg_dump from Docker container
npm run restore:db                                 # restore into Docker container
```

### Remote backup orchestration

`npm run backup:remote` connects directly to the Neon PostgreSQL database via the `pg`
driver and exports all 28 tables as gzipped SQL. No `pg_dump` or Docker required.

Output: `OneDrive\PizzaBackups\db\remote-postgres-<YYYYMMDD-HHMM>.sql.gz`

### Restoring from backup

`npm run restore:remote` connects to the target database and:
1. Truncates all data tables (within a transaction)
2. Executes every INSERT statement from the backup
3. Shows post-restore row counts for verification

## Restoring everything after losing the laptop

1. **Code**: install Node, `git clone` your GitHub private repo, `npm ci`,
   copy `backups/secrets/*.env` back into `.env` + `server/.env`.
2. **DB**: Set `DATABASE_URL` to your new PostgreSQL instance,
   then `npm run restore:remote` to load the latest backup.
3. **Run**: `npm start`, validate with `npm run smoke:ui`.

The catalog itself is reproducible by `npm run seed`, so even the DB dump
is only needed to keep user-generated data (orders, reviews, accounts).

## Scheduled daily backup

A Windows Task Scheduler task runs `npm run backup:remote` every day at 03:00:

```powershell
# Create the task (run once as Administrator):
schtasks /create /tn "FrezzerElBalad-RemoteBackup" /tr "powershell -ExecutionPolicy Bypass -File `"C:\Self Work\Frezzer El Balad\scripts\backup-remote-scheduled.ps1`"" /sc daily /st 03:00 /f

# Remove the task:
schtasks /delete /tn "FrezzerElBalad-RemoteBackup" /f

# Run manually:
powershell -ExecutionPolicy Bypass -File scripts\backup-remote-scheduled.ps1
```

The scheduled script:
- Runs `npm run backup:remote` against the production Neon database
- Logs output to `OneDrive\PizzaBackups\backup-remote.log`
- Auto-prunes backups older than 30 days
- If the laptop is off at 03:00 it simply runs the next time it's on

## Backup verification

Run the verification tests to confirm backup integrity:

```bash
npm test -- --testPathPattern=backup-verification
```

## Notes / caveats

- The SQL dump accumulates (size depends on data) — the scheduled task auto-prunes files older than 30 days.
- `backups/` and all `.env` files are git-ignored — secrets never reach GitHub.
- Backups use `--no-owner --no-privileges` format so they restore across machines without role conflicts.
- The `--dry-run` flag lets you preview a restore without making changes.