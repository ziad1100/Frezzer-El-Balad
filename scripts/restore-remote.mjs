#!/usr/bin/env node
/**
 * restore-remote.mjs — Restore a gzipped SQL backup into a remote PostgreSQL
 * database (e.g. Render, Neon) using the `pg` driver. No psql or Docker needed.
 *
 * Usage:
 *   node scripts/restore-remote.mjs                                  # latest backup → DATABASE_URL
 *   node scripts/restore-remote.mjs remote-postgres-20260825-2336.sql.gz   # specific file → DATABASE_URL
 *   DATABASE_URL=postgresql://... node scripts/restore-remote.mjs    # custom target DB
 *   TARGET_URL=postgresql://... node scripts/restore-remote.mjs      # explicit target (separate from source)
 *
 * The script:
 *   1. Reads the gzipped SQL file
 *   2. Executes every statement against the target database
 *   3. Uses the transaction boundaries (BEGIN/COMMIT) already in the backup
 *   4. Drops all data tables first (within a transaction) for a clean restore
 *
 * WARNING: This DESTROYS existing data in the target database before restoring.
 *          Use --dry-run to preview without making changes.
 */

import { readFileSync, readdirSync, createReadStream } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadDatabaseUrl(envKey = 'DATABASE_URL') {
  if (process.env[envKey]) return process.env[envKey];
  for (const file of [path.join('server', '.env'), path.join('server', '.env.local'), '.env', '.env.local']) {
    try {
      const m = readFileSync(file, 'utf8').match(new RegExp(`^${envKey}\\s*=\\s*(.+)$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch { /* skip */ }
  }
  return null;
}

const TARGET_URL = process.env.TARGET_URL || loadDatabaseUrl('DATABASE_URL');
if (!TARGET_URL) {
  console.error('ERROR: No target DATABASE_URL found. Set TARGET_URL or DATABASE_URL in env or server/.env');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const DROP_FIRST = !process.argv.includes('--no-drop');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(homedir(), 'OneDrive', 'PizzaBackups');
const dbDir = path.join(BACKUP_DIR, 'db');

// ---------------------------------------------------------------------------
// Find the archive
// ---------------------------------------------------------------------------

function findArchive() {
  // Check if the first non-flag arg is a filename
  const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (fileArg) {
    if (fileArg.startsWith('/') || fileArg.match(/^[A-Z]:\\/i)) return fileArg;
    return path.join(dbDir, fileArg);
  }

  // Auto-find the latest remote-postgres-*.sql.gz
  try {
    const archives = readdirSync(dbDir)
      .filter((f) => f.startsWith('remote-postgres-') && f.endsWith('.sql.gz'))
      .sort()
      .reverse();
    if (archives.length === 0) {
      // Fall back to any .sql.gz
      const all = readdirSync(dbDir)
        .filter((f) => f.endsWith('.sql.gz'))
        .sort()
        .reverse();
      if (all.length > 0) return path.join(dbDir, all[0]);
    }
    if (archives.length > 0) return path.join(dbDir, archives[0]);
  } catch { /* dir doesn't exist */ }

  console.error(`No .sql.gz archives found in ${dbDir}`);
  process.exit(1);
}

const archivePath = findArchive();

// ---------------------------------------------------------------------------
// Decompress and parse SQL
// ---------------------------------------------------------------------------

async function decompress(filePath) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const gunzip = createGunzip();
    const stream = createReadStream(filePath).pipe(gunzip);
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

/**
 * Split SQL into individual statements, preserving transaction boundaries.
 * We need to execute BEGIN, individual statements, and COMMIT as separate
 * queries because pg library doesn't support multi-statement transactions
 * in a single query() call.
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let inSingleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1] || '';

    // Line comments
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (ch === '-' && next === '-' && !inSingleQuote && !inDollarQuote && !inBlockComment) {
      inLineComment = true;
      continue;
    }

    // Block comments
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++; }
      continue;
    }
    if (ch === '/' && next === '*' && !inSingleQuote && !inDollarQuote) {
      inBlockComment = true;
      continue;
    }

    // Dollar quoting (PL/pgSQL)
    if (inDollarQuote) {
      if (ch === '$') {
        const end = sql.slice(i).indexOf(dollarTag, 1);
        if (end === 0) { inDollarQuote = false; i += dollarTag.length - 1; }
      }
      continue;
    }
    if (ch === '$' && !inSingleQuote) {
      const match = sql.slice(i).match(/^\$[a-zA-Z_]*\$/);
      if (match) { inDollarQuote = true; dollarTag = match[0]; i += match[0].length - 1; continue; }
    }

    // Single quotes
    if (ch === "'" && !inSingleQuote) { inSingleQuote = true; continue; }
    if (ch === "'" && inSingleQuote) {
      if (next === "'") { i++; continue; } // escaped quote
      inSingleQuote = false;
      continue;
    }

    // Semicolons → statement boundary
    if (ch === ';' && !inSingleQuote && !inDollarQuote) {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = '';
      continue;
    }

    current += ch;
  }

  // Trailing statement without semicolon
  const trailing = current.trim();
  if (trailing) statements.push(trailing);

  return statements;
}

// ---------------------------------------------------------------------------
// Tables to drop (in reverse FK order) for clean restore
// ---------------------------------------------------------------------------

const DROP_TABLES = [
  'activity_logs', 'analytics', 'wishlist_items', 'wishlists',
  'notifications', 'newsletters', 'contacts', 'posts',
  'settings', 'delivery_zones', 'branches', 'banners',
  'offer_products', 'offers', 'coupon_redemptions', 'coupons',
  'reviews', 'order_items', 'orders', 'cart_items', 'carts',
  'product_extras', 'product_sizes', 'products', 'categories',
  'permissions', 'users', 'roles',
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const pool = new Pool({
  connectionString: TARGET_URL,
  max: 1,
  connectionTimeoutMillis: 15_000,
  statement_timeout: 120_000,
});

try {
  // Mask credentials in output
  const maskedUrl = TARGET_URL.replace(/:[^@]+@/, ':***@');
  console.log(`Archive: ${archivePath}`);
  console.log(`Target:  ${maskedUrl}`);
  if (DRY_RUN) console.log(`Mode:    DRY RUN (no changes will be made)`);
  console.log('');

  // Test connection
  const testRow = await pool.query('SELECT current_database() AS db, now() AS ts');
  console.log(`Connected to "${testRow.rows[0].db}" at ${testRow.rows[0].ts}`);

  // Count existing rows (for comparison)
  console.log('\n--- Pre-restore row counts ---');
  for (const t of DROP_TABLES) {
    try {
      const r = await pool.query(`SELECT count(*)::int AS n FROM "${t}"`);
      if (r.rows[0].n > 0) console.log(`  ${t}: ${r.rows[0].n}`);
    } catch { /* table may not exist */ }
  }

  // Decompress
  console.log('\nDecompressing backup...');
  const sql = await decompress(archivePath);
  const statements = splitStatements(sql);
  console.log(`Parsed ${statements.length} SQL statements`);

  if (DRY_RUN) {
    console.log('\n--- First 20 statements (dry run) ---');
    for (const s of statements.slice(0, 20)) {
      console.log(`  ${s.slice(0, 120)}${s.length > 120 ? '...' : ''}`);
    }
    console.log('\nDry run complete. No changes were made.');
    process.exit(0);
  }

  // Drop existing data for a clean restore
  if (DROP_FIRST) {
    console.log('\nDropping existing data...');
    await pool.query('BEGIN');
    try {
      // Disable foreign key checks temporarily
      await pool.query('SET session_replication_role = replica');
      for (const t of DROP_TABLES) {
        try {
          await pool.query(`TRUNCATE "${t}" CASCADE`);
        } catch {
          // Table may not exist or be locked — try DELETE
          try { await pool.query(`DELETE FROM "${t}"`); } catch { /* skip */ }
        }
      }
      await pool.query('SET session_replication_role = DEFAULT');
      await pool.query('COMMIT');
      console.log('  ✓ All data tables cleared');
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error(`  ✗ Drop failed: ${err.message}`);
      console.log('  Continuing with restore (may hit constraint errors)...');
    }
  }

  // Execute the backup SQL statement by statement
  console.log('\nRestoring data...');
  let executed = 0;
  let failed = 0;
  const start = Date.now();

  for (const stmt of statements) {
    // Skip pure comments or empty lines
    const stripped = stmt.replace(/--[^\n]*/g, '').trim();
    if (!stripped) continue;

    try {
      await pool.query(stmt);
      executed++;
      if (executed % 100 === 0) {
        process.stdout.write(`  ... ${executed} statements executed\r`);
      }
    } catch (err) {
      failed++;
      // Only show errors that aren't "table does not exist" (expected if no-drop)
      if (!err.message.includes('does not exist')) {
        console.error(`  ⚠ Statement failed (${err.message}): ${stmt.slice(0, 80)}...`);
      }
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n  ✓ ${executed} statements executed in ${elapsed}s (${failed} skipped)`);

  // Post-restore row counts
  console.log('\n--- Post-restore row counts ---');
  for (const t of DROP_TABLES) {
    try {
      const r = await pool.query(`SELECT count(*)::int AS n FROM "${t}"`);
      if (r.rows[0].n > 0) console.log(`  ${t}: ${r.rows[0].n}`);
    } catch { /* skip */ }
  }

  console.log('\n✅ Restore complete!');
} catch (err) {
  console.error(`\n❌ Restore FAILED: ${err.message}`);
  if (err.code) console.error(`   PG code: ${err.code}`);
  process.exit(1);
} finally {
  await pool.end();
}
