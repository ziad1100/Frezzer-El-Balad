import { Router } from 'express';
import * as setting from '../controllers/setting.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';
import { logActivity } from '../middlewares/activityLogger';
import { zodBody } from '../middlewares/zod';
import { cached, invalidateCache } from '../middlewares/cache';
import { settingsUpdateSchema } from '../schemas';

const router = Router();

router.get('/public', cached({ resource: 'settings', ttl: 300, suffix: 'public' }), setting.getPublic);

router.use(requireAuth);
router.use(requirePermission('settings', 'read'));

router.get('/', setting.getAdmin);
router.patch('/', requirePermission('settings', 'update'), zodBody(settingsUpdateSchema), logActivity('update', 'settings'), invalidateCache('settings'), setting.update);

export default router;