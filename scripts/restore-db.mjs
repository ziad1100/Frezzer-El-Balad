import { execFileSync, spawn } from 'node:child_process';
import { readdirSync, createReadStream } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createGunzip } from 'node:zlib';

const PG_CONTAINER = process.env.BACKUP_PG_CONTAINER || 'pizzaproject-postgres-1';
const PG_DB = process.env.BACKUP_DB || 'pizza';
const PG_USER = process.env.BACKUP_PG_USER || 'postgres';
const BACKUP_DIR =
  process.env.BACKUP_DIR || path.join(homedir(), 'OneDrive', 'PizzaBackups');

const dbDir = path.join(BACKUP_DIR, 'db');
const archives = readdirSync(dbDir)
  .filter((f) => f.startsWith('postgres-pizza-') && f.endsWith('.sql.gz'))
  .sort()
  .reverse();

if (archives.length === 0) {
  console.error(`No "postgres-pizza-*.sql.gz" archives found in ${dbDir}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const chosen = args.find((a) => !a.startsWith('--')) || archives[0];
const archive = path.join(dbDir, chosen);
console.log(`Restoring "${PG_DB}" from ${archive} -> container ${PG_CONTAINER}`);

const restore = () =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      ['exec', '-i', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', PG_DB, '--set', 'ON_ERROR_STOP=1'],
      { stdio: ['pipe', 'inherit', 'inherit'], windowsHide: true },
    );
    createReadStream(archive).pipe(createGunzip()).pipe(child.stdin);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`psql exited with code ${code}`));
    });
  });

try {
  execFileSync('docker', ['exec', PG_CONTAINER, 'pg_isready', '-U', PG_USER], {
    stdio: 'ignore',
    windowsHide: true,
  });
} catch {
  console.error(`Container ${PG_CONTAINER} is not running — start it first: docker compose up -d postgres`);
  process.exit(1);
}

try {
  await restore();
  console.log('Restore complete. Latest archive:', chosen);
} catch (err) {
  console.error('Restore FAILED:', err.message);
  process.exit(1);
}