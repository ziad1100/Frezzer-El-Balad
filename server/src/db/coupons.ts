import { query } from './index';

export const COUPON_COLS = `
  c.id::text AS "_id",
  c.code, c.name, c."nameEn", c.type::text AS "type",
  c.value::float8 AS "value", c."minOrder"::float8 AS "minOrder",
  c."maxDiscount"::float8 AS "maxDiscount",
  c."maxUses", c."usedCount", c."perUserLimit",
  c."startDate", c."endDate", c."isActive", c."createdAt", c."updatedAt"`;

export const list = async (): Promise<Record<string, unknown>[]> =>
  (await query(`SELECT ${COUPON_COLS} FROM coupons c ORDER BY c."createdAt" DESC, c.id`)) as Record<string, unknown>[];

export const getByCode = async (code: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${COUPON_COLS} FROM coupons c WHERE c.code = $1 LIMIT 1`, [code]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const getById = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${COUPON_COLS} FROM coupons c WHERE c.id = $1::uuid LIMIT 1`, [id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const create = async (data: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
  const r = await query<{ id: string }>(
    `INSERT INTO coupons (code, name, "nameEn", type, value, "minOrder", "maxDiscount",
       "maxUses", "usedCount", "perUserLimit", "startDate", "endDate", "isActive")
     VALUES ($1, $2, $3, $4::coupon_type, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [String(data.code ?? '').toUpperCase(), data.name ?? '', data.nameEn ?? '', data.type ?? 'percent',
     Number(data.value) || 0, Number(data.minOrder) || 0, Number(data.maxDiscount) || 0,
     Number(data.maxUses) || 0, Number(data.usedCount) || 0, Number(data.perUserLimit) || 1,
     data.startDate ?? new Date(), data.endDate ?? null, data.isActive ?? true],
  );
  if (!r.length) return null;
  return getById(r[0].id);
};

export const update = async (id: string, data: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
  const sets: string[] = [];
  const values: unknown[] = [id];
  const nxt = () => values.length;
  const push = (col: string, v: unknown) => { values.push(v); sets.push(`"${col}" = $${nxt()}`); };

  for (const k of ['code', 'name', 'nameEn', 'type', 'isActive'] as const) {
    if (data[k] !== undefined) push(k, k === 'code' ? String(data[k]).toUpperCase() : data[k]);
  }
  for (const k of ['value', 'minOrder', 'maxDiscount'] as const) {
    if (data[k] !== undefined) push(k, Number(data[k]));
  }
  for (const k of ['maxUses', 'usedCount', 'perUserLimit'] as const) {
    if (data[k] !== undefined) push(k, Number(data[k]));
  }
  if (data.startDate !== undefined) push('startDate', data.startDate);

  if (!sets.length) return getById(id);
  const r = await query(`UPDATE coupons SET ${sets.join(', ')} WHERE id = $1::uuid RETURNING id`, values);
  if (!r.length) return null;
  return getById(id);
};

export const remove = async (id: string): Promise<boolean> => {
  const r = await query('DELETE FROM coupons WHERE id = $1::uuid RETURNING id', [id]);
  return r.length > 0;
};

export const incrementUsedCount = async (code: string): Promise<void> => {
  await query(`UPDATE coupons SET "usedCount" = "usedCount" + 1 WHERE code = $1`, [code]);
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const countRedemptionsForUser = async (couponId: string, userId: string): Promise<number> => {
  if (!UUID_RE.test(userId) || !UUID_RE.test(couponId)) return 0;
  const rows = await query<{ n: string }>(
    `SELECT count(*) AS n FROM coupon_redemptions WHERE "couponId" = $1::uuid AND "userId" = $2::uuid`,
    [couponId, userId],
  );
  return Number(rows[0]?.n ?? 0);
};

export const recordRedemption = async (
  couponId: string,
  userId: string,
  orderId?: string,
): Promise<void> => {
  await query(
    `INSERT INTO coupon_redemptions ("couponId", "userId", "orderId")
     VALUES ($1::uuid, $2::uuid, $3::uuid)`,
    [couponId, userId, orderId ?? null],
  );
};