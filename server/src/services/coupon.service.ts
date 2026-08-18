import { COUPON_TYPES } from '../constants';
import { ApiError } from '../utils/ApiError';
import * as couponsRepo from '../db/coupons';

export interface CouponDiscount {
  code: string;
  amount: number;
  type: string;
}

export const validateCoupon = async (
  code: string,
  userId: string,
  subtotal: number,
): Promise<CouponDiscount> => {
  const coupon = await couponsRepo.getByCode(code.toUpperCase());
  if (!coupon || coupon.isActive !== true) throw new ApiError(404, 'Invalid coupon code');
  const now = new Date();
  if (coupon.startDate && new Date(coupon.startDate as Date) > now) {
    throw new ApiError(400, 'Coupon is not active yet');
  }
  if (coupon.endDate && new Date(coupon.endDate as Date) < now) {
    throw new ApiError(400, 'Coupon has expired');
  }
  if (subtotal < (coupon.minOrder as number)) {
    throw new ApiError(400, `Minimum order for this coupon is ${coupon.minOrder} EGP`);
  }
  if ((coupon.maxUses as number) > 0 && (coupon.usedCount as number) >= (coupon.maxUses as number)) {
    throw new ApiError(400, 'Coupon usage limit reached');
  }
  if ((coupon.perUserLimit as number) > 0 && userId) {
    const used = await couponsRepo.countRedemptionsForUser(coupon._id as string, userId);
    if (used >= (coupon.perUserLimit as number)) {
      throw new ApiError(400, 'You have already used this coupon');
    }
  }

  let amount: number;
  if (coupon.type === COUPON_TYPES.PERCENT) {
    const percentAmount = (subtotal * (coupon.value as number)) / 100;
    amount =
      (coupon.maxDiscount as number) > 0 && percentAmount > (coupon.maxDiscount as number)
        ? (coupon.maxDiscount as number)
        : percentAmount;
  } else {
    amount = Math.min(coupon.value as number, subtotal);
  }

  return { code: coupon.code as string, amount: Math.round(amount * 100) / 100, type: coupon.type as string };
};

export const incrementCouponUsedCount = async (code: string): Promise<void> => {
  await couponsRepo.incrementUsedCount(code.toUpperCase());
};

export const incrementCouponUsage = incrementCouponUsedCount;

export const recordCouponRedemption = async (
  couponId: string,
  userId: string,
  orderId?: string,
): Promise<void> => {
  await couponsRepo.recordRedemption(couponId, userId, orderId);
};