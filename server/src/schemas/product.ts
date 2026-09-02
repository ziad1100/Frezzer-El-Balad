import { z } from 'zod';
import { objectId, nonNegative, positivePrice } from './common';

// ── Create schemas (strict — new products must have valid data) ──────────

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
  purchaseCost: z.coerce.number().min(0, 'Purchase cost must be non-negative').optional(),
  barcode: z.string().trim().max(50).optional(),
  unit: z.string().trim().max(20).optional(),
  productType: z.string().max(50).optional(),
  supplierCode: z.string().trim().max(50).optional(),
  discount: z.coerce.number().min(0).max(100).optional(),
  preparationTime: z.coerce.number().int().min(1).max(600).optional(),
  calories: z.coerce.number().min(0).max(10000).optional(),
  isAvailable: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isOffer: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  stockQuantity: z.coerce.number().int().min(0).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
});

// ── Update schemas (lenient — existing products may have legacy 0-prices,
//    empty images, or other data that was valid before stricter rules).
//    The PATCH flow only overwrites fields the admin actually sends. ─────

const sizeUpdate = z.object({
  name: z.string().trim().min(1, 'Size name is required').max(50),
  nameEn: z.string().trim().max(50).optional(),
  price: nonNegative('Size price must be a non-negative number'),
  isAvailable: z.boolean().optional(),
});

const extraUpdate = z.object({
  name: z.string().trim().min(1, 'Extra name is required').max(50),
  nameEn: z.string().trim().max(50).optional(),
  price: nonNegative('Extra price must be a non-negative number'),
});

export const productUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Product name (Arabic) is required').max(120).optional(),
  nameEn: z.string().trim().max(120).optional(),
  description: z.string().trim().max(5000).optional(),
  descriptionEn: z.string().trim().max(5000).optional(),
  category: objectId('Category is required').optional(),
  images: z.array(z.string().trim().max(500)).max(20).optional(),
  sizes: z.array(sizeUpdate).max(10).optional(),
  extras: z.array(extraUpdate).max(30).optional(),
  ingredients: z.array(z.string().trim().max(100)).max(50).optional(),
  ingredientsEn: z.array(z.string().trim().max(100)).max(50).optional(),
  tags: z.array(z.string().trim().max(50)).max(50).optional(),
  basePrice: nonNegative('Base price must be a non-negative number').optional(),
  purchaseCost: z.coerce.number().min(0, 'Purchase cost must be non-negative').optional(),
  barcode: z.string().trim().max(50).optional(),
  unit: z.string().trim().max(20).optional(),
  productType: z.string().max(50).optional(),
  supplierCode: z.string().trim().max(50).optional(),
  discount: z.coerce.number().min(0).max(100).optional(),
  preparationTime: z.coerce.number().int().min(1).max(600).optional(),
  calories: z.coerce.number().min(0).max(10000).optional(),
  isAvailable: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isOffer: z.boolean().optional(),
  labelIds: z.array(z.string()).optional(),
  trackInventory: z.boolean().optional(),
  stockQuantity: z.coerce.number().int().min(0).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
});