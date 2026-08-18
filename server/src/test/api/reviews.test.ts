import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as categoriesRepo from '../../db/categories';
import * as productsRepo from '../../db/products';
import { query } from '../../db';
import { api, bearer, createUser, seedRoles, toId } from '../helpers';

vi.mock('../../middlewares/rateLimiter', () => {
  const pass = (_req: unknown, _res: unknown, next: () => void) => next();
  return {
    authLimiter: pass,
    subscribeLimiter: pass,
    contactLimiter: pass,
    adminApiLimiter: pass,
    reviewsLimiter: pass,
  };
});

const ORDERS = '/api/v1/orders';
const REVIEWS = '/api/v1/reviews';
const PRODUCTS = '/api/v1/products';

let catalogSeq = 0;

const setupCatalog = async () => {
  catalogSeq += 1;
  const category = await categoriesRepo.create({
    name: 'بيتزا', nameEn: 'Pizza', slug: `rv-pizza-${catalogSeq}`, type: 'section', isActive: true,
  });
  const product = await productsRepo.create({
    name: 'بيبروني', nameEn: 'Pepperoni', slug: `rv-pepperoni-${catalogSeq}`,
    category: toId(category._id), basePrice: 120, isAvailable: true,
  });
  const other = await productsRepo.create({
    name: 'مارغريتا', nameEn: 'Margherita', slug: `rv-margherita-${catalogSeq}`,
    category: toId(category._id), basePrice: 90, isAvailable: true,
  });
  return { category, product, other };
};

const orderBody = (productId: unknown, qty = 1) => ({
  items: [{ product: toId(productId), qty }],
  address: { city: 'Cairo', area: 'Maadi', street: 'Main', building: '5' },
  phone: '01000000000',
  customerName: 'Test Customer',
});

const createOrder = async (customerId: string, productId: unknown, qty = 1): Promise<string> => {
  const created = await api.post(ORDERS).set(bearer(customerId)).send(orderBody(productId, qty));
  expect(created.status).toBe(201);
  return created.body.data._id;
};

const createCompletedOrder = async (customerId: string, productId: unknown, qty = 1): Promise<string> => {
  const orderId = await createOrder(customerId, productId, qty);
  await completeOrder(orderId);
  return orderId;
};

const completeOrder = async (orderId: string): Promise<void> => {
  const admin = await createUser({ role: 'admin' });
  for (const next of ['preparing', 'on_delivery', 'completed']) {
    const res = await api.patch(`${ORDERS}/${orderId}/status`).set(bearer(admin.id)).send({ status: next });
    expect(res.status).toBe(200);
  }
};

const mealReviewBody = (productId: unknown, orderId: string, extra: Record<string, unknown> = {}) => ({
  product: toId(productId),
  orderId,
  rating: 5,
  ...extra,
});

beforeEach(async () => {
  await seedRoles();
});

describe('reviews: verified purchase flow', () => {
  it('requires authentication to submit', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const orderId = await createCompletedOrder(customer.id, toId(product._id));
    const res = await api.post(REVIEWS).send(mealReviewBody(product._id, orderId));
    expect(res.status).toBe(401);
  });

  it('validates the rating range', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const orderId = await createCompletedOrder(customer.id, toId(product._id));
    const res = await api.post(REVIEWS).set(bearer(customer.id)).send(mealReviewBody(product._id, orderId, { rating: 9 }));
    expect(res.status).toBe(422);
  });

  it('requires an order id', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const res = await api
      .post(REVIEWS)
      .set(bearer(customer.id))
      .send({ product: toId(product._id), rating: 5 });
    expect(res.status).toBe(422);
  });

  it('creates a pending verified review; aggregates update only after admin publishes it', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    const orderId = await createCompletedOrder(customer.id, toId(product._id));
    const res = await api
      .post(REVIEWS)
      .set(bearer(customer.id))
      .send(mealReviewBody(product._id, orderId, { comment: 'Very delicious and fresh.' }));
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.isVerifiedPurchase).toBe(true);
    expect(res.body.data.orderId).toBe(orderId);
    expect(res.body.data.reviewType).toBe('meal');
    const untouched = await productsRepo.getById(toId(product._id));
    expect(untouched?.rating).toBe(0);
    expect(untouched?.reviewsCount).toBe(0);

    const published = await api.patch(`${REVIEWS}/${res.body.data._id}/moderate`).set(bearer(admin.id)).send({ status: 'published' });
    expect(published.status).toBe(200);
    const productRow = await productsRepo.getById(toId(product._id));
    expect(productRow?.rating).toBe(5);
    expect(productRow?.reviewsCount).toBe(1);
  });

  it('rejects reviews for meals that were not in the order', async () => {
    const { product, other } = await setupCatalog();
    const customer = await createUser();
    const orderId = await createCompletedOrder(customer.id, toId(product._id));
    const res = await api.post(REVIEWS).set(bearer(customer.id)).send(mealReviewBody(other._id, orderId));
    expect(res.status).toBe(400);
  });

  it('rejects reviews on someone elses order', async () => {
    const { product } = await setupCatalog();
    const owner = await createUser();
    const stranger = await createUser();
    const orderId = await createCompletedOrder(owner.id, toId(product._id));
    const res = await api.post(REVIEWS).set(bearer(stranger.id)).send(mealReviewBody(product._id, orderId));
    expect(res.status).toBe(400);
  });

  it('rejects reviews while the order is not completed', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    const pendingId = await createOrder(customer.id, toId(product._id));
    const pending = await api.post(REVIEWS).set(bearer(customer.id)).send(mealReviewBody(product._id, pendingId));
    expect(pending.status).toBe(400);

    const cancelledId = await createOrder(customer.id, toId(product._id));
    await api.post(`${ORDERS}/${cancelledId}/admin-cancel`).set(bearer(admin.id)).send({});
    const cancelled = await api
      .post(REVIEWS)
      .set(bearer(customer.id))
      .send(mealReviewBody(product._id, cancelledId, { rating: 4 }));
    expect(cancelled.status).toBe(400);
  });

  it('prevents duplicate reviews for the same order and meal', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const orderId = await createCompletedOrder(customer.id, toId(product._id));
    await api.post(REVIEWS).set(bearer(customer.id)).send(mealReviewBody(product._id, orderId));
    const dup = await api.post(REVIEWS).set(bearer(customer.id)).send(mealReviewBody(product._id, orderId, { rating: 3 }));
    expect(dup.status).toBe(409);
    const rows = await query<{ n: string }>(
      `SELECT count(*)::int AS n FROM reviews WHERE "orderId" = $1 AND "reviewType" = 'meal'`,
      [orderId],
    );
    expect(Number(rows[0]?.n ?? 0)).toBe(1);
  });

  it('allows a fresh review when the same meal is ordered again', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const first = await createCompletedOrder(customer.id, toId(product._id));
    const second = await createCompletedOrder(customer.id, toId(product._id));
    await api.post(REVIEWS).set(bearer(customer.id)).send(mealReviewBody(product._id, first));
    const res = await api.post(REVIEWS).set(bearer(customer.id)).send(mealReviewBody(product._id, second));
    expect(res.status).toBe(201);
    const rows = await query<{ n: string }>(
      `SELECT count(*)::int AS n FROM reviews WHERE "productId" = $1 AND "reviewType" = 'meal'`,
      [toId(product._id)],
    );
    expect(Number(rows[0]?.n ?? 0)).toBe(2);
  });

  it('exposes only published reviews with a summary on the meal endpoint', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    const orderId = await createCompletedOrder(customer.id, toId(product._id));
    const created = await api.post(REVIEWS).set(bearer(customer.id)).send(mealReviewBody(product._id, orderId, { rating: 5 }));
    expect(created.body.data.status).toBe('pending');
    const whilePending = await api.get(`${REVIEWS}/meal/${toId(product._id)}`);
    expect(whilePending.body.data.items).toHaveLength(0);
    expect(whilePending.body.data.summary.total).toBe(0);
    const hidden = await api.patch(`${REVIEWS}/${created.body.data._id}/moderate`).set(bearer(admin.id)).send({ status: 'hidden' });
    expect(hidden.status).toBe(200);
    const res = await api.get(`${REVIEWS}/meal/${toId(product._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.summary.total).toBe(0);
    await api.patch(`${REVIEWS}/${created.body.data._id}/moderate`).set(bearer(admin.id)).send({ status: 'published' });
    const visible = await api.get(`${REVIEWS}/meal/${toId(product._id)}`);
    expect(visible.body.data.items).toHaveLength(1);
    expect(visible.body.data.items[0].isVerifiedPurchase).toBe(true);
    expect(visible.body.data.items[0].user.fullName).toBe('Test User');
    expect(visible.body.data.summary).toMatchObject({ total: 1, average: 5, '5': 1, '4': 0, '1': 0 });
    expect((await api.get(`${PRODUCTS}/rv-pepperoni-${catalogSeq}`)).body.data.reviews).toHaveLength(1);
  });
});

describe('reviews: restaurant experience', () => {
  it('lets a customer rate their completed order once', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    const orderId = await createCompletedOrder(customer.id, toId(product._id));
    const res = await api
      .post(`${REVIEWS}/restaurant`)
      .set(bearer(customer.id))
      .send({ orderId, rating: 4, comment: 'Great service', foodQuality: 5, delivery: 4 });
    expect(res.status).toBe(201);
    expect(res.body.data.reviewType).toBe('restaurant');
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.isVerifiedPurchase).toBe(true);
    expect(res.body.data.foodQuality).toBe(5);

    const before = await api.get(`${REVIEWS}/restaurant`);
    expect(before.body.data.total).toBe(0);

    await api.patch(`${REVIEWS}/${res.body.data._id}/moderate`).set(bearer(admin.id)).send({ status: 'published' });
    const stats = await api.get(`${REVIEWS}/restaurant`);
    expect(stats.body.data).toMatchObject({ total: 1, average: 4, '4': 1, '5': 0 });

    const dup = await api.post(`${REVIEWS}/restaurant`).set(bearer(customer.id)).send({ orderId, rating: 2 });
    expect(dup.status).toBe(409);
  });

  it('rejects restaurant reviews for non-completed or foreign orders', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const pendingId = await createOrder(customer.id, toId(product._id));
    const pending = await api.post(`${REVIEWS}/restaurant`).set(bearer(customer.id)).send({ orderId: pendingId, rating: 5 });
    expect(pending.status).toBe(400);

    const other = await createUser();
    const foreignId = await createCompletedOrder(other.id, toId(product._id));
    const foreign = await api.post(`${REVIEWS}/restaurant`).set(bearer(customer.id)).send({ orderId: foreignId, rating: 5 });
    expect(foreign.status).toBe(400);
  });

  it('lets the owner edit restaurant category ratings', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const orderId = await createCompletedOrder(customer.id, toId(product._id));
    const created = await api
      .post(`${REVIEWS}/restaurant`)
      .set(bearer(customer.id))
      .send({ orderId, rating: 4, foodQuality: 5, delivery: 4 });
    expect(created.status).toBe(201);

    const edited = await api
      .patch(`${REVIEWS}/${created.body.data._id}`)
      .set(bearer(customer.id))
      .send({ rating: 3, comment: 'Updated experience', foodQuality: 2, delivery: 5, overall: 4 });
    expect(edited.status).toBe(200);
    expect(edited.body.data.rating).toBe(3);
    expect(edited.body.data.comment).toBe('Updated experience');
    expect(edited.body.data.foodQuality).toBe(2);
    expect(edited.body.data.delivery).toBe(5);
    expect(edited.body.data.overall).toBe(4);

    const stranger = await createUser();
    expect(
      (await api.patch(`${REVIEWS}/${created.body.data._id}`).set(bearer(stranger.id)).send({ rating: 1, foodQuality: 1 })).status,
    ).toBe(404);
  });

  it('rejects out-of-range category ratings on edit', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const orderId = await createCompletedOrder(customer.id, toId(product._id));
    const created = await api.post(`${REVIEWS}/restaurant`).set(bearer(customer.id)).send({ orderId, rating: 4 });
    const res = await api
      .patch(`${REVIEWS}/${created.body.data._id}`)
      .set(bearer(customer.id))
      .send({ rating: 4, delivery: 9 });
    expect(res.status).toBe(422);
  });

  it('requires an order id', async () => {
    const customer = await createUser();
    const res = await api.post(`${REVIEWS}/restaurant`).set(bearer(customer.id)).send({ rating: 5 });
    expect(res.status).toBe(422);
  });
});

describe('reviews: eligibility, edit and delete', () => {
  it('lists completed orders eligible for a meal review', async () => {
    const { product, other } = await setupCatalog();
    const customer = await createUser();
    const a = await createCompletedOrder(customer.id, toId(product._id));
    const b = await createCompletedOrder(customer.id, toId(product._id));
    const pending = await createOrder(customer.id, toId(product._id));
    const res = await api.get(`${REVIEWS}/eligible/${toId(product._id)}`).set(bearer(customer.id));
    expect(res.status).toBe(200);
    expect(res.body.data.map((o: { _id: string }) => o._id).sort()).toEqual([a, b].sort());
    expect(res.body.data).not.toContainEqual(expect.objectContaining({ _id: pending }));
    const none = await api.get(`${REVIEWS}/eligible/${toId(other._id)}`).set(bearer(customer.id));
    expect(none.body.data).toEqual([]);
  });

  it('excludes orders that were already reviewed for the meal', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const first = await createCompletedOrder(customer.id, toId(product._id));
    const second = await createCompletedOrder(customer.id, toId(product._id));
    await api.post(REVIEWS).set(bearer(customer.id)).send(mealReviewBody(product._id, first));
    const res = await api.get(`${REVIEWS}/eligible/${toId(product._id)}`).set(bearer(customer.id));
    expect(res.body.data.map((o: { _id: string }) => o._id)).toEqual([second]);
  });

  it('requires authentication for the eligible endpoint', async () => {
    const { product } = await setupCatalog();
    expect((await api.get(`${REVIEWS}/eligible/${toId(product._id)}`)).status).toBe(401);
  });
  it('reports which items are reviewable on a completed order', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const orderId = await createCompletedOrder(customer.id, toId(product._id));
    const before = await api.get(`${REVIEWS}/order/${orderId}`).set(bearer(customer.id));
    expect(before.status).toBe(200);
    expect(before.body.data.order.status).toBe('completed');
    expect(before.body.data.items[0]).toMatchObject({ productId: toId(product._id), reviewId: null });
    expect(before.body.data.restaurant).toBeNull();

    const created = await api.post(REVIEWS).set(bearer(customer.id)).send(mealReviewBody(product._id, orderId));
    const after = await api.get(`${REVIEWS}/order/${orderId}`).set(bearer(customer.id));
    expect(after.body.data.items[0].reviewId).toBe(created.body.data._id);
    expect(after.body.data.items[0].reviewRating).toBe(5);
  });

  it('returns 404 for foreign or unknown orders', async () => {
    const { product } = await setupCatalog();
    const owner = await createUser();
    const stranger = await createUser();
    const orderId = await createCompletedOrder(owner.id, toId(product._id));
    expect((await api.get(`${REVIEWS}/order/${orderId}`).set(bearer(stranger.id))).status).toBe(404);
    expect((await api.get(`${REVIEWS}/order/00000000-0000-0000-0000-000000000000`).set(bearer(stranger.id))).status).toBe(404);
  });

  it('lets the owner edit their review and keeps aggregates in sync', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    const orderId = await createCompletedOrder(customer.id, toId(product._id));
    const created = await api.post(REVIEWS).set(bearer(customer.id)).send(mealReviewBody(product._id, orderId));
    const edited = await api.patch(`${REVIEWS}/${created.body.data._id}`).set(bearer(customer.id)).send({ rating: 3, comment: 'Updated' });
    expect(edited.status).toBe(200);
    expect(edited.body.data.rating).toBe(3);
    expect(edited.body.data.comment).toBe('Updated');
    expect((await productsRepo.getById(toId(product._id)))?.rating).toBe(0);

    await api.patch(`${REVIEWS}/${created.body.data._id}/moderate`).set(bearer(admin.id)).send({ status: 'published' });
    const productRow = await productsRepo.getById(toId(product._id));
    expect(productRow?.rating).toBe(3);
  });

  it('rejects editing or deleting another users review', async () => {
    const { product } = await setupCatalog();
    const owner = await createUser();
    const stranger = await createUser();
    const orderId = await createCompletedOrder(owner.id, toId(product._id));
    const created = await api.post(REVIEWS).set(bearer(owner.id)).send(mealReviewBody(product._id, orderId));
    const id = created.body.data._id;
    expect((await api.patch(`${REVIEWS}/${id}`).set(bearer(stranger.id)).send({ rating: 1 })).status).toBe(404);
    expect((await api.delete(`${REVIEWS}/${id}`).set(bearer(stranger.id))).status).toBe(404);
  });

  it('deletes the owners review and restores product aggregates', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const orderId = await createCompletedOrder(customer.id, toId(product._id));
    const created = await api.post(REVIEWS).set(bearer(customer.id)).send(mealReviewBody(product._id, orderId));
    const res = await api.delete(`${REVIEWS}/${created.body.data._id}`).set(bearer(customer.id));
    expect(res.status).toBe(200);
    const rows = await query<{ n: string }>('SELECT count(*)::int AS n FROM reviews');
    expect(Number(rows[0]?.n ?? 0)).toBe(0);
    const productRow = await productsRepo.getById(toId(product._id));
    expect(productRow?.rating).toBe(0);
    expect(productRow?.reviewsCount).toBe(0);
  });
});

describe('reviews: admin moderation and stats', () => {
  it('blocks customers from admin review endpoints', async () => {
    const customer = await createUser();
    expect((await api.get(`${REVIEWS}/admin`).set(bearer(customer.id))).status).toBe(403);
    expect((await api.get(`${REVIEWS}/admin/stats`).set(bearer(customer.id))).status).toBe(403);
    const { product } = await setupCatalog();
    const orderId = await createCompletedOrder(customer.id, toId(product._id));
    const created = await api.post(REVIEWS).set(bearer(customer.id)).send(mealReviewBody(product._id, orderId));
    expect((await api.patch(`${REVIEWS}/${created.body.data._id}/moderate`).set(bearer(customer.id)).send({ status: 'hidden' })).status).toBe(403);
    expect((await api.delete(`${REVIEWS}/admin/${created.body.data._id}`).set(bearer(customer.id))).status).toBe(403);
  });

  it('lets admins list, filter and sort reviews', async () => {
    const { product } = await setupCatalog();
    const admin = await createUser({ role: 'admin' });
    const a = await createUser();
    const b = await createUser();
    const orderA = await createCompletedOrder(a.id, toId(product._id));
    const orderB = await createCompletedOrder(b.id, toId(product._id));
    const r5 = await api.post(REVIEWS).set(bearer(a.id)).send(mealReviewBody(product._id, orderA));
    const r1 = await api.post(REVIEWS).set(bearer(b.id)).send(mealReviewBody(product._id, orderB, { rating: 1, comment: 'bad' }));
    await api.patch(`${REVIEWS}/${r1.body.data._id}/moderate`).set(bearer(admin.id)).send({ status: 'hidden' });

    const all = await api.get(`${REVIEWS}/admin`).set(bearer(admin.id));
    expect(all.body.data.total).toBe(2);
    const hidden = await api.get(`${REVIEWS}/admin?status=hidden`).set(bearer(admin.id));
    expect(hidden.body.data.total).toBe(1);
    const rated = await api.get(`${REVIEWS}/admin?rating=5`).set(bearer(admin.id));
    expect(rated.body.data.total).toBe(1);
    expect(rated.body.data.items[0].rating).toBe(5);
    const searched = await api.get(`${REVIEWS}/admin?q=Pepperoni`).set(bearer(admin.id));
    expect(searched.body.data.total).toBe(2);
    const commentMatches = await api.get(`${REVIEWS}/admin?q=bad-comment-match`).set(bearer(admin.id));
    expect(commentMatches.body.data.total).toBe(0);
    const commentHit = await api.get(`${REVIEWS}/admin?q=bad`).set(bearer(admin.id));
    expect(commentHit.body.data.total).toBe(1);
    expect(commentHit.body.data.items[0].comment).toBe('bad');
    const oldest = await api.get(`${REVIEWS}/admin?sort=oldest`).set(bearer(admin.id));
    expect(oldest.body.data.items[0]._id).toBe(r5.body.data._id);
  });

  it('filters reviews by verified purchase status', async () => {
    const { product } = await setupCatalog();
    const admin = await createUser({ role: 'admin' });
    const a = await createUser();
    const b = await createUser();
    const orderA = await createCompletedOrder(a.id, toId(product._id));
    const orderB = await createCompletedOrder(b.id, toId(product._id));
    await api.post(REVIEWS).set(bearer(a.id)).send(mealReviewBody(product._id, orderA, { rating: 5 }));
    await api.post(REVIEWS).set(bearer(b.id)).send(mealReviewBody(product._id, orderB, { rating: 2 }));

    const verifiedOnly = await api.get(`${REVIEWS}/admin?verified=1`).set(bearer(admin.id));
    expect(verifiedOnly.body.data.total).toBe(2);
    expect(verifiedOnly.body.data.items.every((r: { isVerifiedPurchase: boolean }) => r.isVerifiedPurchase)).toBe(true);

    const created = await query<{ id: string }>(
      `UPDATE reviews SET "isVerifiedPurchase" = false
       WHERE "orderId" = $1 RETURNING id`,
      [orderB],
    );
    expect(created).toHaveLength(1);

    const unverified = await api.get(`${REVIEWS}/admin?verified=0`).set(bearer(admin.id));
    expect(unverified.body.data.total).toBe(1);
    expect(unverified.body.data.items[0].rating).toBe(2);
    const mix = await api.get(`${REVIEWS}/admin`).set(bearer(admin.id));
    expect(mix.body.data.total).toBe(2);
  });

  it('filters reviews by a specific meal', async () => {
    const { product, other } = await setupCatalog();
    const admin = await createUser({ role: 'admin' });
    const a = await createUser();
    const b = await createUser();
    const orderA = await createCompletedOrder(a.id, toId(product._id));
    const orderB = await createCompletedOrder(b.id, toId(other._id), 2);
    await api.post(REVIEWS).set(bearer(a.id)).send(mealReviewBody(product._id, orderA, { rating: 5 }));
    await api.post(REVIEWS).set(bearer(b.id)).send(mealReviewBody(other._id, orderB, { rating: 4 }));

    const filtered = await api.get(`${REVIEWS}/admin?product=${toId(product._id)}`).set(bearer(admin.id));
    expect(filtered.body.data.total).toBe(1);
    expect(filtered.body.data.items[0].product._id).toBe(toId(product._id));
    expect(filtered.body.data.items[0].rating).toBe(5);
  });

  it('computes admin stats from published reviews only', async () => {
    const { product } = await setupCatalog();
    const admin = await createUser({ role: 'admin' });
    const a = await createUser();
    const b = await createUser();
    const orderA = await createCompletedOrder(a.id, toId(product._id));
    const orderB = await createCompletedOrder(b.id, toId(product._id));
    const good = await api.post(REVIEWS).set(bearer(a.id)).send(mealReviewBody(product._id, orderA, { rating: 5 }));
    const low = await api.post(REVIEWS).set(bearer(b.id)).send(mealReviewBody(product._id, orderB, { rating: 1 }));
    const experience = await api.post(`${REVIEWS}/restaurant`).set(bearer(a.id)).send({ orderId: orderA, rating: 4 });

    const before = (await api.get(`${REVIEWS}/admin/stats`).set(bearer(admin.id))).body.data;
    expect(before.total).toBe(3);
    expect(before.published).toBe(0);
    expect(before.fiveStar).toBe(0);
    expect(before.restaurantTotal).toBe(0);

    await api.patch(`${REVIEWS}/${low.body.data._id}/moderate`).set(bearer(admin.id)).send({ status: 'hidden' });
    await api.patch(`${REVIEWS}/${good.body.data._id}/moderate`).set(bearer(admin.id)).send({ status: 'published' });
    await api.patch(`${REVIEWS}/${experience.body.data._id}/moderate`).set(bearer(admin.id)).send({ status: 'published' });

    const stats = await api.get(`${REVIEWS}/admin/stats`).set(bearer(admin.id));
    const data = stats.body.data;
    expect(data.total).toBe(3);
    expect(data.published).toBe(1);
    expect(data.today).toBe(3);
    expect(data.fiveStar).toBe(1);
    expect(data.oneStar).toBe(0);
    expect(data.average).toBe(5);
    expect(data.restaurantTotal).toBe(1);
    expect(data.restaurantAverage).toBe(4);
    expect(data.mostReviewed[0]).toMatchObject({ reviews: 1 });
    expect(data.highestRated[0].average).toBe(5);
    expect(data.lowestRated[0].reviews).toBe(1);
  });
});

describe('reviews: quick meal-card reviews (no order)', () => {
  it('requires authentication', async () => {
    const { product } = await setupCatalog();
    const res = await api.post(`${REVIEWS}/quick`).send({ product: toId(product._id), rating: 5 });
    expect(res.status).toBe(401);
  });

  it('publishes instantly and updates the product rating', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const res = await api
      .post(`${REVIEWS}/quick`)
      .set(bearer(customer.id))
      .send({ product: toId(product._id), rating: 5, comment: 'Tastes amazing' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.isVerifiedPurchase).toBe(false);
    expect(res.body.data.orderId).toBeNull();
    expect(res.body.data.reviewType).toBe('meal');
    expect(res.body.data.comment).toBe('Tastes amazing');

    const row = await productsRepo.getById(toId(product._id));
    expect(row?.rating).toBe(5);
    expect(row?.reviewsCount).toBe(1);

    const publicList = await api.get(`${REVIEWS}/meal/${toId(product._id)}`);
    expect(publicList.body.data.items).toHaveLength(1);
    expect(publicList.body.data.summary).toMatchObject({ total: 1, average: 5, '5': 1 });
  });

  it('blocks a second quick review for the same meal', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    await api.post(`${REVIEWS}/quick`).set(bearer(customer.id)).send({ product: toId(product._id), rating: 4 });
    const dup = await api.post(`${REVIEWS}/quick`).set(bearer(customer.id)).send({ product: toId(product._id), rating: 1 });
    expect(dup.status).toBe(409);
    const rows = await query<{ n: string }>(
      `SELECT count(*)::int AS n FROM reviews WHERE "productId" = $1 AND "orderId" IS NULL AND "reviewType" = 'meal'`,
      [toId(product._id)],
    );
    expect(Number(rows[0]?.n ?? 0)).toBe(1);
  });

  it('still allows a verified order review for the same meal alongside the quick one', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    await api.post(`${REVIEWS}/quick`).set(bearer(customer.id)).send({ product: toId(product._id), rating: 5 });
    const orderId = await createCompletedOrder(customer.id, toId(product._id));
    const verified = await api
      .post(REVIEWS)
      .set(bearer(customer.id))
      .send(mealReviewBody(product._id, orderId, { rating: 4 }));
    expect(verified.status).toBe(201);
    expect(verified.body.data.isVerifiedPurchase).toBe(true);
  });

  it('validates the rating and rejects unknown products', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    expect(
      (await api.post(`${REVIEWS}/quick`).set(bearer(customer.id)).send({ product: toId(product._id), rating: 9 })).status,
    ).toBe(422);
    expect(
      (await api.post(`${REVIEWS}/quick`).set(bearer(customer.id)).send({ rating: 5 })).status,
    ).toBe(422);
    const stranger = await createUser();
    const missing = await api
      .post(`${REVIEWS}/quick`)
      .set(bearer(stranger.id))
      .send({ product: '00000000-0000-0000-0000-000000000000', rating: 5 });
    expect(missing.status).toBe(404);
  });

  it('appears in the admin review list for moderation/management', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    await api
      .post(`${REVIEWS}/quick`)
      .set(bearer(customer.id))
      .send({ product: toId(product._id), rating: 3, comment: 'Decent' });
    const all = await api.get(`${REVIEWS}/admin`).set(bearer(admin.id));
    expect(all.body.data.total).toBe(1);
    expect(all.body.data.items[0]).toMatchObject({
      rating: 3,
      comment: 'Decent',
      isVerifiedPurchase: false,
      orderId: null,
    });
  });
});

describe('reviews: pending orders (smart review prompt)', () => {
  it('requires authentication', async () => {
    expect((await api.get(`${REVIEWS}/pending-orders`)).status).toBe(401);
  });

  it('lists only completed orders that still have something to review', async () => {
    const { product } = await setupCatalog();
    const customer = await createUser();
    const completed = await createCompletedOrder(customer.id, toId(product._id));
    await createOrder(customer.id, toId(product._id)); // still pending — must not appear

    const res = await api.get(`${REVIEWS}/pending-orders`).set(bearer(customer.id));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      orderId: completed,
      unreviewedItems: 1,
      hasExperienceReview: false,
    });

    // reviewing the meal clears unreviewedItems but the order stays until the experience is rated
    await api.post(REVIEWS).set(bearer(customer.id)).send(mealReviewBody(product._id, completed));
    const afterMeal = await api.get(`${REVIEWS}/pending-orders`).set(bearer(customer.id));
    expect(afterMeal.body.data).toHaveLength(1);
    expect(afterMeal.body.data[0]).toMatchObject({ orderId: completed, unreviewedItems: 0, hasExperienceReview: false });

    // once the experience review exists, nothing is pending anymore
    await api.post(`${REVIEWS}/restaurant`).set(bearer(customer.id)).send({ orderId: completed, rating: 4 });
    const afterAll = await api.get(`${REVIEWS}/pending-orders`).set(bearer(customer.id));
    expect(afterAll.body.data).toEqual([]);
  });
});