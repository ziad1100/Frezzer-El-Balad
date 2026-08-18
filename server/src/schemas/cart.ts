import { z } from 'zod';
import { objectId, nonNegative } from './common';

const extra = z.object({ name: z.string().trim().min(1).max(100), price: nonNegative().optional() });

export const addItemSchema = z.object({
  product: objectId('Product id is required'),
  size: objectId('Invalid size id').nullable().optional(),
  sizeName: z.string().trim().max(100).optional(),
  extras: z.array(extra).max(30).optional(),
  qty: z.coerce.number().int().min(1, 'Quantity must be at least 1').optional(),
});

export const updateItemSchema = z.object({
  qty: z.coerce.number().int().min(1, 'Quantity must be at least 1').optional(),
  extras: z.array(extra).max(30).optional(),
});

export const applyCouponSchema = z.object({
  code: z.string().trim().max(50).optional(),
});
