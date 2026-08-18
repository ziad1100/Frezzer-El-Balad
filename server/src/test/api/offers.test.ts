import { beforeEach, describe, expect, it } from 'vitest';
import * as categoriesRepo from '../../db/categories';
import * as offersRepo from '../../db/offers';
import * as productsRepo from '../../db/products';
import { api, seedRoles, toId } from '../helpers';

const OFFERS = '/api/v1/offers';

const setup = async () => {
  const sub = await categoriesRepo.create({ name: 'كلاسيك', nameEn: 'Classic', slug: 'classic-keys', type: 'sub', isActive: true });
  const pepperoni = await productsRepo.create({
    name: 'بيبروني',
    nameEn: 'Pepperoni',
    slug: 'pepperoni-offer',
    category: toId(sub._id),
    basePrice: 120,
    isAvailable: true,
  });
  const margherita = await productsRepo.create({
    name: 'مارغريتا',
    nameEn: 'Margherita',
    slug: 'margherita-offer',
    category: toId(sub._id),
    basePrice: 90,
    isAvailable: true,
  });
  const now = Date.now();
  const active = await offersRepo.create({
    title: 'أوفير الأسبوع',
    titleEn: 'Weekend Special',
    description: '',
    discountType: 'fixed',
    discountValue: 50,
    startDate: new Date(now - 3600_000),
    endDate: new Date(now + 30 * 86400_000),
    products: [toId(pepperoni._id), toId(margherita._id)],
    theme: 'red',
    isActive: true,
  });
  const inactive = await offersRepo.create({
    title: 'عرض مخفي',
    titleEn: 'Hidden Offer',
    description: '',
    discountType: 'percent',
    discountValue: 20,
    startDate: new Date(now - 3600_000),
    endDate: new Date(now + 30 * 86400_000),
    products: [],
    theme: 'dark',
    isActive: false,
  });
  return { pepperoni, margherita, active, inactive };
};

describe('public offers', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('lists active offers with populated products', async () => {
    const { pepperoni, margherita, active } = await setup();
    const res = await api.get(`${OFFERS}/active`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const offer = res.body.data[0];
    expect(offer.titleEn).toBe('Weekend Special');
    const slugs = offer.products.map((p: { slug: string }) => p.slug).sort();
    expect(slugs).toEqual(['margherita-offer', 'pepperoni-offer'].sort());
    void pepperoni;
    void margherita;
    void active;
  });

  it('excludes inactive offers from the active list', async () => {
    const { inactive } = await setup();
    const res = await api.get(`${OFFERS}/active`);
    expect(res.body.data.some((o: { _id: string }) => o._id === toId(inactive._id))).toBe(false);
  });

  it('returns a single offer by id with populated products', async () => {
    const { active } = await setup();
    const res = await api.get(`${OFFERS}/${toId(active._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.titleEn).toBe('Weekend Special');
    expect(res.body.data.products).toHaveLength(2);
  });

  it('returns 404 for an unknown offer id', async () => {
    const res = await api.get(`${OFFERS}/000000000000000000000000`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for an inactive offer', async () => {
    const { inactive } = await setup();
    const res = await api.get(`${OFFERS}/${toId(inactive._id)}`);
    expect(res.status).toBe(404);
  });
});