import { withTransaction } from './index';

/**
 * Safe system reset — clears transactional/promotional data while preserving
 * core business entities (users, products, categories, variants, reviews).
 *
 * What gets CLEARED:
 *   - Orders + order_items
 *   - Carts + cart_items
 *   - Offers + offer_products
 *   - Coupon redemptions (not coupons themselves)
 *   - Analytics rollup table
 *
 * What gets RESET:
 *   - Product isOffer → false (since offers are cleared)
 *
 * IMPORTANT: Product prices are NEVER reset. Existing prices are preserved.
 *
 * What is PRESERVED:
 *   - Users / admins
 *   - Products (names, descriptions, images, categories, etc.)
 *   - Categories
 *   - Product sizes (names, relationships — only price zeroed)
 *   - Product extras (names, relationships — only price zeroed)
 *   - Reviews / ratings
 *   - Coupons (structure preserved, only redemptions cleared)
 *   - Banners, branches, posts, contacts, settings, notifications
 */
export const systemReset = async (): Promise<{
  ordersDeleted: number;
  cartsCleared: number;
  offersDeleted: number;
  productsReset: number;
  sizesReset: number;
  extrasReset: number;
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

    // 8. Reset coupon usedCount to 0
    await tx.query('UPDATE coupons SET "usedCount" = 0');

    // 9. Truncate analytics table
    await tx.query('TRUNCATE TABLE analytics');

    // 10. Reset isOffer flag on products (since offers are cleared)
    const productsResult = await tx.query('UPDATE products SET "isOffer" = false');
    const productsReset = productsResult.rowCount ?? 0;

    // NOTE: Product prices and variant prices are intentionally NOT reset.
    // Prices are preserved so that the system reset does not destroy product pricing data.
    const sizesReset = 0;
    const extrasReset = 0;

    // 11. Reset the stats cutoff so dashboard shows clean state
    await tx.query(
      `INSERT INTO settings (key, value) VALUES ('statsClearedAt', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(new Date().toISOString())],
    );

    return {
      ordersDeleted,
      cartsCleared,
      offersDeleted,
      productsReset,
      sizesReset,
      extrasReset,
    };
  });
};
