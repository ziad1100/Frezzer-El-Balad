import { describe, expect, it } from 'vitest';
import * as couponsRepo from '../db/coupons';
import { COUPON_TYPES } from '../constants';
import { incrementCouponUsage, validateCoupon } from './coupon.service';

const seedCoupon = (overrides: Record<string, unknown> = {}) =>
  couponsRepo.create({
    code: 'SAVE10',
    name: 'Save 10',
    type: COUPON_TYPES.PERCENT,
    value: 10,
    minOrder: 0,
    maxDiscount: 0,
    maxUses: 0,
    startDate: new Date(Date.now() - 1000),
    isActive: true,
    ...overrides,
  });

describe('validateCoupon', () => {
  it('throws 404 for an unknown code', async () => {
    await expect(validateCoupon('NOPE', 'user-1', 1000)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('is case-insensitive on the code', async () => {
    await seedCoupon();
    const result = await validateCoupon('save10', 'user-1', 1000);
    expect(result.code).toBe('SAVE10');
  });

  it('throws when the coupon is not active yet', async () => {
    await seedCoupon({ startDate: new Date(Date.now() + 60 * 60 * 1000) });
    await expect(validateCoupon('SAVE10', 'user-1', 1000)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws when the coupon has expired', async () => {
    await seedCoupon({ endDate: new Date(Date.now() - 1000) });
    await expect(validateCoupon('SAVE10', 'user-1', 1000)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws when subtotal is below the minimum order', async () => {
    await seedCoupon({ minOrder: 500 });
    await expect(validateCoupon('SAVE10', 'user-1', 100)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws when the usage limit is reached', async () => {
    await seedCoupon({ maxUses: 5, usedCount: 5 });
    await expect(validateCoupon('SAVE10', 'user-1', 1000)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('ignores inactive coupons', async () => {
    await seedCoupon({ isActive: false });
    await expect(validateCoupon('SAVE10', 'user-1', 1000)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('applies a percent discount', async () => {
    await seedCoupon();
    const result = await validateCoupon('SAVE10', 'user-1', 1000);
    expect(result.amount).toBe(100);
  });

  it('caps a percent discount at maxDiscount', async () => {
    await seedCoupon({ value: 20, maxDiscount: 150 });
    const result = await validateCoupon('SAVE10', 'user-1', 1000);
    expect(result.amount).toBe(150);
  });

  it('clamps a fixed discount to the subtotal', async () => {
    await seedCoupon({ type: COUPON_TYPES.FIXED, value: 5000 });
    const result = await validateCoupon('SAVE10', 'user-1', 300);
    expect(result.amount).toBe(300);
  });

  it('applies a plain fixed discount', async () => {
    await seedCoupon({ type: COUPON_TYPES.FIXED, value: 50 });
    const result = await validateCoupon('SAVE10', 'user-1', 300);
    expect(result.amount).toBe(50);
  });

  it('rounds the discount to 2 decimals', async () => {
    await seedCoupon();
    const result = await validateCoupon('SAVE10', 'user-1', 33.33);
    expect(result.amount).toBe(3.33);
  });

  it('returns code and type in the result', async () => {
    await seedCoupon();
    const result = await validateCoupon('SAVE10', 'user-1', 100);
    expect(result).toMatchObject({ code: 'SAVE10', type: COUPON_TYPES.PERCENT });
  });
});

describe('incrementCouponUsage', () => {
  it('increments the usedCount', async () => {
    await seedCoupon();
    await incrementCouponUsage('save10');
    const coupon = await couponsRepo.getByCode('SAVE10');
    expect(coupon?.usedCount).toBe(1);
  });
});
