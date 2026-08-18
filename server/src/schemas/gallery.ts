import { z } from 'zod';

export const galleryCreateSchema = z.object({
  title: z.string().trim().min(1, 'Gallery title is required').max(150),
  titleEn: z.string().trim().max(150).optional(),
  image: z.string().trim().min(1, 'Image URL is required').max(500),
  order: z.coerce.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
});

export const galleryUpdateSchema = galleryCreateSchema.partial();
