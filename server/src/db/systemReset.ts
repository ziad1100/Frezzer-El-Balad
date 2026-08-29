import { withTransaction } from './index';

/**
 * Safe system reset — clears transactional/promotional data while preserving
 * ALL core business entities (users, products, categories, variants, reviews,
 * labels, banners, branches, posts, settings, notifications).
 *
 * What gets CLEARED (allow-list approach):
 *   - Orders + order_items  (transactional)
 *   - Carts + cart_items    (transactional)
 *   - Offers + offer_products (promotional — products themselves stay)
 *   - Coupon redemptions    (transactional — coupon structure stays)
 *   - Analytics rollup table (statistics)
 *
 * What gets RESET:
 *   - Coupon usedCount → 0  (counter tied to cleared redemptions)
 *   - statsClearedAt setting (dashboard state marker)
 *
 * IMPORTANT — NEVER modified by reset:
 *   - Product records (names, prices, descriptions, images, categories, etc.)
 *   - Product sizes / extras (names, prices, relationships)
 *   - Product isOffer / isBestSeller / isAvailable flags
 *   - Users / admins
 *   - Categories / labels
 *   - Reviews / ratings
 *   - Banners / branches / posts / contacts / settings (except statsClearedAt)
 */
export const systemReset = async (): Promise<{
  ordersDeleted: number;
  cartsCleared: number;
  offersDeleted: number;
}> => {
  return await withTransaction(async (tx) => {
    // 1. Delete all order items first (FK dependency on orders)
    const orderItemsResult = await tx.query('DELETE FROM order_items');
    const ordersDeleted = orderItemsResult.rowCount ?? 0;

    // 2. Delete all orders
    await tx.query('DELETE FROM orders');

    // 3. Delete all cart items (FK dependency on carts)
    await tx.query('DELETE FROM cart_items');

    // 4. Delete all carts
    const cartsResult = await tx.query('DELETE FROM carts');
    const cartsCleared = cartsResult.rowCount ?? 0;

    // 5. Delete offer_products (junction table)
    await tx.query('DELETE FROM offer_products');

    // 6. Delete all offers
    const offersResult = await tx.query('DELETE FROM offers');
    const offersDeleted = offersResult.rowCount ?? 0;

    // 7. Clear coupon redemptions (keep coupons structure)
    await tx.query('DELETE FROM coupon_redemptions');

    // 8. Reset coupon usedCount to 0 (counter tied to cleared redemptions)
    await tx.query('UPDATE coupons SET "usedCount" = 0');

    // 9. Truncate analytics table (statistics only)
    await tx.query('TRUNCATE TABLE analytics');

    // 10. Reset the stats cutoff so dashboard shows clean state
    await tx.query(
      `INSERT INTO settings (key, value) VALUES ('statsClearedAt', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(new Date().toISOString())],
    );

    return {
      ordersDeleted,
      cartsCleared,
      offersDeleted,
    };
  });
};

/**
 * Reset only purchase records. Preserves everything else.
 *
 * What gets CLEARED:
 *   - All rows in `purchases` table
 *
 * What is PRESERVED:
 *   - Products, categories, sizes, extras
 *   - Orders, order_items
 *   - Carts, cart_items
 *   - Stock movements (historical record)
 *   - Users, reviews, settings, etc.
 *
 * NOTE: We do NOT touch inventory stockQuantity because purchase
 * records are additive (each purchase increases stock). Deleting
 * purchase records without reversing stock would leave inventory
 * inconsistent. The existing architecture records purchases as
 * one-shot events — the admin must manually adjust stock if needed.
 */
export const resetPurchases = async (): Promise<{ purchasesDeleted: number }> => {
  return await withTransaction(async (tx) => {
    const result = await tx.query('DELETE FROM purchases');
    const purchasesDeleted = result.rowCount ?? 0;
    return { purchasesDeleted };
  });
};
