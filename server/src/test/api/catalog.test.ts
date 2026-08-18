import { beforeEach, describe, expect, it } from 'vitest';
import * as categoriesRepo from '../../db/categories';
import * as productsRepo from '../../db/products';
import { api, seedRoles, toId } from '../helpers';

const PRODUCTS = '/api/v1/products';

const setupCatalog = async () => {
  const section = await categoriesRepo.create({ name: 'Ø¨ÙŠØªØ²Ø§', nameEn: 'Pizza', slug: 'pizza-section', type: 'section', isActive: true });
  const sub = await categoriesRepo.create({ name: 'ÙƒÙ„Ø§Ø³ÙŠÙƒ', nameEn: 'Classic', slug: 'classic', type: 'sub', parentId: toId(section._id), isActive: true });
  const pepperoni = await productsRepo.create({
    name: 'Ø¨ÙŠØ¨Ø±ÙˆÙ†ÙŠ',
    nameEn: 'Pepperoni',
    slug: 'pepperoni',
    category: toId(sub._id),
    basePrice: 120,
    isAvailable: true,
  });
  const margherita = await productsRepo.create({
    name: 'Ù…Ø§Ø±ØºØ±ÙŠØªØ§',
    nameEn: 'Margherita',
    slug: 'margherita',
    category: toId(sub._id),
    basePrice: 90,
    isAvailable: true,
  });
  const hidden = await productsRepo.create({
    name: 'Ù…Ø®ÙÙŠ',
    nameEn: 'Hidden',
    slug: 'hidden-pizza',
    category: toId(sub._id),
    basePrice: 200,
    isAvailable: false,
  });
  const best = await productsRepo.create({
    name: 'Ø§Ù„Ø£ÙƒØ«Ø± Ù…Ø¨ÙŠØ¹Ø§Ù‹',
    nameEn: 'Best Seller',
    slug: 'best-seller',
    category: toId(sub._id),
    basePrice: 150,
    isAvailable: true,
    isBestSeller: true,
  });
  const offer = await productsRepo.create({
    name: 'Ø¹Ø±Ø¶ Ø§Ù„ÙŠÙˆÙ…',
    nameEn: 'Daily Offer',
    slug: 'daily-offer',
    category: toId(sub._id),
    basePrice: 100,
    isAvailable: true,
    isOffer: true,
    discount: 20,
  });
  return { section, sub, pepperoni, margherita, hidden, best, offer };
};

describe('public product catalog', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('lists paginated products (unavailable ones excluded)', async () => {
    await setupCatalog();
    const res = await api.get(`${PRODUCTS}?limit=2`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(4);
    expect(res.body.data.pages).toBe(2);
  });

  it('never exposes unavailable products in public lists', async () => {
    await setupCatalog();
    const res = await api.get(PRODUCTS);
    expect(res.body.data.items.every((p: { isAvailable: boolean }) => p.isAvailable)).toBe(true);
  });

  it('filters by search term', async () => {
    await setupCatalog();
    const res = await api.get(`${PRODUCTS}?search=pepperoni`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].slug).toBe('pepperoni');
  });

  it('filters by category', async () => {
    const { sub } = await setupCatalog();
    const res = await api.get(`${PRODUCTS}?category=${toId(sub._id)}`);
    expect(res.body.data.total).toBe(4);
  });

  it('returns a product by slug with approved reviews', async () => {
    const { pepperoni } = await setupCatalog();
    const res = await api.get(`${PRODUCTS}/pepperoni`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Ø¨ÙŠØ¨Ø±ÙˆÙ†ÙŠ');
    expect(res.body.data.reviews).toEqual([]);
    expect(res.body.data._id).toBe(toId(pepperoni._id));
  });

  it('returns best sellers (available only, best-seller flagged)', async () => {
    await setupCatalog();
    const res = await api.get(`${PRODUCTS}/best-sellers`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].slug).toBe('best-seller');
    expect(res.body.data[0].isAvailable).toBe(true);
  });

  it('returns offers (available only, offer flagged)', async () => {
    await setupCatalog();
    const res = await api.get(`${PRODUCTS}/offers`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].slug).toBe('daily-offer');
    expect(res.body.data[0].discount).toBe(20);
  });

  it('returns 404 for unknown or unavailable slugs', async () => {
    await setupCatalog();
    expect((await api.get(`${PRODUCTS}/nope`)).status).toBe(404);
    expect((await api.get(`${PRODUCTS}/hidden-pizza`)).status).toBe(404);
  });
});

describe('categories', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('builds a section->sub tree', async () => {
    const { sub } = await setupCatalog();
    const res = await api.get('/api/v1/categories/tree');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].children).toHaveLength(1);
    expect(String(res.body.data[0].children[0]._id)).toBe(toId(sub._id));
  });

  it('lists categories (all flag includes inactive)', async () => {
    await setupCatalog();
    const all = await api.get('/api/v1/categories?all=true');
    expect(all.body.data.length).toBe(2);
  });
});
