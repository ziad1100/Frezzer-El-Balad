import { beforeEach, describe, expect, it } from 'vitest';
import * as categoriesRepo from '../../db/categories';
import * as productsRepo from '../../db/products';
import { query } from '../../db';
import { api, bearer, createUser, seedRoles, toId } from '../helpers';

const PRODUCTS = '/api/v1/products';
const SYSTEM = '/api/v1/system';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const setupCatalog = async () => {
  const section = await categoriesRepo.create({
    name: 'لحوم', nameEn: 'Meat', slug: 'meat-section', type: 'section', isActive: true,
  });
  const sub = await categoriesRepo.create({
    name: 'مجمدات', nameEn: 'Frozen', slug: 'frozen', type: 'sub', parentId: toId(section._id), isActive: true,
  });
  const product = await productsRepo.create({
    name: 'بانيه',
    nameEn: 'Paneh',
    slug: 'paneh',
    category: toId(sub._id),
    basePrice: 140,
    sizes: [{ name: '500 جم', nameEn: '500g', price: 140 }],
    extras: [{ name: 'جبنة', nameEn: 'Cheese', price: 10 }],
    images: ['/images/products/paneh.jpg'],
    isAvailable: true,
  });
  return { section, sub, product };
};

// ===========================================================================
// 1. Product Update Validation (422 fix)
// ===========================================================================

describe('product update validation', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  describe('PATCH /products/:id — accepts valid updates', () => {
    it('updates only the name (partial update)', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ name: 'بانيه (جديد)' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('بانيه (جديد)');
    });

    it('updates basePrice to a valid positive number', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ basePrice: 200 });
      expect(res.status).toBe(200);
      expect(res.body.data.basePrice).toBe(200);
    });

    it('updates basePrice to 0 (existing product with legacy 0 price)', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      // First set to 0 (simulating a legacy product)
      const set = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ basePrice: 0 });
      expect(set.status).toBe(200);
      expect(set.body.data.basePrice).toBe(0);

      // Now edit it again (the 422 fix: this must NOT fail)
      const edit = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ name: 'بانيه معدل' });
      expect(edit.status).toBe(200);
      expect(edit.body.data.name).toBe('بانيه معدل');
      expect(edit.body.data.basePrice).toBe(0);
    });

    it('accepts empty images array on update', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ images: [] });
      expect(res.status).toBe(200);
      expect(res.body.data.images).toEqual([]);
    });

    it('accepts sizes with price 0 on update (legacy data)', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ sizes: [{ name: 'كبير', nameEn: 'Large', price: 0 }] });
      expect(res.status).toBe(200);
      expect(res.body.data.sizes).toHaveLength(1);
      expect(res.body.data.sizes[0].price).toBe(0);
    });

    it('accepts extras with price 0 on update (legacy data)', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ extras: [{ name: 'إضافة', nameEn: 'Add-on', price: 0 }] });
      expect(res.status).toBe(200);
      expect(res.body.data.extras).toHaveLength(1);
      expect(res.body.data.extras[0].price).toBe(0);
    });

    it('updates multiple fields at once', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({
          name: 'بانيه موزاريلا',
          nameEn: 'Mozzarella Paneh',
          basePrice: 170,
          discount: 10,
          isBestSeller: true,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('بانيه موزاريلا');
      expect(res.body.data.nameEn).toBe('Mozzarella Paneh');
      expect(res.body.data.basePrice).toBe(170);
      expect(res.body.data.discount).toBe(10);
      expect(res.body.data.isBestSeller).toBe(true);
    });

    it('preserves unchanged fields when sending a partial update', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ basePrice: 250 });
      expect(res.status).toBe(200);
      // Name and other fields should be unchanged
      expect(res.body.data.name).toBe('بانيه');
      expect(res.body.data.basePrice).toBe(250);
    });
  });

  describe('PATCH /products/:id — rejects invalid updates with 422', () => {
    it('rejects non-numeric basePrice', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ basePrice: 'not-a-number' });
      expect(res.status).toBe(422);
    });

    it('rejects negative basePrice', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ basePrice: -50 });
      expect(res.status).toBe(422);
    });

    it('rejects empty product name', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ name: '' });
      expect(res.status).toBe(422);
    });

    it('rejects invalid category UUID format', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ category: 'not-a-uuid' });
      expect(res.status).toBe(422);
    });

    it('rejects sizes with empty name', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ sizes: [{ name: '', price: 100 }] });
      expect(res.status).toBe(422);
    });

    it('rejects discount > 100', async () => {
      const { product } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .patch(`${PRODUCTS}/${toId(product._id)}`)
        .set(bearer(admin.id))
        .send({ discount: 150 });
      expect(res.status).toBe(422);
    });

    it('returns 404 for non-existent product', async () => {
      const admin = await createUser({ role: 'admin' });
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await api
        .patch(`${PRODUCTS}/${fakeId}`)
        .set(bearer(admin.id))
        .send({ name: 'Nope' });
      expect(res.status).toBe(404);
    });
  });
});

// ===========================================================================
// 2. Product Create Validation
// ===========================================================================

describe('product create validation', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  describe('POST /products — accepts valid creates', () => {
    it('creates a product with all required fields', async () => {
      const { section } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .post(PRODUCTS)
        .set(bearer(admin.id))
        .send({
          name: 'جلاش',
          nameEn: 'Gollash',
          category: toId(section._id),
          basePrice: 90,
          images: ['/images/gollash.jpg'],
        });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('جلاش');
      expect(res.body.data.basePrice).toBe(90);
    });

    it('creates a product with sizes and extras', async () => {
      const { section } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .post(PRODUCTS)
        .set(bearer(admin.id))
        .send({
          name: 'شيش',
          nameEn: 'Shish',
          category: toId(section._id),
          basePrice: 250,
          images: ['/images/shish.jpg'],
          sizes: [
            { name: 'كبير', nameEn: 'Large', price: 250 },
            { name: 'صغير', nameEn: 'Small', price: 180 },
          ],
          extras: [
            { name: 'أرز', nameEn: 'Rice', price: 15 },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.data.sizes).toHaveLength(2);
      expect(res.body.data.extras).toHaveLength(1);
    });
  });

  describe('POST /products — rejects invalid creates with 422', () => {
    it('rejects missing name', async () => {
      const { section } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .post(PRODUCTS)
        .set(bearer(admin.id))
        .send({ category: toId(section._id), basePrice: 100 });
      expect(res.status).toBe(422);
    });

    it('rejects basePrice of 0', async () => {
      const { section } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .post(PRODUCTS)
        .set(bearer(admin.id))
        .send({ name: 'X', category: toId(section._id), basePrice: 0 });
      expect(res.status).toBe(422);
    });

    it('rejects negative basePrice', async () => {
      const { section } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .post(PRODUCTS)
        .set(bearer(admin.id))
        .send({ name: 'X', category: toId(section._id), basePrice: -10 });
      expect(res.status).toBe(422);
    });

    it('rejects empty images array', async () => {
      const { section } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .post(PRODUCTS)
        .set(bearer(admin.id))
        .send({ name: 'X', category: toId(section._id), basePrice: 100, images: [] });
      expect(res.status).toBe(422);
    });

    it('rejects size with price 0', async () => {
      const { section } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .post(PRODUCTS)
        .set(bearer(admin.id))
        .send({
          name: 'X',
          category: toId(section._id),
          basePrice: 100,
          images: ['/img.jpg'],
          sizes: [{ name: 'Small', price: 0 }],
        });
      expect(res.status).toBe(422);
    });

    it('rejects extra with price 0', async () => {
      const { section } = await setupCatalog();
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .post(PRODUCTS)
        .set(bearer(admin.id))
        .send({
          name: 'X',
          category: toId(section._id),
          basePrice: 100,
          images: ['/img.jpg'],
          extras: [{ name: 'Cheese', price: 0 }],
        });
      expect(res.status).toBe(422);
    });

    it('rejects missing category', async () => {
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .post(PRODUCTS)
        .set(bearer(admin.id))
        .send({ name: 'X', basePrice: 100, images: ['/img.jpg'] });
      expect(res.status).toBe(422);
    });

    it('rejects invalid category UUID', async () => {
      const admin = await createUser({ role: 'admin' });
      const res = await api
        .post(PRODUCTS)
        .set(bearer(admin.id))
        .send({ name: 'X', category: 'bad', basePrice: 100, images: ['/img.jpg'] });
      expect(res.status).toBe(422);
    });
  });
});

// ===========================================================================
// 3. Reset System Safety
// ===========================================================================

describe('system reset safety', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  const setupForReset = async () => {
    const { section, sub, product } = await setupCatalog();
    const admin = await createUser({ role: 'admin' });
    const customer = await createUser({ role: 'customer' });

    // Create a second product with different data
    const product2 = await productsRepo.create({
      name: 'كفتة',
      nameEn: 'Kofta',
      slug: 'kofta',
      category: toId(sub._id),
      basePrice: 230,
      sizes: [{ name: 'كيلو', nameEn: '1kg', price: 230 }],
      images: ['/images/kofta.jpg'],
      isAvailable: true,
      isBestSeller: true,
      isOffer: true,
      discount: 15,
    });

    // Create an order
    const orderRes = await api
      .post('/api/v1/orders')
      .set(bearer(customer.id))
      .send({
        items: [
          { product: toId(product._id), qty: 2 },
          { product: toId(product2._id), qty: 1 },
        ],
        address: { city: 'Cairo', street: 'Main', building: '5' },
        phone: '01000000000',
        customerName: 'Test Customer',
      });
    expect(orderRes.status).toBe(201);

    return { admin, product, product2, sub, section };
  };

  it('clears orders and order_items', async () => {
    const { admin } = await setupForReset();
    const res = await api.post(`${SYSTEM}/reset`).set(bearer(admin.id));
    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.summary.ordersDeleted).toBeGreaterThan(0);

    const orders = await query('SELECT count(*)::int AS n FROM orders');
    expect(orders[0].n).toBe(0);
  });

  it('clears analytics', async () => {
    const { admin } = await setupForReset();
    const res = await api.post(`${SYSTEM}/reset`).set(bearer(admin.id));
    expect(res.status).toBe(200);

    const analytics = await query('SELECT count(*)::int AS n FROM analytics');
    expect(analytics[0].n).toBe(0);
  });

  it('does NOT modify product basePrice', async () => {
    const { admin, product, product2 } = await setupForReset();
    const p1Price = (await query('SELECT "basePrice" FROM products WHERE id = $1::uuid', [toId(product._id)]))[0].basePrice;
    const p2Price = (await query('SELECT "basePrice" FROM products WHERE id = $1::uuid', [toId(product2._id)]))[0].basePrice;

    await api.post(`${SYSTEM}/reset`).set(bearer(admin.id));

    const post1 = (await query('SELECT "basePrice" FROM products WHERE id = $1::uuid', [toId(product._id)]))[0];
    const post2 = (await query('SELECT "basePrice" FROM products WHERE id = $1::uuid', [toId(product2._id)]))[0];
    expect(post1.basePrice).toBe(p1Price);
    expect(post2.basePrice).toBe(p2Price);
  });

  it('does NOT modify product names', async () => {
    const { admin, product, product2 } = await setupForReset();
    await api.post(`${SYSTEM}/reset`).set(bearer(admin.id));

    const post1 = (await query('SELECT name, "nameEn" FROM products WHERE id = $1::uuid', [toId(product._id)]))[0];
    const post2 = (await query('SELECT name, "nameEn" FROM products WHERE id = $1::uuid', [toId(product2._id)]))[0];
    expect(post1.name).toBe('بانيه');
    expect(post1.nameEn).toBe('Paneh');
    expect(post2.name).toBe('كفتة');
    expect(post2.nameEn).toBe('Kofta');
  });

  it('does NOT modify product isAvailable flag', async () => {
    const { admin, product } = await setupForReset();
    await api.post(`${SYSTEM}/reset`).set(bearer(admin.id));

    const post = (await query('SELECT "isAvailable" FROM products WHERE id = $1::uuid', [toId(product._id)]))[0];
    expect(post.isAvailable).toBe(true);
  });

  it('does NOT modify product isBestSeller flag', async () => {
    const { admin, product2 } = await setupForReset();
    await api.post(`${SYSTEM}/reset`).set(bearer(admin.id));

    const post = (await query('SELECT "isBestSeller" FROM products WHERE id = $1::uuid', [toId(product2._id)]))[0];
    expect(post.isBestSeller).toBe(true);
  });

  it('does NOT modify product images', async () => {
    const { admin, product } = await setupForReset();
    await api.post(`${SYSTEM}/reset`).set(bearer(admin.id));

    const post = (await query('SELECT images FROM products WHERE id = $1::uuid', [toId(product._id)]))[0];
    expect(post.images).toEqual(['/images/products/paneh.jpg']);
  });

  it('does NOT modify product sizes (names, prices, relationships)', async () => {
    const { admin, product } = await setupForReset();
    const preCount = (await query<{n: number}>('SELECT count(*)::int AS n FROM product_sizes WHERE "productId" = $1', [toId(product._id)]))[0].n;

    await api.post(`${SYSTEM}/reset`).set(bearer(admin.id));

    const postSizes = await query(
      'SELECT name, price FROM product_sizes WHERE "productId" = $1 ORDER BY "sortOrder"',
      [toId(product._id)],
    );
    expect(postSizes).toHaveLength(preCount);
    expect(postSizes[0].name).toBe('500 جم');
    expect(Number(postSizes[0].price)).toBe(140);
  });

  it('does NOT modify product extras (names, prices, relationships)', async () => {
    const { admin, product } = await setupForReset();
    const preCount = (await query<{n: number}>('SELECT count(*)::int AS n FROM product_extras WHERE "productId" = $1', [toId(product._id)]))[0].n;

    await api.post(`${SYSTEM}/reset`).set(bearer(admin.id));

    const postExtras = await query(
      'SELECT name, price FROM product_extras WHERE "productId" = $1 ORDER BY "sortOrder"',
      [toId(product._id)],
    );
    expect(postExtras).toHaveLength(preCount);
    expect(postExtras[0].name).toBe('جبنة');
    expect(Number(postExtras[0].price)).toBe(10);
  });

  it('does NOT modify product descriptions', async () => {
    const { admin, product } = await setupForReset();
    await api.post(`${SYSTEM}/reset`).set(bearer(admin.id));

    const post = (await query('SELECT description, "descriptionEn" FROM products WHERE id = $1::uuid', [toId(product._id)]))[0];
    // Descriptions are empty strings by default (from seed)
    expect(post.description).toBe('');
    expect(post.descriptionEn).toBe('');
  });

  it('does NOT modify product discount', async () => {
    const { admin, product2 } = await setupForReset();
    await api.post(`${SYSTEM}/reset`).set(bearer(admin.id));

    const post = (await query('SELECT discount FROM products WHERE id = $1::uuid', [toId(product2._id)]))[0];
    expect(Number(post.discount)).toBe(15);
  });

  it('does NOT modify product ratings', async () => {
    const { admin, product } = await setupForReset();
    await api.post(`${SYSTEM}/reset`).set(bearer(admin.id));

    const post = (await query('SELECT rating, "reviewsCount" FROM products WHERE id = $1::uuid', [toId(product._id)]))[0];
    expect(Number(post.rating)).toBe(0);
    expect(Number(post.reviewsCount)).toBe(0);
  });

  it('sets statsClearedAt in settings', async () => {
    const { admin } = await setupForReset();
    await api.post(`${SYSTEM}/reset`).set(bearer(admin.id));

    const setting = (await query("SELECT value FROM settings WHERE key = 'statsClearedAt'"))[0];
    expect(setting).toBeDefined();
    // value is stored as jsonb containing a JSON-encoded ISO string.
    // pg returns jsonb values already parsed — the stored value is
    // JSON.stringify(isoString) which pg decodes to the inner string.
    const raw = setting.value;
    const dateStr = typeof raw === 'string' ? raw : String(raw);
    expect(new Date(dateStr).getTime()).not.toBeNaN();
  });

  it('returns correct summary', async () => {
    const { admin } = await setupForReset();
    const res = await api.post(`${SYSTEM}/reset`).set(bearer(admin.id));
    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.summary).toHaveProperty('ordersDeleted');
    expect(res.body.data.summary).toHaveProperty('cartsCleared');
    expect(res.body.data.summary).toHaveProperty('offersDeleted');
  });

  it('requires admin role', async () => {
    const customer = await createUser({ role: 'customer' });
    const res = await api.post(`${SYSTEM}/reset`).set(bearer(customer.id));
    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await api.post(`${SYSTEM}/reset`);
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// 4. Price synchronization: admin edit → public API
// ===========================================================================

describe('price synchronization', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('price changed by admin appears in public product API', async () => {
    const { product } = await setupCatalog();
    const admin = await createUser({ role: 'admin' });

    // Verify initial price in public API
    const before = await api.get(`${PRODUCTS}/${product.slug}`);
    expect(before.status).toBe(200);
    expect(before.body.data.basePrice).toBe(140);

    // Admin updates the price
    const update = await api
      .patch(`${PRODUCTS}/${toId(product._id)}`)
      .set(bearer(admin.id))
      .send({ basePrice: 200 });
    expect(update.status).toBe(200);

    // Public API shows the new price
    const after = await api.get(`${PRODUCTS}/${product.slug}`);
    expect(after.status).toBe(200);
    expect(after.body.data.basePrice).toBe(200);
  });

  it('price changed by admin appears in admin product list', async () => {
    const { product } = await setupCatalog();
    const admin = await createUser({ role: 'admin' });

    await api
      .patch(`${PRODUCTS}/${toId(product._id)}`)
      .set(bearer(admin.id))
      .send({ basePrice: 325.50 });

    const list = await api.get(`${PRODUCTS}/admin`).set(bearer(admin.id));
    expect(list.status).toBe(200);
    const found = list.body.data.items.find((p: { _id: string }) => p._id === toId(product._id));
    expect(found).toBeDefined();
    expect(found.basePrice).toBe(325.50);
  });

  it('size price changed by admin appears in public API', async () => {
    const { product } = await setupCatalog();
    const admin = await createUser({ role: 'admin' });

    await api
      .patch(`${PRODUCTS}/${toId(product._id)}`)
      .set(bearer(admin.id))
      .send({
        sizes: [{ name: '500 جم', nameEn: '500g', price: 185 }],
      });

    const after = await api.get(`${PRODUCTS}/${product.slug}`);
    expect(after.body.data.sizes[0].price).toBe(185);
  });
});
