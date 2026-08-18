import { beforeEach, describe, expect, it } from 'vitest';
import * as categoriesRepo from '../../db/categories';
import * as productsRepo from '../../db/products';
import { api, bearer, createUser, seedRoles, toId } from '../helpers';

const AUTH = '/api/v1/auth';
const ORDERS = '/api/v1/orders';
const PRODUCTS = '/api/v1/products';
const REVIEWS = '/api/v1/reviews';
const COUPONS = '/api/v1/coupons';
const CART = '/api/v1/cart';
const SETTINGS = '/api/v1/settings';
const CATEGORIES = '/api/v1/categories';
const OFFERS = '/api/v1/offers';
const BRANCHES = '/api/v1/branches';
const CONTACT = '/api/v1/contacts';

const setupCatalog = async () => {
  const category = await categoriesRepo.create({ name: 'بيتزا', nameEn: 'Pizza', slug: 'pizza', type: 'section', isActive: true });
  const product = await productsRepo.create({
    name: 'بيبروني',
    nameEn: 'Pepperoni',
    slug: 'pepperoni',
    category: toId(category._id),
    basePrice: 120,
    sizes: [{ name: 'كبير', nameEn: 'Large', price: 150 }],
    extras: [{ name: 'جبنة إضافية', nameEn: 'Extra cheese', price: 10 }],
    isAvailable: true,
  });
  return { category, product };
};

describe('zod validation', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  describe('auth', () => {
    it('rejects an invalid email on register with 422', async () => {
      const res = await api.post(`${AUTH}/register`).send({ fullName: 'Bad', email: 'not-an-email', password: 'Pizza123!' });
      expect(res.status).toBe(422);
    });

    it('rejects a password without digits on register with 422', async () => {
      const res = await api.post(`${AUTH}/register`).send({ fullName: 'Bad', email: 'a@b.com', password: 'abcdefgh' });
      expect(res.status).toBe(422);
    });

    it('requires adminCode when registering as admin with 422', async () => {
      const res = await api.post(`${AUTH}/register`).send({
        fullName: 'Bad',
        email: 'admin@x.com',
        password: 'Pizza123!',
        role: 'admin',
      });
      expect(res.status).toBe(422);
    });

    it('rejects a short new password on change-password with 422', async () => {
      const user = await createUser();
      const res = await api
        .post(`${AUTH}/change-password`)
        .set(bearer(user.id))
        .send({ currentPassword: 'Pizza123!', newPassword: 'short' });
      expect(res.status).toBe(422);
    });
  });

  describe('orders', () => {
    it('rejects an item without qty with 422', async () => {
      const { product } = await setupCatalog();
      const user = await createUser();
      const res = await api
        .post(ORDERS)
        .set(bearer(user.id))
        .send({
          items: [{ product: toId(product._id) }],
          address: { city: 'Cairo', street: 'Main', building: '5' },
          phone: '01000000000',
        });
      expect(res.status).toBe(422);
    });

    it('rejects an item with an invalid product id format with 422', async () => {
      const user = await createUser();
      const res = await api
        .post(ORDERS)
        .set(bearer(user.id))
        .send({
          items: [{ product: 'xyz', qty: 1 }],
          address: { city: 'Cairo', street: 'Main', building: '5' },
          phone: '01000000000',
        });
      expect(res.status).toBe(422);
    });

    it('rejects a zero quantity with 422', async () => {
      const { product } = await setupCatalog();
      const user = await createUser();
      const res = await api
        .post(ORDERS)
        .set(bearer(user.id))
        .send({
          items: [{ product: toId(product._id), qty: 0 }],
          address: { city: 'Cairo', street: 'Main', building: '5' },
          phone: '01000000000',
        });
      expect(res.status).toBe(422);
    });

    it('rejects a negative extra price with 422', async () => {
      const { product } = await setupCatalog();
      const user = await createUser();
      const res = await api
        .post(ORDERS)
        .set(bearer(user.id))
        .send({
          items: [{ product: toId(product._id), qty: 1, extras: [{ name: 'X', price: -5 }] }],
          address: { city: 'Cairo', street: 'Main', building: '5' },
          phone: '01000000000',
        });
      expect(res.status).toBe(422);
    });

    it('rejects a missing address with 422', async () => {
      const { product } = await setupCatalog();
      const user = await createUser();
      const res = await api.post(ORDERS).set(bearer(user.id)).send({ items: [{ product: toId(product._id), qty: 1 }] });
      expect(res.status).toBe(422);
    });
  });

  describe('egyptian mobile phone', () => {
    it('accepts the four valid prefixes on checkout', async () => {
      const { product } = await setupCatalog();
      const user = await createUser();
      for (const phone of ['01012345678', '01112345678', '01212345678', '01512345678']) {
        const res = await api
          .post(ORDERS)
          .set(bearer(user.id))
          .send({
            items: [{ product: toId(product._id), qty: 1 }],
            address: { city: 'Cairo', area: 'Maadi', street: 'Main', building: '5' },
            phone,
          });
        expect(res.status).toBe(201);
      }
    });

    it('rejects wrong length, prefix, letters, spaces and separators on checkout', async () => {
      const { product } = await setupCatalog();
      const user = await createUser();
      const invalid = [
        '0101234567',
        '010123456789',
        '01312345678',
        '01412345678',
        '01612345678',
        '12345678901',
        '01012345abc',
        '010-1234-5678',
        '010 1234 5678',
      ];
      for (const phone of invalid) {
        const res = await api
          .post(ORDERS)
          .set(bearer(user.id))
          .send({
            items: [{ product: toId(product._id), qty: 1 }],
            address: { city: 'Cairo', area: 'Maadi', street: 'Main', building: '5' },
            phone,
          });
        expect(res.status).toBe(422);
      }
    });

    it('validates the phone on registration', async () => {
      const bad = await api
        .post(`${AUTH}/register`)
        .send({ fullName: 'User', email: 'phone-bad@example.com', phone: '01612345678', password: 'Pizza123!' });
      expect(bad.status).toBe(422);

      const ok = await api
        .post(`${AUTH}/register`)
        .send({ fullName: 'User', email: 'phone-ok@example.com', phone: '01512345678', password: 'Pizza123!' });
      expect(ok.status).toBe(201);
      expect(ok.body.data.user.phone).toBe('01512345678');
    });
  });

  describe('cart', () => {
    it('rejects a zero quantity on addItem with 422', async () => {
      const { product } = await setupCatalog();
      const user = await createUser();
      const res = await api
        .post(`${CART}/items`)
        .set(bearer(user.id))
        .send({ product: toId(product._id), qty: 0 });
      expect(res.status).toBe(422);
    });

    it('rejects an invalid product id on addItem with 422', async () => {
      const user = await createUser();
      const res = await api
        .post(`${CART}/items`)
        .set(bearer(user.id))
        .send({ product: 'not-an-id', qty: 1 });
      expect(res.status).toBe(422);
    });
  });

  describe('content & admin', () => {
    it('rejects a negative base price on product create with 422', async () => {
      const { category } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .post(PRODUCTS)
        .set(bearer(admin.id))
        .send({ name: 'X', category: toId(category._id), basePrice: -5 });
      expect(res.status).toBe(422);
    });

    it('rejects a non-numeric product update field with 422', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ basePrice: 'not-a-number' });
      expect(res.status).toBe(422);
    });

    it('rejects an invalid category type with 422', async () => {
      const admin = await createUser({ role: 'admin' });
      const res = await api.post(CATEGORIES).set(bearer(admin.id)).send({ name: 'X', type: 'nope' });
      expect(res.status).toBe(422);
    });

    it('rejects an offer missing startDate with 422', async () => {
      const admin = await createUser({ role: 'admin' });
      const res = await api.post(OFFERS).set(bearer(admin.id)).send({ title: 'Big Deal' });
      expect(res.status).toBe(422);
    });

    it('rejects a branch missing a name with 422', async () => {
      const admin = await createUser({ role: 'admin' });
      const res = await api.post(BRANCHES).set(bearer(admin.id)).send({ address: 'Cairo' });
      expect(res.status).toBe(422);
    });

    it('rejects an invalid coupon type with 422', async () => {
      const admin = await createUser({ role: 'admin' });
      const res = await api.post(COUPONS).set(bearer(admin.id)).send({ code: 'X10', type: 'half', value: 5 });
      expect(res.status).toBe(422);
    });

    it('rejects a negative coupon value with 422', async () => {
      const admin = await createUser({ role: 'admin' });
      const res = await api.post(COUPONS).set(bearer(admin.id)).send({ code: 'X10', type: 'percent', value: -3 });
      expect(res.status).toBe(422);
    });

    it('rejects an invalid status on review moderate with 422', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const customer = await createUser();
      const orderId = (
        await api
          .post(ORDERS)
          .set(bearer(customer.id))
          .send({
            items: [{ product: toId(product._id), qty: 1 }],
            address: { city: 'Cairo', area: 'Maadi', street: 'Main', building: '5' },
            phone: '01000000000',
            customerName: 'Test Customer',
          })
      ).body.data._id;
      for (const next of ['preparing', 'on_delivery', 'completed']) {
        await api.patch(`${ORDERS}/${orderId}/status`).set(bearer(admin.id)).send({ status: next });
      }
      const created = await api
        .post(REVIEWS)
        .set(bearer(customer.id))
        .send({ product: toId(product._id), orderId, rating: 5 });
      const reviewId = created.body.data._id;
      const res = await api
        .patch(`${REVIEWS}/${reviewId}/moderate`)
        .set(bearer(admin.id))
        .send({ status: 'spam' });
      expect(res.status).toBe(422);
    });
  });

  describe('settings', () => {
    it('strips unknown keys while persisting known ones', async () => {
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(SETTINGS)
        .set(bearer(admin.id))
        .send({ deliveryFee: 30, evilSetting: 'injected' });
      expect(res.status).toBe(200);
      expect(res.body.data.deliveryFee).toBe(30);
      expect('evilSetting' in res.body.data).toBe(false);
    });

    it('rejects a non-numeric delivery fee with 422', async () => {
      const admin = await createUser({ role: 'admin' });
      const res = await api.patch(SETTINGS).set(bearer(admin.id)).send({ deliveryFee: 'abc' });
      expect(res.status).toBe(422);
    });
  });

  describe('misc public', () => {
    it('rejects an invalid contact email with 422', async () => {
      const res = await api
        .post(CONTACT)
        .send({ name: 'N', phone: '01000000000', email: 'bad', message: 'hi' });
      expect(res.status).toBe(422);
    });
  });
});