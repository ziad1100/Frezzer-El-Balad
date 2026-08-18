import { z } from 'zod';
import { dateString } from './common';

export const couponCreateSchema = z.object({
  code: z.string().trim().min(1, 'Coupon code is required').max(40),
  name: z.string().trim().max(100).optional(),
  nameEn: z.string().trim().max(100).optional(),
  type: z.enum(['percent', 'fixed'], { message: 'Invalid coupon type' }),
  value: z.coerce.number().min(0, 'Coupon value must be a positive number'),
  minOrder: z.coerce.number().min(0).optional(),
  maxDiscount: z.coerce.number().min(0).optional(),
  maxUses: z.coerce.number().int().min(0).optional(),
  usedCount: z.coerce.number().int().min(0).optional(),
  perUserLimit: z.coerce.number().int().min(0).optional(),
  startDate: dateString('startDate must be a valid date').optional(),
  endDate: dateString('endDate must be a valid date').optional(),
  isActive: z.boolean().optional(),
});

export const couponUpdateSchema = couponCreateSchema.partial();

export const couponValidateSchema = z.object({
  code: z.string().trim().min(1, 'Coupon code is required').max(40),
  subtotal: z.coerce.number().min(0).default(0),
});