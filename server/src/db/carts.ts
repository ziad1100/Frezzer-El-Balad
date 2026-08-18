import { query, withTransaction, buildSetClause, type ReadClient } from './index';

const CART_PRODUCT_JSON = `
  CASE WHEN p.id IS NULL THEN NULL
  ELSE jsonb_build_object(
    '_id', p.id::text, 'name', p.name, 'nameEn', p."nameEn",
    'images', p.images, 'basePrice', p."basePrice"::float8, 'slug', p.slug,
    'sizes', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        '_id', ps.id::text, 'name', ps.name, 'nameEn', ps."nameEn",
        'price', ps.price::float8, 'isAvailable', ps."isAvailable")
      ORDER BY ps."sortOrder"), '[]'::jsonb)
      FROM product_sizes ps WHERE ps."productId" = p.id),
    'extras', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        '_id', pe.id::text, 'name', pe.name, 'nameEn', pe."nameEn",
        'price', pe.price::float8)
      ORDER BY pe."sortOrder"), '[]'::jsonb)
      FROM product_extras pe WHERE pe."productId" = p.id)
  ) END AS "product"`;

const ITEM_COLS = `
  ci.id::text AS "_id",
  ci."productId"::text AS "product",
  ci."sizeId"::text AS "size",
  ci."sizeName",
  ci.extras,
  ci.qty,
  ci."unitPrice"::float8 AS "unitPrice",
  ${CART_PRODUCT_JSON}`;

const ensureCart = async (tx: ReadClient, userId: string): Promise<string> => {
  await tx.query(`INSERT INTO carts ("userId") VALUES ($1::uuid) ON CONFLICT ("userId") DO NOTHING`, [userId]);
  const rows = await tx.query<{ id: string }>(`SELECT id FROM carts WHERE "userId" = $1::uuid`, [userId]);
  return rows.rows[0].id;
};

const cartWithItems = async (userId: string): Promise<{ items: Record<string, unknown>[]; couponCode: string }> => {
  const rows = await query<{ id: string; couponCode: string }>(
    `SELECT id, "couponCode" FROM carts WHERE "userId" = $1::uuid`,
    [userId],
  );
  if (!rows.length) return { items: [], couponCode: '' };
  const items = (await query(
    `SELECT ${ITEM_COLS}
     FROM cart_items ci
     LEFT JOIN products p ON p.id = ci."productId"
     WHERE ci."cartId" = $1::uuid
     ORDER BY ci.id`,
    [rows[0].id],
  )) as Record<string, unknown>[];
  return { items, couponCode: rows[0].couponCode };
};

export const getCart = async (userId: string): Promise<{ items: Record<string, unknown>[]; couponCode: string }> =>
  cartWithItems(userId);

export const addItem = async (
  userId: string,
  data: {
    product: string;
    size?: string | null;
    sizeName?: string;
    extras?: unknown[];
    qty?: number;
    unitPrice: number;
  },
): Promise<void> => {
  await withTransaction(async (tx) => {
    const cartId = await ensureCart(tx, userId);
    const sizeId = data.size || null;
    const rows = await tx.query<{ id: string }>(
      `SELECT id FROM cart_items
       WHERE "cartId" = $1::uuid AND "productId" = $2::uuid
         AND COALESCE("sizeId"::text, '') = COALESCE($3::text, '')
       LIMIT 1`,
      [cartId, data.product, sizeId],
    );
    if (rows.rows.length) {
      await tx.query(
        `UPDATE cart_items SET qty = qty + $2, "unitPrice" = $3 WHERE id = $1::uuid`,
        [rows.rows[0].id, Number(data.qty) || 1, Number(data.unitPrice)],
      );
      return;
    }
    await tx.query(
      `INSERT INTO cart_items ("cartId", "productId", "sizeId", "sizeName", extras, qty, "unitPrice")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7)`,
      [cartId, data.product, sizeId, data.sizeName ?? '', JSON.stringify(data.extras ?? []), Number(data.qty) || 1, Number(data.unitPrice)],
    );
  });
};

export const updateItem = async (
  userId: string,
  itemId: string,
  data: { qty?: number; extras?: unknown[] },
): Promise<boolean> => {
  const cart = await query<{ id: string }>(`SELECT id FROM carts WHERE "userId" = $1::uuid`, [userId]);
  if (!cart.length) return false;
  const exists = await query(
    `SELECT id FROM cart_items WHERE id = $1::uuid AND "cartId" = $2::uuid LIMIT 1`,
    [itemId, cart[0].id],
  );
  if (!exists.length) return false;
  const { setSql, values } = buildSetClause(data, 3);
  if (setSql) {
    await query(
      `UPDATE cart_items SET ${setSql} WHERE id = $1::uuid AND "cartId" = $2::uuid`,
      [itemId, cart[0].id, ...values],
    );
  }
  return true;
};

export const removeItem = async (userId: string, itemId: string): Promise<void> => {
  const cart = await query<{ id: string }>(`SELECT id FROM carts WHERE "userId" = $1::uuid`, [userId]);
  if (!cart.length) return;
  await query(`DELETE FROM cart_items WHERE id = $1::uuid AND "cartId" = $2::uuid`, [itemId, cart[0].id]);
};

export const applyCoupon = async (userId: string, code: string): Promise<void> => {
  await withTransaction(async (tx) => {
    const cartId = await ensureCart(tx, userId);
    await tx.query(`UPDATE carts SET "couponCode" = $2 WHERE id = $1::uuid`, [cartId, code]);
  });
};

export const clearCart = async (userId: string): Promise<void> => {
  await withTransaction(async (tx) => {
    const cartId = await ensureCart(tx, userId);
    await tx.query(`DELETE FROM cart_items WHERE "cartId" = $1::uuid`, [cartId]);
    await tx.query(`UPDATE carts SET "couponCode" = '' WHERE id = $1::uuid`, [cartId]);
  });
};
