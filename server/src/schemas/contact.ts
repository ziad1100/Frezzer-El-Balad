import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  phone: z.string().trim().min(1, 'Phone is required').max(20),
  email: z.string().trim().toLowerCase().email('Valid email is required').optional(),
  message: z.string().trim().min(1, 'Message is required').max(2000),
});

export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email is required'),
  name: z.string().trim().max(80).optional(),
});

export const newsletterUnsubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email is required'),
});