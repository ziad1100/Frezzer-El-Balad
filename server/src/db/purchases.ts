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

/** Create a new purchase record and increase inventory stock. */
export const createPurchase = async (data: PurchaseInput): Promise<Record<string, unknown>> => {
  let purchaseId = '';

  await withTransaction(async (tx) => {
    // Insert purchase record
    const inserted = await tx.query<{ id: string }>(
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
    purchaseId = inserted.rows[0].id;

    // Increase inventory stock
    if (data.sizeId) {
      await tx.query(
        `UPDATE product_sizes SET "stockQuantity" = "stockQuantity" + $1 WHERE id = $2::uuid`,
        [data.quantity, data.sizeId],
      );
    } else {
      await tx.query(
        `UPDATE products SET "stockQuantity" = "stockQuantity" + $1 WHERE id = $2::uuid`,
        [data.quantity, data.productId],
      );
    }
  });

  // Return the created purchase
  const rows = await query(
    `SELECT ${PURCHASE_COLS}
     FROM purchases pu
     LEFT JOIN users u ON u.id = pu."createdBy"
     WHERE pu.id = $1::uuid`,
    [purchaseId],
  );
  return rows[0];
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

  const rows = (await query(
    `SELECT count(*) OVER()::int AS __total, ${PURCHASE_COLS}
     FROM purchases pu
     LEFT JOIN users u ON u.id = pu."createdBy"
     ${where}
     ORDER BY pu."purchaseDate" DESC, pu.id
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit],
  )) as unknown as Array<Record<string, unknown>>;

  return toPage(rows, limit);
};

/** Delete a purchase and decrease inventory stock. */
export const deletePurchase = async (id: string): Promise<boolean> => {
  let deleted = false;

  await withTransaction(async (tx) => {
    // Get the purchase before deleting
    const result = await tx.query(
      `SELECT "productId", "sizeId", quantity FROM purchases WHERE id = $1::uuid`,
      [id],
    );
    const rows = result.rows as Array<{ productId: string; sizeId: string | null; quantity: number }>;

    if (rows.length === 0) throw new ApiError(404, 'Purchase not found');
    const purchase = rows[0];

    // Decrease inventory stock
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

    // Delete the purchase record
    const deleteResult = await tx.query(`DELETE FROM purchases WHERE id = $1::uuid`, [id]);
    deleted = (deleteResult.rowCount ?? 0) > 0;
  });

  return deleted;
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

  const rows = await query<{
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

  const byProduct = await query<{
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
    `SELECT id::text AS "_id", name, "nameEn", "basePrice"::float8 AS "basePrice", "stockQuantity"
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

  const purchaseRows = await query<{ quantity: number; cost: number }>(
    `SELECT COALESCE(SUM(quantity), 0)::int AS "quantity",
            COALESCE(SUM("totalCost"), 0)::float8 AS "cost"
     FROM purchases WHERE "productId" = $1::uuid`,
    [productId],
  );

  return {
    product,
    sales: salesRows[0] ?? { quantity: 0, revenue: 0 },
    purchases: purchaseRows[0] ?? { quantity: 0, cost: 0 },
  };
};
