import { z } from 'zod';
import { objectId } from './common';

const rating = z.coerce
  .number()
  .int('Rating must be a whole number')
  .min(1, 'Rating must be 1-5')
  .max(5, 'Rating must be 1-5');

const comment = z.string().trim().max(600, 'Review must be at most 600 characters').optional();

const category = z.coerce.number().int('Category rating must be a whole number').min(1, 'Category rating must be 1-5').max(5, 'Category rating must be 1-5').optional();

export const reviewCreateSchema = z.object({
  product: objectId('Product is required'),
  orderId: objectId('Order is required'),
  rating,
  comment,
});

export const quickReviewCreateSchema = z.object({
  product: objectId('Product is required'),
  rating,
  comment,
});

export const reviewUpdateSchema = z
  .object({
    rating,
    comment,
    foodQuality: category,
    delivery: category,
    packaging: category,
    service: category,
    overall: category,
  })
  .refine(
    (v) =>
      v.rating !== undefined ||
      v.comment !== undefined ||
      v.foodQuality !== undefined ||
      v.delivery !== undefined ||
      v.packaging !== undefined ||
      v.service !== undefined ||
      v.overall !== undefined,
    'Nothing to update',
  );

export const reviewModerateSchema = z.object({
  status: z.enum(['pending', 'published', 'hidden']),
});

export const restaurantReviewCreateSchema = z.object({
  orderId: objectId('Order is required'),
  rating,
  comment,
  foodQuality: z.coerce.number().int().min(1).max(5).optional(),
  delivery: z.coerce.number().int().min(1).max(5).optional(),
  packaging: z.coerce.number().int().min(1).max(5).optional(),
  service: z.coerce.number().int().min(1).max(5).optional(),
  overall: z.coerce.number().int().min(1).max(5).optional(),
});
