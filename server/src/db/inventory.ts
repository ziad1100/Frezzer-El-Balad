import { query, withTransaction, type ReadClient } from './index';
import { ApiError } from '../utils/ApiError';

/**
 * Get stock for a product size (if product has sizes) or product itself.
 * Returns { stockQuantity, lowStockThreshold, trackInventory }.
 */
export const getStock = async (productId: string, sizeId?: string | null): Promise<{
  stockQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
} | null> => {
  if (sizeId) {
    const rows = await query(
      `SELECT ps."stockQuantity", ps."lowStockThreshold", p."trackInventory"
       FROM product_sizes ps
       JOIN products p ON p.id = ps."productId"
       WHERE ps.id = $1::uuid AND ps."productId" = $2::uuid`,
      [sizeId, productId],
    ) as Array<{ stockQuantity: number; lowStockThreshold: number; trackInventory: boolean }>;
    return rows[0] ?? null;
  }
  const rows = await query(
    `SELECT "stockQuantity", "lowStockThreshold", "trackInventory"
     FROM products WHERE id = $1::uuid`,
    [productId],
  ) as Array<{ stockQuantity: number; lowStockThreshold: number; trackInventory: boolean }>;
  return rows[0] ?? null;
};

/**
 * Update stock quantity for a product or product size.
 * Admin can manually set stock from the product management interface.
 */
export const updateStock = async (
  productId: string,
  stockQuantity: number,
  sizeId?: string | null,
): Promise<void> => {
  if (sizeId) {
    await query(
      `UPDATE product_sizes SET "stockQuantity" = $1 WHERE id = $2::uuid AND "productId" = $3::uuid`,
      [stockQuantity, sizeId, productId],
    );
  } else {
    await query(
      `UPDATE products SET "stockQuantity" = $1 WHERE id = $2::uuid`,
      [stockQuantity, productId],
    );
  }
};

/**
 * Enable/disable inventory tracking for a product.
 */
export const setTrackInventory = async (productId: string, track: boolean): Promise<void> => {
  await query(
    `UPDATE products SET "trackInventory" = $1 WHERE id = $2::uuid`,
    [track, productId],
  );
};

/**
 * Deduct stock for order items. Called when order is confirmed.
 * Uses idempotency via stock_deductions table to prevent double deduction.
 * Returns the number of items successfully deducted.
 */
export const deductStock = async (
  orderId: string,
  orderItems: Array<{
    id: string;
    productId: string;
    sizeName: string;
    qty: number;
  }>,
): Promise<number> => {
  let deductedCount = 0;

  await withTransaction(async (tx: ReadClient) => {
    for (const item of orderItems) {
      // Check if already deducted (idempotency)
      const existing = await tx.query<{ id: string }>(
        `SELECT id FROM stock_deductions WHERE "orderItemId" = $1::uuid AND type = 'deduct'`,
        [item.id],
      );
      if (existing.rows.length > 0) continue;

      // Find the size ID if product has sizes
      let sizeId: string | null = null;
      if (item.sizeName) {
        const sizeRow = await tx.query<{ id: string }>(
          `SELECT id FROM product_sizes WHERE "productId" = $1::uuid AND name = $2 LIMIT 1`,
          [item.productId, item.sizeName],
        );
        sizeId = sizeRow.rows[0]?.id ?? null;
      }

      // Check if tracking is enabled
      const stockInfo = await getStockForDeduction(tx, item.productId, sizeId);
      if (!stockInfo?.trackInventory) continue;

      // Check available stock
      if (stockInfo.stockQuantity < item.qty) {
        throw new ApiError(
          400,
          `Insufficient stock for product. Available: ${stockInfo.stockQuantity}, Requested: ${item.qty}`,
        );
      }

      // Deduct stock
      if (sizeId) {
        await tx.query(
          `UPDATE product_sizes SET "stockQuantity" = "stockQuantity" - $1 WHERE id = $2::uuid`,
          [item.qty, sizeId],
        );
      } else {
        await tx.query(
          `UPDATE products SET "stockQuantity" = "stockQuantity" - $1 WHERE id = $2::uuid`,
          [item.qty, item.productId],
        );
      }

      // Record deduction
      await tx.query(
        `INSERT INTO stock_deductions ("orderId", "orderItemId", "productId", "sizeId", quantity, type)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, 'deduct')
         ON CONFLICT ("orderItemId", type) DO NOTHING`,
        [orderId, item.id, item.productId, sizeId, item.qty],
      );

      deductedCount++;
    }
  });

  return deductedCount;
};

/**
 * Restore stock for order items. Called when order is cancelled/refunded.
 * Uses idempotency to prevent double restoration.
 */
export const restoreStock = async (
  orderId: string,
  orderItems: Array<{
    id: string;
    productId: string;
    sizeName: string;
    qty: number;
  }>,
): Promise<number> => {
  let restoredCount = 0;

  await withTransaction(async (tx: ReadClient) => {
    for (const item of orderItems) {
      // Check if already restored (idempotency)
      const existing = await tx.query<{ id: string }>(
        `SELECT id FROM stock_deductions WHERE "orderItemId" = $1::uuid AND type = 'restore'`,
        [item.id],
      );
      if (existing.rows.length > 0) continue;

      // Check if this item was actually deducted
      const deduction = await tx.query<{ quantity: number }>(
        `SELECT quantity FROM stock_deductions WHERE "orderItemId" = $1::uuid AND type = 'deduct'`,
        [item.id],
      );
      if (deduction.rows.length === 0) continue;

      // Find the size ID if product has sizes
      let sizeId: string | null = null;
      if (item.sizeName) {
        const sizeRow = await tx.query<{ id: string }>(
          `SELECT id FROM product_sizes WHERE "productId" = $1::uuid AND name = $2 LIMIT 1`,
          [item.productId, item.sizeName],
        );
        sizeId = sizeRow.rows[0]?.id ?? null;
      }

      // Restore stock
      const restoreQty = deduction.rows[0].quantity;
      if (sizeId) {
        await tx.query(
          `UPDATE product_sizes SET "stockQuantity" = "stockQuantity" + $1 WHERE id = $2::uuid`,
          [restoreQty, sizeId],
        );
      } else {
        await tx.query(
          `UPDATE products SET "stockQuantity" = "stockQuantity" + $1 WHERE id = $2::uuid`,
          [restoreQty, item.productId],
        );
      }

      // Record restoration
      await tx.query(
        `INSERT INTO stock_deductions ("orderId", "orderItemId", "productId", "sizeId", quantity, type)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, 'restore')
         ON CONFLICT ("orderItemId", type) DO NOTHING`,
        [orderId, item.id, item.productId, sizeId, restoreQty],
      );

      restoredCount++;
    }
  });

  return restoredCount;
};

/** Helper to get stock info inside a transaction */
const getStockForDeduction = async (
  tx: ReadClient,
  productId: string,
  sizeId: string | null,
): Promise<{ stockQuantity: number; trackInventory: boolean } | null> => {
  if (sizeId) {
    const result = await tx.query(
      `SELECT ps."stockQuantity", p."trackInventory"
       FROM product_sizes ps
       JOIN products p ON p.id = ps."productId"
       WHERE ps.id = $1::uuid`,
      [sizeId],
    );
    const row = result.rows[0] as { stockQuantity: number; trackInventory: boolean } | undefined;
    return row ?? null;
  }
  const result = await tx.query(
    `SELECT "stockQuantity", "trackInventory" FROM products WHERE id = $1::uuid`,
    [productId],
  );
  const row = result.rows[0] as { stockQuantity: number; trackInventory: boolean } | undefined;
  return row ?? null;
};

/**
 * Get inventory statistics for the admin dashboard.
 */
export const getInventoryStats = async (): Promise<{
  totalProducts: number;
  trackableProducts: number;
  totalStockQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockProducts: Array<{
    _id: string;
    name: string;
    nameEn: string;
    stockQuantity: number;
    lowStockThreshold: number;
    category: string;
    sizes: Array<{ name: string; nameEn: string; stockQuantity: number }>;
  }>;
  outOfStockProducts: Array<{
    _id: string;
    name: string;
    nameEn: string;
    stockQuantity: number;
    category: string;
    sizes: Array<{ name: string; nameEn: string; stockQuantity: number }>;
  }>;
}> => {
  // Products without sizes (track inventory at product level)
  const productStats = await query<{
    total: number;
    trackable: number;
    totalStock: number;
  }>(
    `SELECT
       count(*)::int AS "total",
       count(*) FILTER (WHERE "trackInventory" = true)::int AS "trackable",
       COALESCE(sum("stockQuantity") FILTER (WHERE "trackInventory" = true), 0)::int AS "totalStock"
     FROM products`,
  );

  // Size-level stock stats
  const sizeStats = await query<{
    totalStock: number;
  }>(
    `SELECT COALESCE(sum(ps."stockQuantity"), 0)::int AS "totalStock"
     FROM product_sizes ps
     JOIN products p ON p.id = ps."productId"
     WHERE p."trackInventory" = true`,
  );

  // Low stock products (product-level)
  const lowStockProducts = await query<{
    _id: string; name: string; nameEn: string; stockQuantity: number;
    lowStockThreshold: number; category: string;
  }>(
    `SELECT p.id::text AS "_id", p.name, p."nameEn", p."stockQuantity",
            p."lowStockThreshold",
            COALESCE(c.name, '') AS "category"
     FROM products p
     LEFT JOIN categories c ON c.id = p."categoryId"
     WHERE p."trackInventory" = true
       AND p."stockQuantity" > 0
       AND p."stockQuantity" <= p."lowStockThreshold"`,
  );

  // Out of stock products (product-level)
  const outOfStockProducts = await query<{
    _id: string; name: string; nameEn: string; stockQuantity: number;
    category: string;
  }>(
    `SELECT p.id::text AS "_id", p.name, p."nameEn", p."stockQuantity",
            COALESCE(c.name, '') AS "category"
     FROM products p
     LEFT JOIN categories c ON c.id = p."categoryId"
     WHERE p."trackInventory" = true AND p."stockQuantity" = 0`,
  );

  // Low stock sizes
  const lowStockSizes = await query<{
    productId: string; name: string; nameEn: string;
    stockQuantity: number; lowStockThreshold: number;
    productName: string; productNameEn: string; category: string;
  }>(
    `SELECT ps."productId", ps.name, ps."nameEn", ps."stockQuantity", ps."lowStockThreshold",
            p.name AS "productName", p."nameEn" AS "productNameEn",
            COALESCE(c.name, '') AS "category"
     FROM product_sizes ps
     JOIN products p ON p.id = ps."productId"
     LEFT JOIN categories c ON c.id = p."categoryId"
     WHERE p."trackInventory" = true
       AND ps."stockQuantity" > 0
       AND ps."stockQuantity" <= ps."lowStockThreshold"`,
  );

  // Out of stock sizes
  const outOfStockSizes = await query<{
    productId: string; name: string; nameEn: string;
    stockQuantity: number;
    productName: string; productNameEn: string; category: string;
  }>(
    `SELECT ps."productId", ps.name, ps."nameEn", ps."stockQuantity",
            p.name AS "productName", p."nameEn" AS "productNameEn",
            COALESCE(c.name, '') AS "category"
     FROM product_sizes ps
     JOIN products p ON p.id = ps."productId"
     LEFT JOIN categories c ON c.id = p."categoryId"
     WHERE p."trackInventory" = true AND ps."stockQuantity" = 0`,
  );

  const totalStock = (productStats[0]?.totalStock ?? 0) + (sizeStats[0]?.totalStock ?? 0);

  // Group low stock products with their sizes
  const lowStockMap = new Map<string, any>();
  for (const row of lowStockProducts) {
    lowStockMap.set(row._id, {
      _id: row._id, name: row.name, nameEn: row.nameEn,
      stockQuantity: row.stockQuantity, lowStockThreshold: row.lowStockThreshold,
      category: row.category, sizes: [],
    });
  }
  for (const row of lowStockSizes) {
    const existing = lowStockMap.get(row.productId);
    if (existing) {
      existing.sizes.push({ name: row.name, nameEn: row.nameEn, stockQuantity: row.stockQuantity });
    } else {
      lowStockMap.set(row.productId, {
        _id: row.productId, name: row.productName, nameEn: row.productNameEn,
        stockQuantity: 0, lowStockThreshold: row.lowStockThreshold,
        category: row.category,
        sizes: [{ name: row.name, nameEn: row.nameEn, stockQuantity: row.stockQuantity }],
      });
    }
  }

  // Group out of stock products with their sizes
  const outOfStockMap = new Map<string, any>();
  for (const row of outOfStockProducts) {
    outOfStockMap.set(row._id, {
      _id: row._id, name: row.name, nameEn: row.nameEn,
      stockQuantity: 0, category: row.category, sizes: [],
    });
  }
  for (const row of outOfStockSizes) {
    const existing = outOfStockMap.get(row.productId);
    if (existing) {
      existing.sizes.push({ name: row.name, nameEn: row.nameEn, stockQuantity: 0 });
    } else {
      outOfStockMap.set(row.productId, {
        _id: row.productId, name: row.productName, nameEn: row.productNameEn,
        stockQuantity: 0, category: row.category,
        sizes: [{ name: row.name, nameEn: row.nameEn, stockQuantity: 0 }],
      });
    }
  }

  return {
    totalProducts: productStats[0]?.total ?? 0,
    trackableProducts: productStats[0]?.trackable ?? 0,
    totalStockQuantity: totalStock,
    lowStockCount: lowStockMap.size,
    outOfStockCount: outOfStockMap.size,
    lowStockProducts: Array.from(lowStockMap.values()),
    outOfStockProducts: Array.from(outOfStockMap.values()),
  };
};

/**
 * Get sales/outgoing statistics.
 * Calculates total sales value and quantity from completed/confirmed orders.
 */
export const getSalesStats = async (
  startDate?: string,
  endDate?: string,
): Promise<{
  salesValue: number;
  salesQuantity: number;
  orderCount: number;
  byProduct: Array<{
    productId: string;
    productName: string;
    productSize: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
}> => {
  const conds: string[] = [
    `o.status IN ('confirmed', 'preparing', 'ready_for_delivery', 'on_delivery', 'completed')`,
  ];
  const values: unknown[] = [];
  const nxt = () => values.length;

  if (startDate) {
    values.push(startDate);
    conds.push(`o."createdAt" >= $${nxt()}::timestamptz`);
  }
  if (endDate) {
    values.push(endDate);
    conds.push(`o."createdAt" <= $${nxt()}::timestamptz`);
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const rows = await query<{
    salesValue: number;
    salesQuantity: number;
    orderCount: number;
  }>(
    `SELECT
       COALESCE(SUM(oi."lineTotal"), 0)::float8 AS "salesValue",
       COALESCE(SUM(oi.qty), 0)::int AS "salesQuantity",
       (SELECT count(DISTINCT o.id)::int FROM orders o ${where}) AS "orderCount"
     FROM order_items oi
     JOIN orders o ON o.id = oi."orderId"
     ${where}`,
    values,
  );

  const byProduct = await query<{
    productId: string;
    productName: string;
    productSize: string;
    totalQuantity: number;
    totalRevenue: number;
  }>(
    `SELECT oi."productId"::text AS "productId",
            oi.name AS "productName",
            oi.size AS "productSize",
            SUM(oi.qty)::int AS "totalQuantity",
            SUM(oi."lineTotal")::float8 AS "totalRevenue"
     FROM order_items oi
     JOIN orders o ON o.id = oi."orderId"
     ${where}
     GROUP BY oi."productId", oi.name, oi.size
     ORDER BY "totalRevenue" DESC`,
    values,
  );

  return {
    ...(rows[0] ?? { salesValue: 0, salesQuantity: 0, orderCount: 0 }),
    byProduct,
  };
};

/** Get daily product movement (sales + purchases) for a date range. */
export const getDailyProductMovement = async (
  startDate: string,
  endDate: string,
): Promise<Array<{
  date: string;
  productId: string;
  productName: string;
  productSize: string;
  soldQty: number;
  salesRevenue: number;
  purchasedQty: number;
  purchaseCost: number;
}>> => {
  // Sales by day and product
  const salesRows = await query<{
    date: string; productId: string; productName: string; productSize: string;
    soldQty: number; salesRevenue: number;
  }>(
    `SELECT o."createdAt"::date::text AS "date",
            oi."productId"::text AS "productId",
            oi.name AS "productName",
            oi.size AS "productSize",
            SUM(oi.qty)::int AS "soldQty",
            SUM(oi."lineTotal")::float8 AS "salesRevenue"
     FROM order_items oi
     JOIN orders o ON o.id = oi."orderId"
     WHERE o."createdAt" >= $1::timestamptz AND o."createdAt" <= $2::timestamptz
       AND o.status IN ('confirmed', 'preparing', 'ready_for_delivery', 'on_delivery', 'completed')
     GROUP BY o."createdAt"::date, oi."productId", oi.name, oi.size
     ORDER BY o."createdAt"::date, oi.name`,
    [startDate, endDate],
  );

  // Purchases by day and product (gracefully handle missing purchases table)
  let purchaseRows: Array<{
    date: string; productId: string; productName: string; productSize: string;
    purchasedQty: number; purchaseCost: number;
  }> = [];
  try {
    purchaseRows = await query<{
      date: string; productId: string; productName: string; productSize: string;
      purchasedQty: number; purchaseCost: number;
    }>(
      `SELECT "purchaseDate"::date::text AS "date",
              "productId"::text AS "productId",
              "productName",
              "productSize",
              SUM(quantity)::int AS "purchasedQty",
              SUM("totalCost")::float8 AS "purchaseCost"
       FROM purchases
       WHERE "purchaseDate" >= $1::timestamptz AND "purchaseDate" <= $2::timestamptz
       GROUP BY "purchaseDate"::date, "productId", "productName", "productSize"
       ORDER BY "purchaseDate"::date, "productName"`,
      [startDate, endDate],
    );
  } catch {
    // purchases table may not exist yet in production
    purchaseRows = [];
  }

  // Merge sales and purchases by date+product
  const merged = new Map<string, {
    date: string; productId: string; productName: string; productSize: string;
    soldQty: number; salesRevenue: number; purchasedQty: number; purchaseCost: number;
  }>();

  for (const s of salesRows) {
    const key = `${s.date}:${s.productId}:${s.productSize}`;
    merged.set(key, {
      date: s.date, productId: s.productId, productName: s.productName,
      productSize: s.productSize, soldQty: s.soldQty, salesRevenue: s.salesRevenue,
      purchasedQty: 0, purchaseCost: 0,
    });
  }
  for (const p of purchaseRows) {
    const key = `${p.date}:${p.productId}:${p.productSize}`;
    const existing = merged.get(key);
    if (existing) {
      existing.purchasedQty = p.purchasedQty;
      existing.purchaseCost = p.purchaseCost;
    } else {
      merged.set(key, {
        date: p.date, productId: p.productId, productName: p.productName,
        productSize: p.productSize, soldQty: 0, salesRevenue: 0,
        purchasedQty: p.purchasedQty, purchaseCost: p.purchaseCost,
      });
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date) || a.productName.localeCompare(b.productName));
};

/** Get all products with stock for export (includes products with no activity). */
export const getAllProductsWithStock = async (): Promise<Array<{
  productId: string; productName: string; productSize: string; stockQuantity: number;
}>> => {
  // Products without sizes (track inventory at product level)
  const productRows = await query<{
    productId: string; productName: string; productSize: string; stockQuantity: number;
  }>(
    `SELECT p.id::text AS "productId", p.name AS "productName", '' AS "productSize", p."stockQuantity"
     FROM products p
     WHERE p."trackInventory" = true
       AND NOT EXISTS (SELECT 1 FROM product_sizes ps WHERE ps."productId" = p.id)`,
  );

  // Products with sizes
  const sizeRows = await query<{
    productId: string; productName: string; productSize: string; stockQuantity: number;
  }>(
    `SELECT p.id::text AS "productId", p.name AS "productName",
            ps.name AS "productSize", ps."stockQuantity"
     FROM product_sizes ps
     JOIN products p ON p.id = ps."productId"
     WHERE p."trackInventory" = true`,
  );

  return [...productRows, ...sizeRows];
};
