import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db';

export const migrationsDir = (): string => {
  const candidates = [
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'database', 'migrations'),
    path.resolve(process.cwd(), 'server', 'src', 'database', 'migrations'),
    path.resolve(process.cwd(), 'src', 'database', 'migrations'),
  ];
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isDirectory()) return c;
    } catch {
      /* try next */
    }
  }
  throw new Error('[migrate] unable to locate database migrations directory');
};

export const migrationFiles = (): string[] => {
  const dir = migrationsDir();
  return fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
};

/**
 * Applies pending `*.sql` migration files in order, tracking them in the
 * `schema_migrations` table. Idempotent: already-applied files are skipped.
 */
export const applyMigrations = async (): Promise<void> => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       "appliedAt" timestamptz NOT NULL DEFAULT now()
     )`,
  );
  for (const file of migrationFiles()) {
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (applied.rows.length) continue;
    const sql = fs.readFileSync(path.join(migrationsDir(), file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    console.log(`[migrate] applied ${file}`);
  }
};
