import { z } from 'zod';

export const bannerCreateSchema = z.object({
  title: z.string().trim().min(1, 'Banner title is required').max(150),
  subtitle: z.string().trim().max(300).optional(),
  image: z.string().trim().max(500).optional(),
  buttonText: z.string().trim().max(100).optional(),
  buttonLink: z.string().trim().max(500).optional(),
  position: z.enum(['hero', 'home', 'deals']).default('home'),
  order: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const bannerUpdateSchema = bannerCreateSchema.partial();