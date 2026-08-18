import { z } from 'zod';

const postFields = {
  titleEn: z.string().trim().max(200).optional(),
  excerpt: z.string().trim().max(400).optional(),
  excerptEn: z.string().trim().max(400).optional(),
  content: z.string().trim().max(50000).optional(),
  contentEn: z.string().trim().max(50000).optional(),
  slug: z.string().trim().max(200).optional(),
  image: z.string().trim().max(500).optional(),
  tags: z.array(z.string().trim().max(50)).max(30).optional(),
  isPublished: z.boolean().optional(),
  publishedAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'publishedAt must be a valid date')
    .optional(),
};

export const postCreateSchema = z.object({
  title: z.string().trim().min(1, 'Post title is required').max(200),
  ...postFields,
});

export const postUpdateSchema = z.object({ title: z.string().trim().max(200).optional(), ...postFields });