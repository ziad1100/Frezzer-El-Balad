import { api, unwrap } from '@/lib/api';
import type { ApiEnvelope, CouponResult } from '@/types';

export const validateCoupon = (code: string, subtotal: number): Promise<CouponResult> =>
  unwrap(
    api.post<ApiEnvelope<CouponResult>>('/coupons/validate', { code, subtotal }),
  );

export const listCoupons = (): Promise<unknown[]> =>
  unwrap(api.get<ApiEnvelope<unknown[]>>('/coupons'));