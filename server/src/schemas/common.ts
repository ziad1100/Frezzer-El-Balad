import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const objectId = (message = 'Invalid id format') => z.string().regex(UUID_RE, message);

export const nonNegative = (message = 'Must be a positive number') => z.coerce.number().min(0, message);

export const dateString = (message = 'Must be a valid date') =>
  z.string().refine((v) => !Number.isNaN(Date.parse(v)), message);

export const localizedText = z
  .object({ ar: z.string().max(1000).optional(), en: z.string().max(1000).optional() })
  .optional();
