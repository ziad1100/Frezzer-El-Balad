import { query, withTransaction, type ReadClient } from './index';
import { ApiError } from '../utils/ApiError';

const ITEMS_JSON = `
  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      '_id', oi.id::text,
      'product', oi."productId"::text,
      'name', oi.name,
      'nameEn', COALESCE(p."nameEn", oi.name),
      'size', oi.size, 'extras', oi.extras,
      'qty', oi.qty,
      'unitPrice', oi."unitPrice"::float8,
      'lineTotal', oi."lineTotal"::float8)
    ORDER BY oi."sortOrder"), '[]'::jsonb)
   FROM order_items oi
   LEFT JOIN products p ON p.id = oi."productId"
   WHERE oi."orderId" = o.id)`;

const ORDER_CORE = `
  o.id::text AS "_id",
  o."orderNo",
  o.subtotal::float8 AS "subtotal", o."deliveryFee"::float8 AS "deliveryFee",
  o.discount::float8 AS "discount", o."couponCode", o.total::float8 AS "total",
  o."adjustmentAmount"::float8 AS "adjustmentAmount",
  o."isComplimentary" AS "isComplimentary",
  o."adjustmentReason" AS "adjustmentReason",
  o."adjustedAt" AS "adjustedAt",
  o.status::text AS "status", o."deliveryAddress", o.phone, o."customerName", o.notes,
  o."statusHistory", o."createdAt", o."updatedAt",
  jsonb_build_object(
    'method', o."paymentMethod",
    'status', o."paymentStatus",
    'reference', o."paymentReference",
    'amount', o."paymentAmount"::float8,
    'paidAt', o."paidAt"
  ) AS "payment",
  ${ITEMS_JSON} AS "items"`;

export const ORDER_COLS = `o."userId"::text AS "user", ${ORDER_CORE}`;

const ADMIN_ORDER_USER = `
  CASE WHEN u.id IS NULL THEN to_jsonb(o."userId"::text)
       ELSE jsonb_build_object('_id', u.id::text, 'fullName', u."fullName", 'email', u.email, 'phone', u.phone)
  END AS "user"`;
const ADMIN_ORDER_ADJUSTED_BY = `
  CASE WHEN ab.id IS NULL THEN to_jsonb(o."adjustedBy"::text)
       ELSE jsonb_build_object('_id', ab.id::text, 'fullName', ab."fullName")
  END AS "adjustedBy"`;
const ADMIN_ORDER_COLS = `${ADMIN_ORDER_USER}, ${ADMIN_ORDER_ADJUSTED_BY}, ${ORDER_CORE}`;

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

export const getById = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${ORDER_COLS} FROM orders o WHERE o.id = $1::uuid LIMIT 1`, [id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const getByUserAndId = async (userId: string, orderId: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(
    `SELECT ${ORDER_COLS} FROM orders o WHERE o.id = $1::uuid AND o."userId" = $2::uuid LIMIT 1`,
    [orderId, userId],
  );
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const listByUser = async (userId: string, page: number, limit: number): Promise<Page<Record<string, unknown>>> => {
  const rows = (await query(
    `SELECT count(*) OVER()::int AS __total, ${ORDER_COLS}
     FROM orders o
     WHERE o."userId" = $1::uuid
     ORDER BY o."createdAt" DESC, o.id
     LIMIT $2 OFFSET $3`,
    [userId, limit, (page - 1) * limit],
  )) as unknown as Array<Record<string, unknown>>;
  return toPage(rows, limit);
};

export const adminList = async (
  page: number,
  limit: number,
  status: string,
  q: string,
): Promise<Page<Record<string, unknown>>> => {
  const conds: string[] = [];
  const values: unknown[] = [];
  const nxt = () => values.length;

  if (status) { values.push(status); conds.push(`o.status = $${nxt()}::order_status`); }
  if (q) {
    values.push(q, q, q);
    conds.push(
      `(o."orderNo" ILIKE '%' || $${values.length - 2} || '%'
        OR o."customerName" ILIKE '%' || $${values.length - 1} || '%'
        OR o.phone ILIKE '%' || $${values.length} || '%')`,
    );
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = (await query(
    `SELECT count(*) OVER()::int AS __total, ${ADMIN_ORDER_COLS}
     FROM orders o
     LEFT JOIN users u ON u.id = o."userId"
     LEFT JOIN users ab ON ab.id = o."adjustedBy"
     ${where}
     ORDER BY o."createdAt" DESC, o.id
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit],
  )) as unknown as Array<Record<string, unknown>>;
  return toPage(rows, limit);
};

export const getAdminById = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(
    `SELECT ${ADMIN_ORDER_COLS}
     FROM orders o
     LEFT JOIN users u ON u.id = o."userId"
     LEFT JOIN users ab ON ab.id = o."adjustedBy"
     WHERE o.id = $1::uuid LIMIT 1`,
    [id],
  );
  return (rows[0] as Record<string, unknown>) ?? null;
};

const NOT_TERMINAL = `status IN ('pending'::order_status, 'preparing'::order_status, 'on_delivery'::order_status)`;

export const adminCancel = async (
  orderId: string,
  statusHistory: unknown[],
): Promise<Record<string, unknown> | null> => {
  const r = await query(
    `UPDATE orders SET status = 'cancelled'::order_status,
       "statusHistory" = "statusHistory" || $2::jsonb
     WHERE id = $1::uuid AND ${NOT_TERMINAL} RETURNING id`,
    [orderId, JSON.stringify(statusHistory)],
  );
  if (!r.length) return null;
  return getAdminById(orderId);
};

export const markComplimentary = async (
  orderId: string,
  userId: string,
  reason: string,
  statusHistory: unknown[],
): Promise<Record<string, unknown> | null> => {
  const r = await query(
    `UPDATE orders SET
       status = 'complimentary'::order_status,
       "isComplimentary" = true,
       "adjustmentAmount" = GREATEST(0, subtotal + "deliveryFee" - discount),
       "adjustmentReason" = $3,
       "adjustedBy" = $2::uuid,
       "adjustedAt" = now(),
       total = 0,
       "statusHistory" = "statusHistory" || $4::jsonb
     WHERE id = $1::uuid AND ${NOT_TERMINAL} RETURNING id`,
    [orderId, userId, reason, JSON.stringify(statusHistory)],
  );
  if (!r.length) return null;
  return getAdminById(orderId);
};

export const cancel = async (
  orderId: string,
  userId: string,
  statusHistory: unknown[],
): Promise<Record<string, unknown> | null> => {
  const r = await query(
    `UPDATE orders SET status = 'cancelled'::order_status,
       "statusHistory" = "statusHistory" || $3::jsonb
     WHERE id = $1::uuid AND "userId" = $2::uuid RETURNING id`,
    [orderId, userId, JSON.stringify(statusHistory)],
  );
  if (!r.length) return null;
  return getById(orderId);
};

export const updateStatus = async (
  orderId: string,
  status: string,
  statusHistory: unknown[],
): Promise<Record<string, unknown> | null> => {
  const r = await query(
    `UPDATE orders SET status = $2::order_status,
       "statusHistory" = "statusHistory" || $3::jsonb
     WHERE id = $1::uuid RETURNING id`,
    [orderId, status, JSON.stringify(statusHistory)],
  );
  if (!r.length) return null;
  return getById(orderId);
};

export const stats = async (): Promise<Record<string, unknown>> => {
  const rows = await query(`
    SELECT
      (SELECT count(*) FROM orders)::int AS "totalOrders",
      (SELECT count(*) FROM orders WHERE status = 'completed')::int AS "completedOrders",
      (SELECT count(*) FROM orders WHERE status = 'cancelled')::int AS "cancelledOrders",
      (SELECT count(*) FROM orders WHERE status = 'refunded')::int AS "refundedOrders",
      (SELECT count(*) FROM orders WHERE status = 'complimentary')::int AS "complimentaryOrders",
      (SELECT count(*)::int FROM orders WHERE status = 'pending') AS "pendingOrders",
      (SELECT COALESCE(SUM(total), 0)::float8 FROM orders WHERE status = 'completed') AS "revenue",
      (SELECT COALESCE(SUM(total), 0)::float8 FROM orders WHERE status = 'completed') AS "netRevenue",
      (SELECT COALESCE(SUM(subtotal + "deliveryFee"), 0)::float8 FROM orders WHERE status = 'completed') AS "grossRevenue",
      (SELECT COALESCE(SUM(discount), 0)::float8 FROM orders WHERE status = 'completed') AS "discounts",
      (SELECT COALESCE(SUM("deliveryFee"), 0)::float8 FROM orders WHERE status = 'completed') AS "deliveryFees"`);
  return rows[0];
};

export interface PlaceOrderItem {
  productId: string;
  name: string;
  size: string;
  extras: unknown[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PlaceOrderInput {
  orderNo: string;
  userId: string;
  items: PlaceOrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  couponCode: string;
  total: number;
  paymentMethod: string;
  paymentReference: string;
  paymentAmount: number;
  deliveryAddress: Record<string, unknown>;
  phone: string;
  customerName: string;
  notes: string;
  statusHistory: Array<{ status: string; changedBy: string; at: Date }>;
}

interface LockedCoupon {
  id: string;
  type: string;
  value: string;
  minOrder: string;
  maxDiscount: string;
  maxUses: number;
  usedCount: number;
  perUserLimit: number;
  startDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
}

/** Re-runs the coupon.service validation rules against a row-locked coupon row. */
const revalidateCoupon = async (
  tx: ReadClient,
  coupon: LockedCoupon | null | undefined,
  userId: string,
  subtotal: number,
): Promise<number> => {
  if (!coupon || coupon.isActive !== true) throw new ApiError(404, 'Invalid coupon code');
  const now = new Date();
  if (coupon.startDate && new Date(coupon.startDate) > now) {
    throw new ApiError(400, 'Coupon is not active yet');
  }
  if (coupon.endDate && new Date(coupon.endDate) < now) {
    throw new ApiError(400, 'Coupon has expired');
  }
  if (subtotal < Number(coupon.minOrder)) {
    throw new ApiError(400, `Minimum order for this coupon is ${Number(coupon.minOrder)} EGP`);
  }
  if (Number(coupon.maxUses) > 0 && Number(coupon.usedCount) >= Number(coupon.maxUses)) {
    throw new ApiError(400, 'Coupon usage limit reached');
  }
  if (Number(coupon.perUserLimit) > 0) {
    const used = await tx.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM coupon_redemptions
       WHERE "couponId" = $1::uuid AND "userId" = $2::uuid`,
      [coupon.id, userId],
    );
    if (used.rows[0].n >= Number(coupon.perUserLimit)) {
      throw new ApiError(400, 'You have already used this coupon');
    }
  }

  let amount: number;
  if (coupon.type === 'percent') {
    const percentAmount = (subtotal * Number(coupon.value)) / 100;
    amount = Number(coupon.maxDiscount) > 0 && percentAmount > Number(coupon.maxDiscount)
      ? Number(coupon.maxDiscount)
      : percentAmount;
  } else {
    amount = Math.min(Number(coupon.value), subtotal);
  }
  return Math.round(amount * 100) / 100;
};

/**
 * Creates an order — and, when a coupon is involved, row-locks the coupon and
 * re-validates it *inside* the transaction before incrementing usedCount and
 * inserting the redemption, so concurrent identical orders cannot double-spend.
 */
export const placeOrder = async (input: PlaceOrderInput): Promise<Record<string, unknown>> => {
  const couponCode = input.couponCode.toUpperCase();
  let orderId = '';
  await withTransaction(async (tx: ReadClient) => {
    let finalDiscount = input.discount;
    let finalTotal = input.total;
    let couponId: string | null = null;

    if (couponCode) {
      const res = await tx.query<LockedCoupon>(
        `SELECT id, code, type, value, "minOrder", "maxDiscount", "maxUses", "usedCount",
                "perUserLimit", "startDate", "endDate", "isActive"
         FROM coupons WHERE code = $1 FOR UPDATE`,
        [couponCode],
      );
      const coupon: LockedCoupon | null | undefined = res.rows[0] ?? null;
      finalDiscount = await revalidateCoupon(tx, coupon, input.userId, input.subtotal);
      couponId = coupon!.id;
      finalTotal = Math.max(0, input.subtotal + input.deliveryFee - finalDiscount);
    }

    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO orders ("orderNo", "userId", "status", subtotal, "deliveryFee", discount,
         "couponCode", total, "paymentMethod", "paymentStatus", "paymentReference",
         "paymentAmount", "deliveryAddress", phone, "customerName", notes, "statusHistory")
       VALUES ($1, $2::uuid, $3::order_status, $4, $5, $6, $7, $8,
         $9::payment_method, $10::payment_status, $11, $12, $13::jsonb, $14, $15, $16, $17::jsonb)
       RETURNING id`,
      [
        input.orderNo, input.userId, 'pending', input.subtotal, input.deliveryFee,
        finalDiscount, couponCode, finalTotal, input.paymentMethod, 'pending',
        input.paymentReference, input.paymentAmount, input.deliveryAddress, input.phone,
        input.customerName, input.notes, JSON.stringify(input.statusHistory),
      ],
    );
    orderId = inserted.rows[0].id;

    for (const [i, item] of input.items.entries()) {
      await tx.query(
        `INSERT INTO order_items ("orderId", "productId", "sortOrder", name, size, extras,
           qty, "unitPrice", "lineTotal")
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
        [orderId, item.productId, i, item.name, item.size, JSON.stringify(item.extras), item.qty, item.unitPrice, item.lineTotal],
      );
    }

    if (couponId) {
      await tx.query(`UPDATE coupons SET "usedCount" = "usedCount" + 1 WHERE id = $1::uuid`, [couponId]);
      await tx.query(
        `INSERT INTO coupon_redemptions ("couponId", "userId", "orderId")
         VALUES ($1::uuid, $2::uuid, $3::uuid)`,
        [couponId, input.userId, orderId],
      );
    }
  });

  const order = await getById(orderId);
  if (!order) throw new ApiError(500, 'Order creation failed');
  return order;
};