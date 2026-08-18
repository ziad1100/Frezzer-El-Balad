import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, statSync, createWriteStream } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createGzip } from 'node:zlib';

const PG_CONTAINER = process.env.BACKUP_PG_CONTAINER || 'pizzaproject-postgres-1';
const PG_DB = process.env.BACKUP_DB || 'pizza';
const PG_USER = process.env.BACKUP_PG_USER || 'postgres';
const BACKUP_DIR =
  process.env.BACKUP_DIR || path.join(homedir(), 'OneDrive', 'PizzaBackups');

const stamp = () => {
  const d = new Date();
  return (
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}` +
    `${String(d.getDate()).padStart(2, '0')}-` +
    `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
  );
};

const dbDir = path.join(BACKUP_DIR, 'db');
mkdirSync(dbDir, { recursive: true });

// -----------------------------------------------------------------------------
// PostgreSQL (Docker-only) — the authoritative data store.
// Resolution order: pg_dump on PATH → docker exec into the project's own
// `pizzaproject-postgres-1` container.
// -----------------------------------------------------------------------------
const PG_ARCHIVE = path.join(dbDir, `postgres-pizza-${stamp()}.sql.gz`);
const DEFAULT_DATABASE_URL = `postgresql://${PG_USER}:postgres@127.0.0.1:5432/${PG_DB}`;

const pipeToGz = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
    const gz = createGzip();
    const out = createWriteStream(PG_ARCHIVE);
    let settled = false;
    child.stdout.pipe(gz).pipe(out);
    out.on('finish', () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    });
    child.on('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
    child.on('close', (code) => {
      if (!settled && code !== 0) {
        settled = true;
        reject(new Error(`${cmd} exited with code ${code}`));
      }
    });
  });

let method = null;

try {
  execFileSync('pg_dump', ['--version'], { stdio: 'ignore', windowsHide: true });
  method = {
    label: 'pg_dump (PATH)',
    run: () =>
      pipeToGz('pg_dump', [
        `--dbname=${process.env.DATABASE_URL || DEFAULT_DATABASE_URL}`,
        '--no-owner',
        '--no-privileges',
        '--no-comments',
      ]),
  };
} catch {
  /* pg_dump not on PATH — try docker */
}

if (!method) {
  try {
    execFileSync('docker', ['exec', PG_CONTAINER, 'pg_dump', '--version'], { stdio: 'ignore', windowsHide: true });
    method = {
      label: `docker exec ${PG_CONTAINER} (pg_dump)`,
      run: () =>
        pipeToGz('docker', [
          'exec', PG_CONTAINER, 'pg_dump',
          '-U', PG_USER, '-d', PG_DB,
          '--no-owner', '--no-privileges', '--no-comments',
        ]),
    };
  } catch {
    /* no docker either */
  }
}

if (method) {
  try {
    console.log(`Postgres backup via ${method.label}`);
    console.log(`  -> ${PG_ARCHIVE}`);
    await method.run();
    console.log(`  archive: ${(statSync(PG_ARCHIVE).size / 1024 / 1024).toFixed(2)} MB`);
  } catch (err) {
    console.error(`Postgres backup FAILED: ${err.message} — skipping`);
  }
} else {
  console.log('No Postgres backup method available (pg_dump on PATH or docker container) — skipping');
}

console.log(`\nBackup complete -> ${BACKUP_DIR}`);