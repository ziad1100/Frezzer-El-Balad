import { query, withTransaction } from './index';
import { ApiError } from '../utils/ApiError';
import { PUBLIC_COLS } from './products';

const MONGODB_ID_RE = /^[0-9a-fA-F]{24}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mongo semantics parity: a 24-char hex id is a valid lookup that simply matches
// nothing (404); anything else is bad input (400, same as a CastError).
export const toUuidOrNull = (id: string): string | null => {
  if (UUID_RE.test(id)) return id;
  if (MONGODB_ID_RE.test(id)) return null;
  throw new ApiError(400, 'Invalid id or number format');
};

const OFFER_CORE = `
  o.id::text AS "_id",
  o.title, o."titleEn", o.description, o."descriptionEn", o.banner,
  o."discountType"::text AS "discountType",
  o."discountValue"::float8 AS "discountValue",
  o."startDate", o."endDate", o.theme::text AS "theme", o."isActive",
  o."createdAt", o."updatedAt"`;

const PRODUCTS_PUBLIC = `
  (SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) FROM (
     SELECT ${PUBLIC_COLS}
     FROM products p
     JOIN offer_products op ON op."productId" = p.id
     WHERE op."offerId" = o.id
   ) AS sub) AS "products"`;

const PRODUCTS_IDS = `
  (SELECT COALESCE(jsonb_agg(op."productId"::text ORDER BY op."productId"), '[]'::jsonb)
   FROM offer_products op WHERE op."offerId" = o.id) AS "products"`;

const PUBLIC_OFFER_COLS = `${OFFER_CORE}, ${PRODUCTS_PUBLIC}`;
const ADMIN_OFFER_COLS = `${OFFER_CORE}, ${PRODUCTS_IDS}`;

export const activeOffers = async (): Promise<Record<string, unknown>[]> =>
  (await query(
    `SELECT ${PUBLIC_OFFER_COLS} FROM offers o
     WHERE o."isActive" = true AND o."startDate" <= now() AND o."endDate" >= now()
     ORDER BY o."createdAt" DESC, o.id`,
  )) as Record<string, unknown>[];

export const getActiveById = async (id: string): Promise<Record<string, unknown> | null> => {
  const u = toUuidOrNull(id);
  if (!u) return null;
  const rows = await query(
    `SELECT ${PUBLIC_OFFER_COLS} FROM offers o
     WHERE o.id = $1::uuid AND o."isActive" = true LIMIT 1`,
    [u],
  );
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const getById = async (id: string): Promise<Record<string, unknown> | null> => {
  const u = toUuidOrNull(id);
  if (!u) return null;
  const rows = await query(`SELECT ${ADMIN_OFFER_COLS} FROM offers o WHERE o.id = $1::uuid LIMIT 1`, [u]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const list = async (): Promise<Record<string, unknown>[]> =>
  (await query(
    `SELECT ${ADMIN_OFFER_COLS} FROM offers o ORDER BY o."createdAt" DESC, o.id`,
  )) as Record<string, unknown>[];

interface OfferInput {
  title: string;
  titleEn?: string;
  description?: string;
  descriptionEn?: string;
  banner?: string;
  discountType?: string;
  discountValue?: number;
  startDate: Date | string;
  endDate: Date | string;
  theme?: string;
  isActive?: boolean;
  products?: string[];
}

const syncProducts = async (client: typeof query, offerId: string, products: string[] | undefined): Promise<void> => {
  await client('DELETE FROM offer_products WHERE "offerId" = $1', [offerId]);
  if (!products || products.length === 0) return;
  for (const productId of products) {
    await client(
      `INSERT INTO offer_products ("offerId", "productId") VALUES ($1, $2::uuid)`,
      [offerId, productId],
    );
  }
};

export const create = async (data: OfferInput): Promise<Record<string, unknown>> => {
  let id = '';
  await withTransaction(async (tx) => {
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO offers (title, "titleEn", description, "descriptionEn", banner,
        "discountType", "discountValue", "startDate", "endDate", theme, "isActive")
       VALUES ($1, $2, $3, $4, $5, $6::offer_discount_type, $7, $8, $9, $10::offer_theme, $11)
       RETURNING id`,
      [data.title, data.titleEn ?? '', data.description ?? '', data.descriptionEn ?? '',
       data.banner ?? '', data.discountType ?? 'percent', Number(data.discountValue) || 0,
       data.startDate, data.endDate, data.theme ?? 'dark', data.isActive ?? true],
    );
    id = inserted.rows[0].id;
    await syncProducts(tx.query.bind(tx), id, data.products);
  });
  return (await getById(id)) as Record<string, unknown>;
};

export const update = async (id: string, data: OfferInput): Promise<Record<string, unknown> | null> => {
  let updated = false;
  await withTransaction(async (tx) => {
    const sets: string[] = [];
    const values: unknown[] = [id];
    const nxt = () => values.length;
    const push = (col: string, v: unknown) => { values.push(v); sets.push(`"${col}" = $${nxt()}`); };

    if (data.title !== undefined) push('title', data.title);
    if (data.titleEn !== undefined) push('titleEn', data.titleEn);
    if (data.description !== undefined) push('description', data.description);
    if (data.descriptionEn !== undefined) push('descriptionEn', data.descriptionEn);
    if (data.banner !== undefined) push('banner', data.banner);
    if (data.discountType !== undefined) push('discountType', data.discountType);
    if (data.discountValue !== undefined) push('discountValue', Number(data.discountValue));
    if (data.startDate !== undefined) push('startDate', data.startDate);
    if (data.endDate !== undefined) push('endDate', data.endDate);
    if (data.theme !== undefined) push('theme', data.theme);
    if (data.isActive !== undefined) push('isActive', Boolean(data.isActive));

    if (sets.length) {
      const r = await tx.query(`UPDATE offers SET ${sets.join(', ')} WHERE id = $1::uuid RETURNING id`, values);
      updated = r.rowCount !== null && r.rowCount > 0;
    }
    if (data.products !== undefined) await syncProducts(tx.query.bind(tx), id, data.products);
  });
  if (!updated) return null;
  return getById(id);
};

export const remove = async (id: string): Promise<boolean> => {
  const r = await query('DELETE FROM offers WHERE id = $1::uuid RETURNING id', [id]);
  return r.length > 0;
};