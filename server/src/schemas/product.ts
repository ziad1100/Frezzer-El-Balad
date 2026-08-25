import { z } from 'zod';
import { objectId, positivePrice } from './common';

const size = z.object({
  name: z.string().trim().min(1, 'Size name is required').max(50),
  nameEn: z.string().trim().max(50).optional(),
  price: positivePrice('Size price must be greater than 0'),
  isAvailable: z.boolean().optional(),
});

const extra = z.object({
  name: z.string().trim().min(1, 'Extra name is required').max(50),
  nameEn: z.string().trim().max(50).optional(),
  price: positivePrice('Extra price must be greater than 0'),
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(1, 'Product name (Arabic) is required').max(120),
  nameEn: z.string().trim().max(120).optional(),
  slug: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  descriptionEn: z.string().trim().max(5000).optional(),
  category: objectId('Category is required'),
  images: z.array(z.string().trim().max(500)).min(1, 'At least one product image is required').max(20).optional(),
  sizes: z.array(size).max(10).optional(),
  extras: z.array(extra).max(30).optional(),
  ingredients: z.array(z.string().trim().max(100)).max(50).optional(),
  ingredientsEn: z.array(z.string().trim().max(100)).max(50).optional(),
  tags: z.array(z.string().trim().max(50)).max(50).optional(),
  basePrice: positivePrice('Base price must be greater than 0'),
  discount: z.coerce.number().min(0).max(100).optional(),
  preparationTime: z.coerce.number().int().min(1).max(600).optional(),
  calories: z.coerce.number().min(0).max(10000).optional(),
  isAvailable: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isOffer: z.boolean().optional(),
});

export const productUpdateSchema = productCreateSchema.partial();