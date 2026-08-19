import { Router } from 'express';
import * as systemReset from '../controllers/systemReset.controller';
import { requireAuth, requireRole } from '../middlewares/auth';
import { invalidateCache } from '../middlewares/cache';
import { ROLES } from '../constants';

const router = Router();

// POST /api/system/reset — admin only
router.post(
  '/reset',
  requireAuth,
  requireRole(ROLES.ADMIN),
  invalidateCache('dashboard'),
  systemReset.systemResetHandler,
);

export default router;
