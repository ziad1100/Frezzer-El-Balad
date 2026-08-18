import { z } from 'zod';
import { objectId } from './common';

export const sendNotificationSchema = z.object({
  userIds: z.array(objectId('Invalid user id')).min(1, 'userIds are required').max(200),
  title: z.string().trim().min(1, 'Notification title is required').max(200),
  titleEn: z.string().trim().max(200).optional(),
  body: z.string().trim().max(2000).optional(),
  bodyEn: z.string().trim().max(2000).optional(),
  type: z.string().trim().max(30).optional(),
  link: z.string().trim().max(500).optional(),
});