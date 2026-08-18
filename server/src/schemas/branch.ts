import { z } from 'zod';

export const branchCreateSchema = z.object({
  name: z.string().trim().min(1, 'Branch name is required').max(150),
  nameEn: z.string().trim().max(150).optional(),
  address: z.string().trim().max(500).optional(),
  addressEn: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(30).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  workHours: z.string().trim().max(200).optional(),
  workHoursEn: z.string().trim().max(200).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  googleMapsUrl: z.string().trim().max(500).optional(),
  image: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const branchUpdateSchema = branchCreateSchema.partial();