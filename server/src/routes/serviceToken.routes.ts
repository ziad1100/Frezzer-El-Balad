import { Router } from 'express';
import * as svc from '../controllers/serviceToken.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

router.use(requireAuth);

// Only admins can manage service tokens
router.post('/', requirePermission('settings', 'update'), svc.generateToken);
router.get('/', requirePermission('settings', 'read'), svc.listTokens);
router.delete('/:id', requirePermission('settings', 'update'), svc.revokeToken);

export default router;
