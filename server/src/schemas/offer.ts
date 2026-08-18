import { z } from 'zod';
import { dateString, objectId } from './common';

export const offerCreateSchema = z.object({
  title: z.string().trim().min(1, 'Offer title is required').max(150),
  titleEn: z.string().trim().max(150).optional(),
  description: z.string().trim().max(2000).optional(),
  descriptionEn: z.string().trim().max(2000).optional(),
  banner: z.string().trim().max(500).optional(),
  discountType: z.enum(['percent', 'fixed']).default('percent'),
  discountValue: z.coerce.number().min(0).max(100).optional(),
  startDate: dateString('startDate must be a valid date'),
  endDate: dateString('endDate must be a valid date'),
  products: z.array(objectId()).max(100).optional(),
  theme: z.enum(['dark', 'red', 'gold']).default('dark'),
  isActive: z.boolean().optional(),
});

export const offerUpdateSchema = offerCreateSchema.partial();