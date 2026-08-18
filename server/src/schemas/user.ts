import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  avatar: z.string().trim().max(500).optional(),
  addresses: z.array(z.object({}).passthrough()).max(20).optional(),
});

export const adminUpdateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(['admin', 'manager', 'employee', 'customer']).optional(),
  isActive: z.boolean().optional(),
  avatar: z.string().trim().max(500).optional(),
});