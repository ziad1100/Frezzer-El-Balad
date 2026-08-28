import { query, withTransaction } from './index';
import { ApiError } from '../utils/ApiError';

export interface PurchaseInput {
  productId: string;
  sizeId?: string | null;
  productName: string;
  productSize: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplier: string;
  notes: string;
  purchaseDate: string;
  createdBy: string;
  // Weight system
  weightGrams?: number;
  weightMode?: 'fixed' | 'custom';
  weightDisplay?: string;
  categoryId?: string | null;
}

interface Page<T> {
  items: T[];
  total: number;
  pages: number;
}

const toPage = <T>(rows: Array<Record<string, unknown>>, limit: number): Page<T> => {
  const total = rows[0] ? (rows[0].__total as number) : 0;
  const items = rows.map(({ __total, ...rest }) => rest) as unknown as T[];
  return { items, total, pages: Math.max(1, Math.ceil(total / limit)) };
};

/**
 * Core purchase columns that always exist (migration 004).
 * Safe to query even if migration 006 (weight columns) hasn't been applied.
 */
const PURCHASE_COLS = `
  pu.id::text AS "_id",
  pu."productId"::text AS "productId",
  pu."productName",
  pu."productSize",
  pu.quantity,
  pu."unitCost"::float8 AS "unitCost",
  pu."totalCost"::float8 AS "totalCost",
  pu.supplier,
  pu.notes,
  pu."purchaseDate",
  pu."createdAt",
  jsonb_build_object('_id', u.id::text, 'fullName', u."fullName") AS "createdBy"
`;

/**
 * Try extended query first (with weight columns from migration 006),
 * fall back to base query if columns don't exist.
 *
 * IMPORTANT: whereParams must contain ONLY the WHERE-clause parameters.
 * limit and offset are appended separately to avoid placeholder index bugs.
 */
async function queryPurchases(
  selectCols: string,
  whereClause: string,
  whereParams: unknown[],
  limit: number,
  offset: number,
): Promise<{ rows: Array<Record<string, unknown>>; usedExtended: boolean }> {
  const allParams = [...whereParams, limit, offset];
  const limitIdx = whereParams.length + 1;
  const offsetIdx = whereParams.length + 2;

  // Try with extended columns first
  try {
    const rows = await query(
      `SELECT count(*) OVER()::int AS __total, ${selectCols}
       FROM purchases pu
       LEFT JOIN users u ON u.id = pu."createdBy"
       ${whereClause}
       ORDER BY pu."purchaseDate" DESC, pu.id
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      allParams,
    ) as unknown as Array<Record<string, unknown>>;
    return { rows, usedExtended: true };
  } catch (err) {
    // Extended columns may not exist — fall back to base columns
    try {
      const rows = await query(
        `SELECT count(*) OVER()::int AS __total, ${PURCHASE_COLS}
         FROM purchases pu
         LEFT JOIN users u ON u.id = pu."createdBy"
         ${whereClause}
         ORDER BY pu."purchaseDate" DESC, pu.id
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        allParams,
      ) as unknown as Array<Record<string, unknown>>;
      return { rows, usedExtended: false };
    } catch (innerErr) {
      console.error('[purchases] queryPurchases fallback also failed:', innerErr);
      throw innerErr;
    }
  }
}

/**
 * Create a new purchase record and increase inventory stock.
 *
 * STRATEGY: We split this into two phases to maximize resilience:
 * Phase 1: Insert the purchase record (the essential operation)
 * Phase 2: Update inventory (best-effort — failure here must NOT roll back the purchase)
 *
 * This ensures the purchase is ALWAYS saved even if inventory columns
 * are missing from the database (e.g., migration 003 not applied).
 */
export const createPurchase = async (data: PurchaseInput): Promise<Record<string, unknown>> => {
  let purchaseId = '';

  // ── Phase 1: Insert the purchase record ──────────────────────────────────
  try {
    // Try inserting with all columns (including weight columns from migration 006)
    try {
      const inserted = await query<{ id: string }>(
        `INSERT INTO purchases ("productId", "sizeId", "productName", "productSize",
           "weightGrams", "weightMode", "weightDisplay", "categoryId",
           quantity, "unitCost", "totalCost", supplier, notes, "purchaseDate", "createdBy")
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::uuid)
         RETURNING id`,
        [
          data.productId, data.sizeId || null, data.productName, data.productSize,
          data.weightGrams ?? 0, data.weightMode ?? 'fixed', data.weightDisplay ?? '',
          data.categoryId || null,
          data.quantity, data.unitCost, data.totalCost,
          data.supplier, data.notes, data.purchaseDate, data.createdBy,
        ],
      );
      purchaseId = inserted[0].id;
    } catch {
      // Weight columns may not exist — fall back to base columns (migration 004 only)
      const inserted = await query<{ id: string }>(
        `INSERT INTO purchases ("productId", "sizeId", "productName", "productSize",
           quantity, "unitCost", "totalCost", supplier, notes, "purchaseDate", "createdBy")
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid)
         RETURNING id`,
        [
          data.productId, data.sizeId || null, data.productName, data.productSize,
          data.quantity, data.unitCost, data.totalCost,
          data.supplier, data.notes, data.purchaseDate, data.createdBy,
        ],
      );
      purchaseId = inserted[0].id;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[purchases] Phase 1 INSERT failed:', message);
    if (message.includes('relation "purchases" does not exist')) {
      throw new ApiError(500, 'Purchases table does not exist. Please run migration 004.');
    }
    if (message.includes('foreign key constraint')) {
      throw new ApiError(400, 'Invalid product or size ID. Please select a valid product.');
    }
    if (message.includes('duplicate key')) {
      throw new ApiError(409, 'This purchase already exists.');
    }
    throw new ApiError(500, `Failed to create purchase: ${message}`);
  }

  // ── Phase 2: Update inventory (best-effort — must NOT fail the purchase) ─
  try {
    if (data.sizeId) {
      await query(
        `UPDATE product_sizes SET "stockQuantity" = COALESCE("stockQuantity", 0) + $1 WHERE id = $2::uuid`,
        [data.quantity, data.sizeId],
      );
    } else {
      await query(
        `UPDATE products SET "stockQuantity" = COALESCE("stockQuantity", 0) + $1 WHERE id = $2::uuid`,
        [data.quantity, data.productId],
      );
    }
  } catch {
    // stockQuantity column may not exist (migration 003 not applied)
    // or product_sizes table may be missing — purchase is still saved
    console.error('[purchases] inventory update failed (purchase was still saved), purchaseId:', purchaseId);
  }

  // ── Phase 3: Return the created purchase ─────────────────────────────────
  try {
    // Use query() directly for a single-row lookup — avoids queryPurchases complexity
    const extendedRows = await query(
      `SELECT ${PURCHASE_COLS},
              COALESCE(pu."weightGrams", 0) AS "weightGrams",
              COALESCE(pu."weightMode", 'fixed') AS "weightMode",
              COALESCE(pu."weightDisplay", '') AS "weightDisplay"
       FROM purchases pu
       LEFT JOIN users u ON u.id = pu."createdBy"
       WHERE pu.id = $1::uuid
       LIMIT 1`,
      [purchaseId],
    );
    if (extendedRows.length > 0) return extendedRows[0];
  } catch {
    // Weight columns may not exist — try base columns
  }

  try {
    // Fallback: base columns only
    const baseRows = await query(
      `SELECT ${PURCHASE_COLS}
       FROM purchases pu
       LEFT JOIN users u ON u.id = pu."createdBy"
       WHERE pu.id = $1::uuid
       LIMIT 1`,
      [purchaseId],
    );
    if (baseRows.length > 0) return baseRows[0];
  } catch {
    // Even base query failed — return minimal data
  }

  // Ultimate fallback: return what we know
  return {
    _id: purchaseId,
    productId: data.productId,
    productName: data.productName,
    productSize: data.productSize,
    quantity: data.quantity,
    unitCost: data.unitCost,
    totalCost: data.totalCost,
    supplier: data.supplier,
    notes: data.notes,
    purchaseDate: data.purchaseDate,
  };
};

/** List purchases with pagination and optional date range filter. */
export const listPurchases = async (
  page: number,
  limit: number,
  startDate?: string,
  endDate?: string,
  productId?: string,
): Promise<Page<Record<string, unknown>>> => {
  const conds: string[] = [];
  const values: unknown[] = [];
  const nxt = () => values.length;

  if (startDate) { values.push(startDate); conds.push(`pu."purchaseDate" >= $${nxt()}::timestamptz`); }
  if (endDate) { values.push(endDate); conds.push(`pu."purchaseDate" <= $${nxt()}::timestamptz`); }
  if (productId) { values.push(productId); conds.push(`pu."productId" = $${nxt()}::uuid`); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  // Try extended columns first, fall back to base columns
  const extendedCols = PURCHASE_COLS + `, COALESCE(pu."weightGrams", 0) AS "weightGrams",
    COALESCE(pu."weightMode", 'fixed') AS "weightMode",
    COALESCE(pu."weightDisplay", '') AS "weightDisplay"`;

  try {
    const result = await queryPurchases(extendedCols, where, values, limit, offset);
    return toPage(result.rows, limit);
  } catch {
    // purchases table may not exist yet in production
    console.error('[purchases] listPurchases failed — purchases table may not exist');
    return { items: [], total: 0, pages: 1 };
  }
};

/** Delete a purchase and decrease inventory stock. */
export const deletePurchase = async (id: string): Promise<boolean> => {
  let deleted = false;

  try {
    await withTransaction(async (tx) => {
      // Get the purchase before deleting
      const result = await tx.query(
        `SELECT "productId", "sizeId", quantity FROM purchases WHERE id = $1::uuid`,
        [id],
      );
      const rows = result.rows as Array<{ productId: string; sizeId: string | null; quantity: number }>;

      if (rows.length === 0) throw new ApiError(404, 'Purchase not found');
      const purchase = rows[0];

      // Decrease inventory stock (best-effort)
      try {
        if (purchase.sizeId) {
          await tx.query(
            `UPDATE product_sizes SET "stockQuantity" = GREATEST(0, "stockQuantity" - $1) WHERE id = $2::uuid`,
            [purchase.quantity, purchase.sizeId],
          );
        } else {
          await tx.query(
            `UPDATE products SET "stockQuantity" = GREATEST(0, "stockQuantity" - $1) WHERE id = $2::uuid`,
            [purchase.quantity, purchase.productId],
          );
        }
      } catch {
        console.error('[purchases] inventory decrease failed during delete (purchase still deleted)');
      }

      // Delete the purchase record
      const deleteResult = await tx.query(`DELETE FROM purchases WHERE id = $1::uuid`, [id]);
      deleted = (deleteResult.rowCount ?? 0) > 0;
    });

    return deleted;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error('[purchases] deletePurchase failed:', err);
    throw new ApiError(500, 'Failed to delete purchase');
  }
};

/** Get purchase statistics for a date range. */
export const getPurchaseStats = async (
  startDate?: string,
  endDate?: string,
): Promise<{
  totalCost: number;
  totalQuantity: number;
  purchaseCount: number;
  byProduct: Array<{
    productId: string;
    productName: string;
    productSize: string;
    totalQuantity: number;
    totalCost: number;
  }>;
}> => {
  const conds: string[] = [];
  const values: unknown[] = [];
  const nxt = () => values.length;

  if (startDate) { values.push(startDate); conds.push(`"purchaseDate" >= $${nxt()}::timestamptz`); }
  if (endDate) { values.push(endDate); conds.push(`"purchaseDate" <= $${nxt()}::timestamptz`); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  let rows: Array<{ totalCost: number; totalQuantity: number; purchaseCount: number }> = [];
  try {
    rows = await query<{
      totalCost: number;
      totalQuantity: number;
      purchaseCount: number;
    }>(
      `SELECT
         COALESCE(SUM("totalCost"), 0)::float8 AS "totalCost",
         COALESCE(SUM(quantity), 0)::int AS "totalQuantity",
         count(*)::int AS "purchaseCount"
       FROM purchases ${where}`,
      values,
    );
  } catch {
    console.error('[purchases] getPurchaseStats main query failed');
    return { totalCost: 0, totalQuantity: 0, purchaseCount: 0, byProduct: [] };
  }

  let byProduct: Array<{
    productId: string;
    productName: string;
    productSize: string;
    totalQuantity: number;
    totalCost: number;
  }> = [];
  try {
    byProduct = await query<{
      productId: string;
      productName: string;
      productSize: string;
      totalQuantity: number;
      totalCost: number;
    }>(
      `SELECT "productId"::text AS "productId", "productName", "productSize",
              SUM(quantity)::int AS "totalQuantity",
              SUM("totalCost")::float8 AS "totalCost"
       FROM purchases ${where}
       GROUP BY "productId", "productName", "productSize"
       ORDER BY "totalCost" DESC`,
      values,
    );
  } catch {
    byProduct = [];
  }

  return {
    totalCost: rows[0]?.totalCost ?? 0,
    totalQuantity: rows[0]?.totalQuantity ?? 0,
    purchaseCount: rows[0]?.purchaseCount ?? 0,
    byProduct,
  };
};

/** Get product-level report: sales + purchases + current stock. */
export const getProductReport = async (productId: string): Promise<{
  product: { _id: string; name: string; nameEn: string; basePrice: number; stockQuantity: number };
  sales: { quantity: number; revenue: number };
  purchases: { quantity: number; cost: number };
} | null> => {
  const productRows = await query<{
    _id: string; name: string; nameEn: string; basePrice: number; stockQuantity: number;
  }>(
    `SELECT id::text AS "_id", name, "nameEn", "basePrice"::float8 AS "basePrice", COALESCE("stockQuantity", 0) AS "stockQuantity"
     FROM products WHERE id = $1::uuid`,
    [productId],
  );

  if (productRows.length === 0) return null;
  const product = productRows[0];

  const salesRows = await query<{ quantity: number; revenue: number }>(
    `SELECT COALESCE(SUM(oi.qty), 0)::int AS "quantity",
            COALESCE(SUM(oi."lineTotal"), 0)::float8 AS "revenue"
     FROM order_items oi
     JOIN orders o ON o.id = oi."orderId"
     WHERE oi."productId" = $1::uuid
       AND o.status IN ('confirmed', 'preparing', 'ready_for_delivery', 'on_delivery', 'completed')`,
    [productId],
  );

  let purchaseRows = [{ quantity: 0, cost: 0 }];
  try {
    purchaseRows = await query<{ quantity: number; cost: number }>(
      `SELECT COALESCE(SUM(quantity), 0)::int AS "quantity",
              COALESCE(SUM("totalCost"), 0)::float8 AS "cost"
       FROM purchases WHERE "productId" = $1::uuid`,
      [productId],
    );
  } catch {
    // purchases table may not exist
  }

  return {
    product,
    sales: salesRows[0] ?? { quantity: 0, revenue: 0 },
    purchases: purchaseRows[0] ?? { quantity: 0, cost: 0 },
  };
};
