import { z } from 'zod';
import { localizedText } from './common';

export const settingsUpdateSchema = z.object({
  restaurantName: localizedText,
  logo: z.string().trim().max(500).optional(),
  tagline: localizedText,
  workingHours: localizedText,
  themeColors: z
    .object({
      primary: z.string().trim().max(20).optional(),
      accent: z.string().trim().max(20).optional(),
      background: z.string().trim().max(20).optional(),
    })
    .optional(),
  phone: z.string().trim().max(50).optional(),
  whatsapp: z.string().trim().max(50).optional(),
  facebook: z.string().trim().max(200).optional(),
  instagram: z.string().trim().max(200).optional(),
  tiktok: z.string().trim().max(200).optional(),
  googleMaps: z.string().trim().max(500).optional(),
  deliveryFee: z.coerce.number().min(0).optional(),
  minimumOrder: z.coerce.number().min(0).optional(),
  freeDeliveryOver: z.coerce.number().min(0).optional(),
  reviewPromptCooldownDays: z.coerce.number().int().min(0).max(365).optional(),
  reviewPromptDelayHours: z.coerce.number().int().min(0).max(24 * 30).optional(),
});