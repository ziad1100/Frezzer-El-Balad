import { z } from 'zod';
import { objectId, nonNegative } from './common';

const extra = z.object({ name: z.string().trim().min(1).max(100), price: nonNegative() });

const item = z.object({
  product: objectId('Product id is required'),
  size: objectId('Invalid size id').nullable().optional(),
  sizeName: z.string().trim().max(100).optional(),
  extras: z.array(extra).max(30).optional(),
  qty: z.coerce
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(99, 'Quantity must be at most 99'),
});

export const createOrderSchema = z.object({
  items: z.array(item).min(1, 'At least one item is required').max(100),
  couponCode: z.string().trim().max(40).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^01[0125]\d{8}$/, 'Phone must be a valid 11-digit Egyptian mobile number (010/011/012/015)'),
  customerName: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
  address: z.object({
    label: z.string().trim().max(50).optional(),
    city: z.string().trim().min(1, 'City is required').max(100),
    area: z.string().trim().max(100).optional(),
    street: z.string().trim().min(1, 'Street is required').max(150),
    building: z.string().trim().min(1, 'Building is required').max(100),
  }),
  paymentMethod: z.enum(['cash', 'card']).default('cash'),
});

export const updateStatusSchema = z.object({
  status: z.string().min(1, 'Status is required'),
});

export const adminCancelOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const markComplimentarySchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500),
});
