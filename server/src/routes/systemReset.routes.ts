import { Router } from 'express';
import * as systemReset from '../controllers/systemReset.controller';
import { requireAuth, requireRole } from '../middlewares/auth';
import { invalidateCache } from '../middlewares/cache';
import { ROLES } from '../constants';

const router = Router();

// POST /api/system/reset — admin only (revenue/sales reset)
router.post(
  '/reset',
  requireAuth,
  requireRole(ROLES.ADMIN),
  invalidateCache('dashboard'),
  systemReset.systemResetHandler,
);

// POST /api/system/reset-purchases — admin only (purchases reset)
router.post(
  '/reset-purchases',
  requireAuth,
  requireRole(ROLES.ADMIN),
  invalidateCache('dashboard'),
  systemReset.resetPurchasesHandler,
);

export default router;
