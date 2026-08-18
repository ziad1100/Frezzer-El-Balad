import { beforeEach, describe, expect, it } from 'vitest';
import * as categoriesRepo from '../../db/categories';
import * as productsRepo from '../../db/products';
import { query } from '../../db';
import { api, bearer, createUser, seedRoles, toId } from '../helpers';

const ORDERS = '/api/v1/orders';
const ANALYTICS = '/api/v1/analytics';

let catalogSeq = 0;

const setupCatalog = async () => {
  catalogSeq += 1;
  const category = await categoriesRepo.create({ name: 'بيتزا', nameEn: 'Pizza', slug: `pizza-${catalogSeq}`, type: 'section', isActive: true });
  const product = await productsRepo.create({
    name: 'بيبروني',
    nameEn: 'Pepperoni',
    slug: `pepperoni-${catalogSeq}`,
    category: toId(category._id),
    basePrice: 120,
    sizes: [{ name: 'كبير', nameEn: 'Large', price: 150 }],
    extras: [{ name: 'جبنة إضافية', nameEn: 'Extra cheese', price: 10 }],
    isAvailable: true,
  });
  return product;
};

const orderBody = (productId: string) => ({
  items: [{ product: productId, qty: 1 }],
  address: { city: 'Cairo', area: 'Maadi', street: 'Main', building: '5' },
  phone: '01000000000',
  customerName: 'Test Customer',
});

const createPendingOrder = async (): Promise<{ id: string; customerId: string }> => {
  const product = await setupCatalog();
  const customer = await createUser();
  const created = await api.post(ORDERS).set(bearer(customer.id)).send(orderBody(toId(product._id)));
  expect(created.status).toBe(201);
  return { id: created.body.data._id, customerId: customer.id };
};

const completeOrder = async (orderId: string): Promise<void> => {
  const admin = await createUser({ role: 'admin' });
  for (const next of ['preparing', 'on_delivery', 'completed']) {
    const res = await api.patch(`${ORDERS}/${orderId}/status`).set(bearer(admin.id)).send({ status: next });
    expect(res.status).toBe(200);
  }
};

describe('admin cancel order', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('requires an orders:update permission (403 for customers)', async () => {
    const { id } = await createPendingOrder();
    const customer = await createUser();
    const res = await api.post(`${ORDERS}/${id}/admin-cancel`).set(bearer(customer.id)).send({ reason: 'mistake' });
    expect(res.status).toBe(403);
  });

  it('stores the reason in statusHistory and excludes the order from revenue', async () => {
    const { id } = await createPendingOrder();
    const admin = await createUser({ role: 'admin' });
    const res = await api
      .post(`${ORDERS}/${id}/admin-cancel`)
      .set(bearer(admin.id))
      .send({ reason: 'Customer requested cancellation' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
    const last = res.body.data.statusHistory.at(-1);
    expect(last.status).toBe('cancelled');
    expect(last.reason).toBe('Customer requested cancellation');

    const stats = await api.get(`${ORDERS}/stats`).set(bearer(admin.id));
    expect(stats.body.data.cancelledOrders).toBe(1);
    expect(stats.body.data.completedOrders).toBe(0);
    expect(stats.body.data.revenue).toBe(0);

    const list = await api.get(`${ORDERS}/admin`).set(bearer(admin.id));
    expect(list.body.data.total).toBe(1);

    const logs = await query(`SELECT * FROM activity_logs WHERE resource = 'orders' AND action = 'cancel'`);
    expect(logs.length).toBe(1);
    expect(String(logs[0]?.targetId)).toBe(id);
  });

  it('allows cancelling a pending order without a reason', async () => {
    const { id } = await createPendingOrder();
    const admin = await createUser({ role: 'admin' });
    const res = await api.post(`${ORDERS}/${id}/admin-cancel`).set(bearer(admin.id)).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('rejects cancelling a completed order', async () => {
    const { id } = await createPendingOrder();
    await completeOrder(id);
    const admin = await createUser({ role: 'admin' });
    const res = await api.post(`${ORDERS}/${id}/admin-cancel`).set(bearer(admin.id)).send({ reason: 'too late' });
    expect(res.status).toBe(400);
    expect(res.body.data).toBeUndefined();
  });

  it('rejects cancelling an unknown order with 404', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await api
      .post(`${ORDERS}/00000000-0000-0000-0000-000000000000/admin-cancel`)
      .set(bearer(admin.id))
      .send({});
    expect(res.status).toBe(404);
  });
});

describe('complimentary orders', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('zeros the total, preserves original info and records the adjustment', async () => {
    const { id } = await createPendingOrder();
    const admin = await createUser({ role: 'admin' });
    const res = await api
      .post(`${ORDERS}/${id}/complimentary`)
      .set(bearer(admin.id))
      .send({ reason: 'Customer service compensation' });
    expect(res.status).toBe(200);
    const order = res.body.data;
    expect(order.status).toBe('complimentary');
    expect(order.isComplimentary).toBe(true);
    expect(order.total).toBe(0);
    expect(order.adjustmentAmount).toBe(145);
    expect(order.subtotal).toBe(120);
    expect(order.deliveryFee).toBe(25);
    expect(order.adjustmentReason).toBe('Customer service compensation');
    expect(order.adjustedAt).toBeTruthy();
    expect(order.adjustedBy).toMatchObject({ _id: admin.id });

    const stats = await api.get(`${ORDERS}/stats`).set(bearer(admin.id));
    expect(stats.body.data.complimentaryOrders).toBe(1);
    expect(stats.body.data.revenue).toBe(0);
    expect(stats.body.data.totalOrders).toBe(1);

    const logs = await query(`SELECT * FROM activity_logs WHERE resource = 'orders' AND action = 'complimentary'`);
    expect(logs.length).toBe(1);
    expect(String(logs[0]?.targetId)).toBe(id);
  });

  it('requires a reason (422 when missing)', async () => {
    const { id } = await createPendingOrder();
    const admin = await createUser({ role: 'admin' });
    const res = await api.post(`${ORDERS}/${id}/complimentary`).set(bearer(admin.id)).send({});
    expect(res.status).toBe(422);
  });

  it('rejects marking a refunded order as complimentary', async () => {
    const { id } = await createPendingOrder();
    await completeOrder(id);
    const admin = await createUser({ role: 'admin' });
    await api.patch(`${ORDERS}/${id}/status`).set(bearer(admin.id)).send({ status: 'refunded' });
    const res = await api
      .post(`${ORDERS}/${id}/complimentary`)
      .set(bearer(admin.id))
      .send({ reason: 'nope' });
    expect(res.status).toBe(400);
  });
});

describe('status transitions', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('rejects jumping pending -> completed directly', async () => {
    const { id } = await createPendingOrder();
    const admin = await createUser({ role: 'admin' });
    const res = await api.patch(`${ORDERS}/${id}/status`).set(bearer(admin.id)).send({ status: 'completed' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('transition');
  });

  it('allows refunded only from completed and blocks leaving terminal states', async () => {
    const { id } = await createPendingOrder();
    await completeOrder(id);
    const admin = await createUser({ role: 'admin' });
    const refund = await api.patch(`${ORDERS}/${id}/status`).set(bearer(admin.id)).send({ status: 'refunded' });
    expect(refund.status).toBe(200);
    expect(refund.body.data.status).toBe('refunded');
    const leave = await api.patch(`${ORDERS}/${id}/status`).set(bearer(admin.id)).send({ status: 'cancelled' });
    expect(leave.status).toBe(400);
  });

  it('allows admin to cancel an in-progress order', async () => {
    const { id } = await createPendingOrder();
    const admin = await createUser({ role: 'admin' });
    await api.patch(`${ORDERS}/${id}/status`).set(bearer(admin.id)).send({ status: 'preparing' });
    const res = await api.post(`${ORDERS}/${id}/admin-cancel`).set(bearer(admin.id)).send({ reason: 'cannot fulfill' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });
});

describe('daily revenue endpoint', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('returns live DB stats for a specific date', async () => {
    const { id } = await createPendingOrder();
    await completeOrder(id);
    const today = new Date().toISOString().slice(0, 10);
    const admin = await createUser({ role: 'admin' });
    const res = await api.get(`${ANALYTICS}/day?date=${today}`).set(bearer(admin.id));
    expect(res.status).toBe(200);
    expect(res.body.data.date).toBe(today);
    expect(res.body.data.orders).toBe(1);
    expect(res.body.data.completed).toBe(1);
    expect(res.body.data.cancelled).toBe(0);
    expect(res.body.data.complimentary).toBe(0);
    expect(res.body.data.revenue).toBe(145);
  });

  it('counts cancelled and complimentary orders separately', async () => {
    const a = await createPendingOrder();
    const b = await createPendingOrder();
    const admin = await createUser({ role: 'admin' });
    await api.post(`${ORDERS}/${a.id}/admin-cancel`).set(bearer(admin.id)).send({ reason: 'mistake' });
    await api.post(`${ORDERS}/${b.id}/complimentary`).set(bearer(admin.id)).send({ reason: 'gift' });
    const today = new Date().toISOString().slice(0, 10);
    const res = await api.get(`${ANALYTICS}/day?date=${today}`).set(bearer(admin.id));
    expect(res.body.data.orders).toBe(2);
    expect(res.body.data.cancelled).toBe(1);
    expect(res.body.data.complimentary).toBe(1);
    expect(res.body.data.completed).toBe(0);
    expect(res.body.data.revenue).toBe(0);
  });

  it('rejects a malformed date', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await api.get(`${ANALYTICS}/day?date=not-a-date`).set(bearer(admin.id));
    expect(res.status).toBe(400);
  });
});

describe('dashboard refresh endpoint', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('requires analytics permission (403 for customers)', async () => {
    const customer = await createUser();
    const res = await api.post(`${ANALYTICS}/refresh`).set(bearer(customer.id));
    expect(res.status).toBe(403);
  });

  it('invalidates the dashboard cache for staff', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await api.post(`${ANALYTICS}/refresh`).set(bearer(admin.id));
    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
  });
});

describe('dashboard financial rules', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('counts only completed orders toward revenue', async () => {
    const { id } = await createPendingOrder();
    const admin = await createUser({ role: 'admin' });
    const before = await api.get(`${ANALYTICS}/dashboard`).set(bearer(admin.id));
    expect(before.body.data.revenue).toBe(0);
    expect(before.body.data.completedOrders).toBe(0);
    expect(before.body.data.orders).toBe(1);

    await completeOrder(id);
    const after = await api.get(`${ANALYTICS}/dashboard`).set(bearer(admin.id));
    expect(after.body.data.revenue).toBe(145);
    expect(after.body.data.netRevenue).toBe(145);
    expect(after.body.data.grossRevenue).toBe(145);
    expect(after.body.data.deliveryFees).toBe(25);
    expect(after.body.data.completedOrders).toBe(1);
  });
});
