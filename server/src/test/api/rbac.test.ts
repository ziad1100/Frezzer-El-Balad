import { beforeEach, describe, expect, it } from 'vitest';
import * as categoriesRepo from '../../db/categories';
import * as productsRepo from '../../db/products';
import { api, bearer, createUser, seedRoles, toId } from '../helpers';

const USERS = '/api/v1/admin/users';
const PRODUCTS = '/api/v1/products';
const SETTINGS = '/api/v1/settings';
const COUPONS = '/api/v1/coupons';
const REVIEWS = '/api/v1/reviews';
const ORDERS = '/api/v1/orders';

const setupStaff = async () => {
  const admin = await createUser({ role: 'admin' });
  const manager = await createUser({ role: 'manager' });
  const employee = await createUser({ role: 'employee' });
  const customer = await createUser({ role: 'customer' });
  return { admin, manager, employee, customer };
};

const setupProduct = async () => {
  const category = await categoriesRepo.create({ name: 'Pizza', slug: 'pizza', type: 'section' });
  const product = await productsRepo.create({ name: 'بيبروني', nameEn: 'Pepperoni', slug: 'pepperoni', category: toId(category._id), basePrice: 120, isAvailable: true });
  return product;
};

describe('user management RBAC', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('lets staff read the users list, but not customers', async () => {
    const { employee, customer } = await setupStaff();
    expect((await api.get(USERS).set(bearer(employee.id))).status).toBe(200);
    expect((await api.get(USERS).set(bearer(customer.id))).status).toBe(403);
  });

  it('only admin/manager can update or delete users', async () => {
    const { admin, manager, employee, customer } = await setupStaff();
    const target = await createUser();
    const patch = { role: 'manager' };
    expect((await api.patch(`${USERS}/${target.id}`).set(bearer(employee.id)).send(patch)).status).toBe(403);
    expect((await api.patch(`${USERS}/${target.id}`).set(bearer(customer.id)).send(patch)).status).toBe(403);
    expect((await api.patch(`${USERS}/${target.id}`).set(bearer(manager.id)).send(patch)).status).toBe(200);
    expect((await api.delete(`${USERS}/${target.id}`).set(bearer(admin.id))).status).toBe(200);
  });
});

describe('product RBAC', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('employee can update but not create/delete products', async () => {
    const { employee } = await setupStaff();
    const product = await setupProduct();
    const updated = await api.patch(`${PRODUCTS}/${toId(product._id)}`).set(bearer(employee.id)).send({ name: 'محدث' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('محدث');
    expect((await api.delete(`${PRODUCTS}/${toId(product._id)}`).set(bearer(employee.id))).status).toBe(403);
    expect((await api.post(PRODUCTS).set(bearer(employee.id)).send({ name: 'X', category: 'x', basePrice: 1 })).status).toBe(403);
  });

  it('customer cannot touch products', async () => {
    const { customer } = await setupStaff();
    const product = await setupProduct();
    expect((await api.post(PRODUCTS).set(bearer(customer.id)).send({ name: 'X', category: 'x', basePrice: 1 })).status).toBe(403);
    expect((await api.patch(`${PRODUCTS}/${toId(product._id)}`).set(bearer(customer.id)).send({ name: 'X' })).status).toBe(403);
    expect((await api.delete(`${PRODUCTS}/${toId(product._id)}`).set(bearer(customer.id))).status).toBe(403);
  });

  it('manager has full product rights', async () => {
    const { manager } = await setupStaff();
    const category = await categoriesRepo.create({ name: 'Pizza', slug: 'pizza', type: 'section' });
    const created = await api
      .post(PRODUCTS)
      .set(bearer(manager.id))
      .send({ name: 'جديدة', nameEn: 'New', category: toId(category._id), basePrice: 50 });
    expect(created.status).toBe(201);
    expect((await api.delete(`${PRODUCTS}/${created.body.data._id}`).set(bearer(manager.id))).status).toBe(200);
  });
});

describe('settings RBAC', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('manager can read but not update settings', async () => {
    const { manager } = await setupStaff();
    expect((await api.get(SETTINGS).set(bearer(manager.id))).status).toBe(200);
    expect((await api.patch(SETTINGS).set(bearer(manager.id)).send({ deliveryFee: 30 })).status).toBe(403);
  });

  it('admin can update settings', async () => {
    const { admin } = await setupStaff();
    const res = await api.patch(SETTINGS).set(bearer(admin.id)).send({ deliveryFee: 30 });
    expect(res.status).toBe(200);
  });
});

describe('coupons RBAC', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('customer cannot read coupons, employee can', async () => {
    const { employee, customer } = await setupStaff();
    expect((await api.get(COUPONS).set(bearer(customer.id))).status).toBe(403);
    expect((await api.get(COUPONS).set(bearer(employee.id))).status).toBe(200);
  });

  it('only manager+ can create coupons', async () => {
    const { admin, manager, employee, customer } = await setupStaff();
    const body = { code: 'NEW10', type: 'percent', value: 10 };
    expect((await api.post(COUPONS).set(bearer(customer.id)).send(body)).status).toBe(403);
    expect((await api.post(COUPONS).set(bearer(employee.id)).send(body)).status).toBe(403);
    expect((await api.post(COUPONS).set(bearer(manager.id)).send(body)).status).toBe(201);
    expect((await api.post(COUPONS).set(bearer(admin.id)).send({ code: 'ADMIN10', type: 'percent', value: 5 })).status).toBe(201);
  });
});

describe('reviews & orders RBAC', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('employee can moderate reviews, customer cannot', async () => {
    const { employee, customer } = await setupStaff();
    const admin = await createUser({ role: 'admin' });
    const product = await setupProduct();
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
    expect((await api.patch(`${REVIEWS}/${reviewId}/moderate`).set(bearer(customer.id)).send({ status: 'hidden' })).status).toBe(403);
    expect((await api.patch(`${REVIEWS}/${reviewId}/moderate`).set(bearer(employee.id)).send({ status: 'hidden' })).status).toBe(200);
  });

  it('staff can list orders; unauthenticated cannot', async () => {
    const { employee } = await setupStaff();
    expect((await api.get(`${ORDERS}/admin`)).status).toBe(401);
    expect((await api.get(`${ORDERS}/admin`).set(bearer(employee.id))).status).toBe(200);
  });
});