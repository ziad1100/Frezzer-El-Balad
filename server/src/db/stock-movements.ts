/**
 * Stock Movements DB Module
 *
 * Tracks ALL product movements: sales, purchases, gifts, returns,
 * waste, damage, stock adjustments, and other special cases.
 *
 * Each movement is an immutable historical record with:
 * - Movement type (sale, purchase, gift, return, waste, damage, adjustment, other)
 * - Quantity (positive = stock in, negative = stock out)
 * - Historical prices (never recalculate using current prices)
 * - Reference to source (order, purchase, manual adjustment)
 * - Reason and notes
 */

import { query } from './index';

export interface StockMovement {
  id: string;
  productId: string;
  sizeId: string | null;
  productName: string;
  productSize: string;
  categoryId: string | null;
  movementType: 'sale' | 'purchase' | 'gift' | 'return' | 'waste' | 'damage' | 'stock_adjustment' | 'other';
  quantity: number;
  unitSellingPrice: number | null;
  totalSellingPrice: number | null;
  unitPurchasePrice: number | null;
  totalPurchasePrice: number | null;
  referenceType: string;
  referenceId: string;
  orderNo: string;
  customerName: string;
  paymentMethod: string;
  supplier: string;
  reason: string;
  notes: string;
  movementDate: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMovementInput {
  productId: string;
  sizeId?: string | null;
  productName: string;
  productSize?: string;
  categoryId?: string | null;
  movementType: StockMovement['movementType'];
  quantity: number;
  unitSellingPrice?: number | null;
  totalSellingPrice?: number | null;
  unitPurchasePrice?: number | null;
  totalPurchasePrice?: number | null;
  referenceType?: string;
  referenceId?: string;
  orderNo?: string;
  customerName?: string;
  paymentMethod?: string;
  supplier?: string;
  reason?: string;
  notes?: string;
  movementDate?: string;
  createdBy?: string | null;
}

export interface MovementReportItem {
  productId: string;
  productName: string;
  productSize: string;
  categoryId: string | null;
  categoryName: string;
  totalPurchased: number;
  totalSold: number;
  totalReturned: number;
  totalGifted: number;
  totalWasted: number;
  totalDamaged: number;
  totalAdjusted: number;
  totalPurchaseCost: number;
  totalSalesRevenue: number;
  currentStock: number;
}

export interface MovementReportDetail {
  date: string;
  time: string;
  productName: string;
  productSize: string;
  categoryName: string;
  movementType: string;
  quantity: number;
  unitPurchasePrice: number | null;
  totalPurchasePrice: number | null;
  unitSellingPrice: number | null;
  totalSellingPrice: number | null;
  paymentMethod: string;
  orderNo: string;
  customerName: string;
  supplier: string;
  reason: string;
  notes: string;
}

/**
 * Record a stock movement.
 * Gracefully handles missing stock_movements table.
 */
export async function recordMovement(input: CreateMovementInput): Promise<StockMovement | null> {
  try {
    const rows = await query<StockMovement>(
      `INSERT INTO stock_movements (
        "productId", "sizeId", "productName", "productSize", "categoryId",
        "movementType", quantity,
        "unitSellingPrice", "totalSellingPrice",
        "unitPurchasePrice", "totalPurchasePrice",
        "referenceType", "referenceId",
        "orderNo", "customerName", "paymentMethod", "supplier",
        reason, notes, "movementDate", "createdBy"
      ) VALUES (
        $1::uuid, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      ) RETURNING *`,
      [
        input.productId, input.sizeId || null, input.productName, input.productSize || '',
        input.categoryId || null,
        input.movementType, input.quantity,
        input.unitSellingPrice ?? null, input.totalSellingPrice ?? null,
        input.unitPurchasePrice ?? null, input.totalPurchasePrice ?? null,
        input.referenceType || '', input.referenceId || '',
        input.orderNo || '', input.customerName || '', input.paymentMethod || '',
        input.supplier || '', input.reason || '', input.notes || '',
        input.movementDate || new Date().toISOString(), input.createdBy || null,
      ],
    );
    return rows[0];
  } catch {
    // stock_movements table may not exist yet
    return null;
  }
}

/**
 * Record a sale movement (from order items).
 */
export async function recordSale(params: {
  productId: string;
  sizeId?: string | null;
  productName: string;
  productSize?: string;
  categoryId?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  orderNo: string;
  customerName?: string;
  paymentMethod?: string;
  createdBy?: string | null;
}): Promise<StockMovement | null> {
  return recordMovement({
    productId: params.productId,
    sizeId: params.sizeId,
    productName: params.productName,
    productSize: params.productSize,
    categoryId: params.categoryId,
    movementType: 'sale',
    quantity: -params.quantity, // Negative = stock out
    unitSellingPrice: params.unitPrice,
    totalSellingPrice: params.lineTotal,
    referenceType: 'order',
    orderNo: params.orderNo,
    customerName: params.customerName || '',
    paymentMethod: params.paymentMethod || '',
    createdBy: params.createdBy,
  });
}

/**
 * Record a purchase movement.
 */
export async function recordPurchase(params: {
  productId: string;
  sizeId?: string | null;
  productName: string;
  productSize?: string;
  categoryId?: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplier?: string;
  createdBy?: string | null;
}): Promise<StockMovement | null> {
  return recordMovement({
    productId: params.productId,
    sizeId: params.sizeId,
    productName: params.productName,
    productSize: params.productSize,
    categoryId: params.categoryId,
    movementType: 'purchase',
    quantity: params.quantity, // Positive = stock in
    unitPurchasePrice: params.unitCost,
    totalPurchasePrice: params.totalCost,
    referenceType: 'purchase',
    supplier: params.supplier || '',
    createdBy: params.createdBy,
  });
}

/**
 * Record a gift movement.
 */
export async function recordGift(params: {
  productId: string;
  sizeId?: string | null;
  productName: string;
  productSize?: string;
  quantity: number;
  customerName?: string;
  reason?: string;
  createdBy?: string | null;
}): Promise<StockMovement | null> {
  return recordMovement({
    productId: params.productId,
    sizeId: params.sizeId,
    productName: params.productName,
    productSize: params.productSize,
    movementType: 'gift',
    quantity: -params.quantity, // Negative = stock out
    unitSellingPrice: 0,
    totalSellingPrice: 0,
    customerName: params.customerName || '',
    reason: params.reason || 'هدية للعميل',
    createdBy: params.createdBy,
  });
}

/**
 * Record a return movement.
 */
export async function recordReturn(params: {
  productId: string;
  sizeId?: string | null;
  productName: string;
  productSize?: string;
  quantity: number;
  orderNo?: string;
  customerName?: string;
  reason?: string;
  createdBy?: string | null;
}): Promise<StockMovement | null> {
  return recordMovement({
    productId: params.productId,
    sizeId: params.sizeId,
    productName: params.productName,
    productSize: params.productSize,
    movementType: 'return',
    quantity: params.quantity, // Positive = stock back in
    referenceType: 'order',
    orderNo: params.orderNo || '',
    customerName: params.customerName || '',
    reason: params.reason || '',
    createdBy: params.createdBy,
  });
}

/**
 * Record a waste/damage movement.
 */
export async function recordWaste(params: {
  productId: string;
  sizeId?: string | null;
  productName: string;
  productSize?: string;
  quantity: number;
  reason: string;
  createdBy?: string | null;
}): Promise<StockMovement | null> {
  return recordMovement({
    productId: params.productId,
    sizeId: params.sizeId,
    productName: params.productName,
    productSize: params.productSize,
    movementType: params.reason.includes('تالف') || params.reason.toLowerCase().includes('damage') ? 'damage' : 'waste',
    quantity: -params.quantity, // Negative = stock out
    reason: params.reason,
    createdBy: params.createdBy,
  });
}

/**
 * Record a manual stock adjustment.
 */
export async function recordAdjustment(params: {
  productId: string;
  sizeId?: string | null;
  productName: string;
  productSize?: string;
  quantity: number; // Can be positive (add) or negative (remove)
  reason: string;
  createdBy?: string | null;
}): Promise<StockMovement | null> {
  return recordMovement({
    productId: params.productId,
    sizeId: params.sizeId,
    productName: params.productName,
    productSize: params.productSize,
    movementType: 'stock_adjustment',
    quantity: params.quantity,
    reason: params.reason,
    createdBy: params.createdBy,
  });
}

/**
 * Get comprehensive item-by-item movement report for a date range.
 * Gracefully handles missing stock_movements table.
 */
export async function getMovementReport(
  startDate: string,
  endDate: string,
): Promise<{
  summary: MovementReportItem[];
  details: MovementReportDetail[];
}> {
  let movementRows: Array<{
    productId: string;
    productName: string;
    productSize: string;
    categoryId: string | null;
    categoryName: string;
    movementType: string;
    quantity: number;
    unitSellingPrice: number | null;
    totalSellingPrice: number | null;
    unitPurchasePrice: number | null;
    totalPurchasePrice: number | null;
    paymentMethod: string;
    orderNo: string;
    customerName: string;
    supplier: string;
    reason: string;
    notes: string;
    movementDate: string;
  }> = [];
  try {
    movementRows = await query<{
      productId: string;
      productName: string;
      productSize: string;
      categoryId: string | null;
      categoryName: string;
      movementType: string;
      quantity: number;
      unitSellingPrice: number | null;
      totalSellingPrice: number | null;
      unitPurchasePrice: number | null;
      totalPurchasePrice: number | null;
      paymentMethod: string;
      orderNo: string;
      customerName: string;
      supplier: string;
      reason: string;
      notes: string;
      movementDate: string;
    }>(
      `SELECT
        sm."productId"::text AS "productId",
        sm."productName",
        sm."productSize",
        sm."categoryId"::text AS "categoryId",
        COALESCE(c.name, '') AS "categoryName",
        sm."movementType",
        sm.quantity,
        sm."unitSellingPrice"::float8 AS "unitSellingPrice",
        sm."totalSellingPrice"::float8 AS "totalSellingPrice",
        sm."unitPurchasePrice"::float8 AS "unitPurchasePrice",
        sm."totalPurchasePrice"::float8 AS "totalPurchasePrice",
        sm."paymentMethod",
        sm."orderNo",
        sm."customerName",
        sm.supplier,
        sm.reason,
        sm.notes,
        sm."movementDate"::text AS "movementDate"
      FROM stock_movements sm
      LEFT JOIN categories c ON c.id = sm."categoryId"
      WHERE sm."movementDate" >= $1::timestamptz
        AND sm."movementDate" <= $2::timestamptz
      ORDER BY sm."movementDate", sm."productName"`,
      [startDate, endDate],
    );
  } catch {
    // stock_movements table may not exist yet
    movementRows = [];
  }

  // Build summary by product
  const summaryMap = new Map<string, MovementReportItem>();
  for (const m of movementRows) {
    const key = `${m.productId}:${m.productSize}`;
    let item = summaryMap.get(key);
    if (!item) {
      item = {
        productId: m.productId,
        productName: m.productName,
        productSize: m.productSize,
        categoryId: m.categoryId,
        categoryName: m.categoryName,
        totalPurchased: 0,
        totalSold: 0,
        totalReturned: 0,
        totalGifted: 0,
        totalWasted: 0,
        totalDamaged: 0,
        totalAdjusted: 0,
        totalPurchaseCost: 0,
        totalSalesRevenue: 0,
        currentStock: 0,
      };
      summaryMap.set(key, item);
    }

    const absQty = Math.abs(m.quantity);
    switch (m.movementType) {
      case 'sale':
        item.totalSold += absQty;
        item.totalSalesRevenue += m.totalSellingPrice ?? 0;
        break;
      case 'purchase':
        item.totalPurchased += absQty;
        item.totalPurchaseCost += m.totalPurchasePrice ?? 0;
        break;
      case 'gift':
        item.totalGifted += absQty;
        break;
      case 'return':
        item.totalReturned += absQty;
        break;
      case 'waste':
        item.totalWasted += absQty;
        break;
      case 'damage':
        item.totalDamaged += absQty;
        break;
      case 'stock_adjustment':
        item.totalAdjusted += m.quantity; // Keep sign for adjustments
        break;
    }
  }

  // Get current stock for all products (gracefully handle missing columns)
  let stockRows: Array<{
    productId: string;
    productName: string;
    productSize: string;
    stockQuantity: number;
  }> = [];
  try {
    stockRows = await query<{
      productId: string;
      productName: string;
      productSize: string;
      stockQuantity: number;
    }>(
      `SELECT
        p.id::text AS "productId",
        p.name AS "productName",
        COALESCE(ps.name, '') AS "productSize",
        COALESCE(ps."stockQuantity", p."stockQuantity", 0)::int AS "stockQuantity"
      FROM products p
      LEFT JOIN product_sizes ps ON ps."productId" = p.id
      WHERE p."isAvailable" = true
      ORDER BY p.name, ps."sortOrder"`,
    );
  } catch {
    stockRows = [];
  }

  // Update current stock in summary
  for (const stock of stockRows) {
    const key = `${stock.productId}:${stock.productSize}`;
    const item = summaryMap.get(key);
    if (item) {
      item.currentStock = stock.stockQuantity;
    }
  }

  // Build details list
  const details: MovementDetail[] = movementRows.map((m) => {
    const date = new Date(m.movementDate);
    return {
      date: date.toISOString().slice(0, 10),
      time: date.toTimeString().slice(0, 5),
      productName: m.productName,
      productSize: m.productSize,
      categoryName: m.categoryName,
      movementType: m.movementType,
      quantity: m.quantity,
      unitPurchasePrice: m.unitPurchasePrice,
      totalPurchasePrice: m.totalPurchasePrice,
      unitSellingPrice: m.unitSellingPrice,
      totalSellingPrice: m.totalSellingPrice,
      paymentMethod: m.paymentMethod,
      orderNo: m.orderNo,
      customerName: m.customerName,
      supplier: m.supplier,
      reason: m.reason,
      notes: m.notes,
    };
  });

  return {
    summary: Array.from(summaryMap.values()),
    details,
  };
}

type MovementDetail = {
  date: string;
  time: string;
  productName: string;
  productSize: string;
  categoryName: string;
  movementType: string;
  quantity: number;
  unitPurchasePrice: number | null;
  totalPurchasePrice: number | null;
  unitSellingPrice: number | null;
  totalSellingPrice: number | null;
  paymentMethod: string;
  orderNo: string;
  customerName: string;
  supplier: string;
  reason: string;
  notes: string;
};
