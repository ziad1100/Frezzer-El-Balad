import { z } from 'zod';
import { objectId } from './common';

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100),
  nameEn: z.string().trim().max(100).optional(),
  type: z.enum(['section', 'sub']).default('section'),
  icon: z.string().trim().max(100).optional(),
  image: z.string().trim().max(500).optional(),
  description: z.string().trim().max(1000).optional(),
  descriptionEn: z.string().trim().max(1000).optional(),
  order: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  parentId: objectId().nullable().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();