import { query, withTransaction } from './index';
import { PUBLIC_COLS } from './products';

const ensureWishlist = async (userId: string): Promise<string> => {
  await query(`INSERT INTO wishlists ("userId") VALUES ($1::uuid) ON CONFLICT ("userId") DO NOTHING`, [userId]);
  const rows = await query<{ id: string }>(`SELECT id FROM wishlists WHERE "userId" = $1::uuid`, [userId]);
  return rows[0].id;
};

export const getWishlist = async (userId: string): Promise<Record<string, unknown>[]> => {
  const wishlistId = await ensureWishlist(userId);
  return (await query(
    `SELECT ${PUBLIC_COLS}
     FROM products p
     JOIN wishlist_items wi ON wi."productId" = p.id
     WHERE wi."wishlistId" = $1::uuid
     ORDER BY wi."createdAt" ASC`,
    [wishlistId],
  )) as Record<string, unknown>[];
};

export const toggle = async (userId: string, productId: string): Promise<{ added: boolean; ids: string[] }> => {
  let added = true;
  let ids: string[] = [];
  await withTransaction(async (tx) => {
    await tx.query(`INSERT INTO wishlists ("userId") VALUES ($1::uuid) ON CONFLICT ("userId") DO NOTHING`, [userId]);
    const wishrows = await tx.query<{ id: string }>(
      `SELECT id FROM wishlists WHERE "userId" = $1::uuid`,
      [userId],
    );
    const wishlistId = wishrows.rows[0].id;

    const existing = await tx.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM wishlist_items
       WHERE "wishlistId" = $1::uuid AND "productId" = $2::uuid`,
      [wishlistId, productId],
    );
    if (existing.rows[0].count > 0) {
      added = false;
      await tx.query(
        `DELETE FROM wishlist_items WHERE "wishlistId" = $1::uuid AND "productId" = $2::uuid`,
        [wishlistId, productId],
      );
    } else {
      added = true;
      await tx.query(
        `INSERT INTO wishlist_items ("wishlistId", "productId") VALUES ($1::uuid, $2::uuid)`,
        [wishlistId, productId],
      );
    }
    const idRows = await tx.query<{ id: string }>(
      `SELECT "productId"::text AS id FROM wishlist_items
       WHERE "wishlistId" = $1::uuid ORDER BY "createdAt" ASC`,
      [wishlistId],
    );
    ids = idRows.rows.map((r) => r.id);
  });
  return { added, ids };
};

export const clear = async (userId: string): Promise<void> => {
  const wishlistId = await ensureWishlist(userId);
  await query(`DELETE FROM wishlist_items WHERE "wishlistId" = $1::uuid`, [wishlistId]);
};