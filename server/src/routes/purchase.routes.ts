import { Router } from 'express';
import * as purchase from '../controllers/purchase.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('orders', 'read'), purchase.listPurchases);
router.get('/stats', requirePermission('orders', 'read'), purchase.getPurchaseStats);
router.get('/report', requirePermission('orders', 'read'), purchase.getProductReport);
router.post('/', requirePermission('orders', 'create'), purchase.createPurchase);
router.delete('/:id', requirePermission('orders', 'delete'), purchase.deletePurchase);

export default router;
