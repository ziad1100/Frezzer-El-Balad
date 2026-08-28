import { Router } from 'express';
import { query } from '../db';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middlewares/auth';

const router = Router();
router.use(requireAuth);

/**
 * GET /purchases/_health
 * Diagnostic endpoint: checks if the purchases system is operational.
 * Returns table existence, row count, column info, and migration status.
 * Safe: no secrets, no destructive operations.
 */
router.get('/_health', asyncHandler(async (_req, res) => {
  const checks: Record<string, unknown> = {};

  // 1. Check if purchases table exists
  try {
    const tableCheck = await query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'purchases'
      ) AS "exists"`,
    );
    checks.tableExists = tableCheck[0]?.exists ?? false;
  } catch (err) {
    checks.tableExists = false;
    checks.tableError = err instanceof Error ? err.message : String(err);
  }

  // 2. Row count
  if (checks.tableExists) {
    try {
      const countResult = await query<{ count: string }>('SELECT count(*)::text AS "count" FROM purchases');
      checks.totalRows = Number(countResult[0]?.count ?? 0);
    } catch {
      checks.totalRows = 'error';
    }
  }

  // 3. Check which columns exist
  if (checks.tableExists) {
    try {
      const cols = await query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'purchases'
         ORDER BY ordinal_position`,
      );
      checks.columns = cols.map((c) => c.column_name);
    } catch {
      checks.columns = 'error';
    }
  }

  // 4. Check schema_migrations for purchase-related migrations
  try {
    const migrations = await query<{ name: string }>(
      `SELECT name FROM schema_migrations WHERE name LIKE '%purchase%' ORDER BY name`,
    );
    checks.appliedMigrations = migrations.map((m) => m.name);
  } catch {
    checks.appliedMigrations = 'error';
  }

  // 5. Check stockQuantity column on products table
  try {
    const stockCol = await query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'stockQuantity'
      ) AS "exists"`,
    );
    checks.productHasStockColumn = stockCol[0]?.exists ?? false;
  } catch {
    checks.productHasStockColumn = 'error';
  }

  const allOk = checks.tableExists === true;

  res.status(allOk ? 200 : 503).json(
    new ApiResponse(allOk ? 200 : 503, {
      status: allOk ? 'ok' : 'degraded',
      ...checks,
    }),
  );
}));

export default router;
