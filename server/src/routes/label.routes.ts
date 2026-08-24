import { Router } from 'express';
import * as label from '../controllers/label.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

// Public: list active labels
router.get('/', label.list);

// Admin: list labels with product counts
router.get('/admin', requireAuth, requirePermission('products', 'read'), label.adminList);

// Get single label
router.get('/:id', label.getById);

// Authenticated routes
router.use(requireAuth);

// Create label (requires product create permission)
router.post('/', requirePermission('products', 'create'), label.create);

// Update label
router.patch('/:id', requirePermission('products', 'update'), label.update);

// Delete label (only if unused)
router.delete('/:id', requirePermission('products', 'delete'), label.remove);

// Product-label associations
router.get('/product/:productId', requirePermission('products', 'read'), label.getProductLabels);
router.put('/product/:productId', requirePermission('products', 'update'), label.setProductLabels);

export default router;
