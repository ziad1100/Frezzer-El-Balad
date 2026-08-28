#!/usr/bin/env tsx
/**
 * Safe standalone migration runner.
 *
 * Usage:
 *   npx tsx server/src/database/run-migrations.ts              # apply pending
 *   npx tsx server/src/database/run-migrations.ts --dry-run    # preview only
 *   npx tsx server/src/database/run-migrations.ts --status     # show applied
 *   npx tsx server/src/database/run-migrations.ts --file 004   # apply one file
 *
 * Requires DATABASE_URL env var. Reads from server/src/database/migrations/.
 * Tracks applied migrations in schema_migrations table (same as server startup).
 * Every migration is executed inside its own transaction — if it fails the
 * transaction rolls back and the runner reports the error without touching
 * the schema_migrations table for that file.
 *
 * Safe to run repeatedly: already-applied files are skipped.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import dotenv from 'dotenv';

/* ── env loading ─────────────────────────────────────────────── */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from common locations
const envCandidates = [
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server/.env'),
];
for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

/* ── args ────────────────────────────────────────────────────── */
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const statusOnly = args.includes('--status');
const fileFilter = args.includes('--file')
  ? args[args.indexOf('--file') + 1]
  : undefined;

/* ── migrations directory ────────────────────────────────────── */
const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

if (!fs.existsSync(MIGRATIONS_DIR)) {
  console.error(`[migrate] migrations directory not found: ${MIGRATIONS_DIR}`);
  process.exit(1);
}

const allFiles = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const files = fileFilter
  ? allFiles.filter((f) => f.includes(fileFilter))
  : allFiles;

if (files.length === 0) {
  console.error(`[migrate] no migration files found${fileFilter ? ` matching "${fileFilter}"` : ''}`);
  process.exit(1);
}

/* ── database connection ─────────────────────────────────────── */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[migrate] DATABASE_URL is not set. Aborting.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
});

/* ── main ────────────────────────────────────────────────────── */
interface MigrationResult {
  file: string;
  status: 'applied' | 'skipped' | 'failed';
  error?: string;
  durationMs?: number;
}

async function main(): Promise<void> {
  const results: MigrationResult[] = [];

  console.log(`[migrate] DATABASE_URL host = ${new URL(databaseUrl!).hostname}`);
  console.log(`[migrate] migrations dir    = ${MIGRATIONS_DIR}`);
  console.log(`[migrate] files found       = ${files.length}`);
  console.log(`[migrate] dry-run           = ${dryRun}`);
  console.log('');

  // Ensure schema_migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      "appliedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);

  // Get list of already-applied migrations
  const applied = await pool.query<{ name: string }>(
    'SELECT name FROM schema_migrations ORDER BY name',
  );
  const appliedSet = new Set(applied.rows.map((r) => r.name));

  console.log(`[migrate] already applied: ${appliedSet.size}`);
  if (appliedSet.size > 0) {
    for (const name of [...appliedSet].sort()) {
      console.log(`  ✓ ${name}`);
    }
  }
  console.log('');

  if (statusOnly) {
    const pending = files.filter((f) => !appliedSet.has(f));
    console.log(`[migrate] pending migrations: ${pending.length}`);
    for (const f of pending) {
      console.log(`  ○ ${f}`);
    }
    await pool.end();
    return;
  }

  // Apply pending migrations
  let appliedCount = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      results.push({ file, status: 'skipped' });
      continue;
    }

    if (dryRun) {
      console.log(`[migrate] WOULD APPLY: ${file}`);
      results.push({ file, status: 'applied' });
      continue;
    }

    const sqlPath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const start = Date.now();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (name) VALUES ($1)',
        [file],
      );
      await client.query('COMMIT');
      const durationMs = Date.now() - start;
      console.log(`[migrate] ✓ applied ${file} (${durationMs}ms)`);
      results.push({ file, status: 'applied', durationMs });
      appliedCount++;
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      const durationMs = Date.now() - start;
      const msg = err.message?.substring(0, 200) ?? String(err);
      console.error(`[migrate] ✗ FAILED ${file} (${durationMs}ms): ${msg}`);
      results.push({ file, status: 'failed', error: msg, durationMs });
    } finally {
      client.release();
    }
  }

  // Summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  const appliedList = results.filter((r) => r.status === 'applied');
  const skippedList = results.filter((r) => r.status === 'skipped');
  const failedList = results.filter((r) => r.status === 'failed');

  if (appliedList.length > 0) {
    console.log(`  Applied : ${appliedList.length}`);
    for (const r of appliedList) {
      console.log(`    ✓ ${r.file} (${r.durationMs}ms)`);
    }
  }
  if (skippedList.length > 0) {
    console.log(`  Skipped : ${skippedList.length} (already applied)`);
  }
  if (failedList.length > 0) {
    console.log(`  Failed  : ${failedList.length}`);
    for (const r of failedList) {
      console.log(`    ✗ ${r.file}: ${r.error}`);
    }
  }
  console.log('═══════════════════════════════════════════════════════');

  await pool.end();

  if (failedList.length > 0) {
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error('[migrate] fatal error:', err);
  await pool.end();
  process.exit(1);
});
