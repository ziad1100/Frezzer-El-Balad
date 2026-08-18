import { Router } from 'express';
import * as notification from '../controllers/notification.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';
import { zodBody } from '../middlewares/zod';
import { sendNotificationSchema } from '../schemas';

const router = Router();
router.use(requireAuth);

router.get('/', notification.getForUser);
router.patch('/:id/read', notification.markRead);
router.patch('/read-all', notification.markAllRead);
router.post('/send', requirePermission('notifications', 'create'), zodBody(sendNotificationSchema), notification.sendToUsers);

export default router;