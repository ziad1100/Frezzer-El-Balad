import { Router } from 'express';
import * as inventory from '../controllers/inventory.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

// All inventory routes require authentication and admin/manager permissions
router.use(requireAuth);

router.get('/stats', requirePermission('products', 'read'), inventory.getInventoryStats);
router.get('/sales', requirePermission('orders', 'read'), inventory.getSalesStats);
router.get('/stock', requirePermission('products', 'read'), inventory.getStock);
router.patch('/stock', requirePermission('products', 'update'), inventory.updateStock);
router.patch('/track', requirePermission('products', 'update'), inventory.setTrackInventory);

export default router;
