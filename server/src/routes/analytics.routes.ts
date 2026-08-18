import { Router } from 'express';
import * as analytics from '../controllers/analytics.controller';
import { requireAuth, requirePermission, requireRole } from '../middlewares/auth';
import { ROLES } from '../constants';
import { cached, invalidateCache } from '../middlewares/cache';

const router = Router();

router.use(requireAuth);
router.use(requirePermission('analytics', 'read'));

router.get('/dashboard', cached({ resource: 'dashboard', ttl: 60, suffix: 'dashboard' }), analytics.dashboard);
router.get('/day', analytics.day);
// Destructive / data-extraction endpoints are strictly admin-only.
router.post('/clear', requireRole(ROLES.ADMIN), invalidateCache('dashboard'), analytics.clear);
router.post('/refresh', requireRole(ROLES.ADMIN), invalidateCache('dashboard'), analytics.refresh);
router.get('/export', requireRole(ROLES.ADMIN), analytics.exportStats);

export default router;