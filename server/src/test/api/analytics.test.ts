import { beforeEach, describe, expect, it } from 'vitest';
import { query } from '../../db';
import { periodWindows } from '../../controllers/analytics.controller';
import { api, bearer, createUser, seedRoles } from '../helpers';

const DASHBOARD = '/api/v1/analytics/dashboard';

interface SeedOrderInput {
  orderId: Date;
  name: string;
  qty: number;
  unitPrice: number;
  status?: string;
}

const seedOrder = async (customerId: string, data: SeedOrderInput) => {
  const lineTotal = data.unitPrice * data.qty;
  const created = await query<{ id: string }>(
    `INSERT INTO orders ("orderNo", "userId", subtotal, "deliveryFee", discount, total,
       "paymentMethod", "paymentStatus", "paymentAmount", phone, "customerName", status,
       "createdAt", "statusHistory")
     VALUES ($1, $2, $3, 0, 0, $3, 'cash', 'pending', $4, $5, $6, $7, $8, '[]'::jsonb)
     RETURNING id`,
    [
      `PH-A-${Math.random().toString(36).slice(2, 8)}`,
      customerId,
      lineTotal,
      lineTotal,
      '01000000000',
      'Test Customer',
      data.status ?? 'pending',
      data.orderId,
    ],
  );
  await query(
    `INSERT INTO order_items ("orderId", "productId", "sortOrder", name, size, extras, qty, "unitPrice", "lineTotal")
     VALUES ($1, NULL, 0, $2, '', '[]'::jsonb, $5, $3, $4)`,
    [created[0].id, data.name, data.unitPrice, lineTotal, data.qty],
  );
};

describe('analytics dashboard periods', () => {
  beforeEach(async () => {
    await seedRoles();
    await query('DELETE FROM orders');
  });

  it('computes today/week/month revenue, orders, units and top products', async () => {
    const admin = await createUser({ role: 'admin' });
    const customer = await createUser({ role: 'customer' });
    const { todayStart, weekStart, monthStart } = periodWindows();
    const now = new Date();

    // A is always in today; B is always in this week + this month; C is always in this month.
    const bCreatedAt = new Date(Math.max(weekStart.getTime(), monthStart.getTime()) + 60e3);
    await seedOrder(customer.id, { orderId: now, name: 'Cheese', qty: 2, unitPrice: 150, status: 'completed' });
    await seedOrder(customer.id, { orderId: bCreatedAt, name: 'Chicken', qty: 1, unitPrice: 150, status: 'completed' });
    await seedOrder(customer.id, { orderId: new Date(monthStart.getTime() + 60e3), name: 'Olive', qty: 3, unitPrice: 20, status: 'completed' });
    await seedOrder(customer.id, { orderId: now, name: 'Secret', qty: 9, unitPrice: 999, status: 'cancelled' });

    const res = await api.get(DASHBOARD).set(bearer(admin.id)).expect(200);
    const data = res.body.data;

    expect(data.periodOverview).toBeDefined();
    const { today, week, month } = data.periodOverview;

    const bInToday = bCreatedAt.getTime() >= todayStart.getTime();
    const cInWeek = new Date(monthStart.getTime() + 60e3).getTime() >= weekStart.getTime();

    expect(today.revenue).toBe(300 + (bInToday ? 150 : 0));
    expect(today.orders).toBe(1 + (bInToday ? 1 : 0));
    expect(today.unitsSold).toBe(2 + (bInToday ? 1 : 0));
    expect(today.customers).toBe(1);

    expect(week.revenue).toBe(300 + 150 + (cInWeek ? 60 : 0));
    expect(week.orders).toBe(2 + (cInWeek ? 1 : 0));
    expect(week.unitsSold).toBe(3 + (cInWeek ? 3 : 0));

    expect(month.revenue).toBe(300 + 150 + 60);
    expect(month.orders).toBe(3);
    expect(month.unitsSold).toBe(6);
    expect(month.customers).toBe(1);

    const monthNames = month.topProducts.map((p: { name: string }) => p.name);
    expect(monthNames).toContain('Olive');
    expect(monthNames).toContain('Cheese');
    expect(monthNames).toContain('Chicken');
    expect(month.topProducts[0].name).toBe('Olive');
    expect(month.topProducts[0].count).toBe(3);

    expect(data.dailyStats.length).toBeGreaterThan(0);
    expect(data.dailyStats[data.dailyStats.length - 1].unitsSold).toBeGreaterThanOrEqual(2);
    expect(data.revenueTrend.length).toBeGreaterThan(0);
  });

  it('requires analytics read permission', async () => {
    const customer = await createUser({ role: 'customer' });
    await api.get(DASHBOARD).set(bearer(customer.id)).expect(403);
  });
});

describe('analytics clear stats', () => {
  beforeEach(async () => {
    await seedRoles();
    await query('DELETE FROM orders');
  });

  it('zeroes dashboard stats while keeping orders, products, reviews and ratings intact', async () => {
    const admin = await createUser({ role: 'admin' });
    const customer = await createUser({ role: 'customer' });

    // A product with a published review + comment that must survive the reset,
    // plus non-zero rating counters that must also survive (product data).
    const product = await query<{ id: string }>(
      `INSERT INTO products (name, "nameEn", slug, description, "basePrice", "isAvailable")
       VALUES ('برجر', 'Burger', 'burger-clear-test', 'desc', 50, true) RETURNING id`,
    );
    await query(
      `INSERT INTO reviews ("userId", "productId", "reviewType", rating, comment, status)
       VALUES ($1, $2, 'meal', 5, 'لذيذ جداً', 'published')`,
      [customer.id, product[0].id],
    );
    await query(`UPDATE products SET rating = 4.5, "reviewsCount" = 3 WHERE id = $1`, [product[0].id]);

    await seedOrder(customer.id, { orderId: new Date(), name: 'Cheese', qty: 2, unitPrice: 150, status: 'completed' });

    const before = await api.get(DASHBOARD).set(bearer(admin.id)).expect(200);
    expect(before.body.data.orders).toBe(1);
    expect(before.body.data.revenue).toBe(300);

    await api.post('/api/v1/analytics/clear').set(bearer(admin.id)).expect(200);

    const after = await api.get(DASHBOARD).set(bearer(admin.id)).expect(200);
    // Order-derived dashboard stats are reset to zero…
    expect(after.body.data.orders).toBe(0);
    expect(after.body.data.revenue).toBe(0);
    expect(after.body.data.completedOrders).toBe(0);
    expect(after.body.data.revenueTrend).toHaveLength(0);
    expect(after.body.data.dailyStats).toHaveLength(0);
    // …but entity counts (products, customers) remain real.
    expect(after.body.data.products).toBeGreaterThanOrEqual(1);
    expect(after.body.data.customers).toBeGreaterThanOrEqual(1);

    // Business records are NOT deleted: the order is still in the DB.
    const orders = await query<{ n: string }>('SELECT count(*) AS n FROM orders');
    expect(Number(orders[0].n)).toBe(1);

    const reviews = await query<{ comment: string }>('SELECT comment FROM reviews');
    expect(reviews.map((r) => r.comment)).toContain('لذيذ جداً');

    // Product ratings / review counts are product data and are preserved.
    const productRow = await query<{ rating: string; reviewsCount: number }>(
      'SELECT rating, "reviewsCount" FROM products WHERE id = $1',
      [product[0].id],
    );
    expect(Number(productRow[0].rating)).toBe(4.5);
    expect(productRow[0].reviewsCount).toBe(3);
  });

  it('requires admin role (403 for customers)', async () => {
    const customer = await createUser({ role: 'customer' });
    await api.post('/api/v1/analytics/clear').set(bearer(customer.id)).expect(403);
  });
});