import { Router } from 'express';
import * as order from '../controllers/order.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';
import { logActivity } from '../middlewares/activityLogger';
import { zodBody } from '../middlewares/zod';
import { invalidateCache } from '../middlewares/cache';
import { createOrderSchema, updateStatusSchema, adminCancelOrderSchema, markComplimentarySchema } from '../schemas';

const router = Router();

router.use(requireAuth);

router.post('/', zodBody(createOrderSchema), invalidateCache('dashboard'), order.createOrder);
router.post('/:id/cancel', invalidateCache('dashboard'), order.cancelOrder);
router.post('/:id/admin-cancel', requirePermission('orders', 'update'), zodBody(adminCancelOrderSchema), logActivity('cancel', 'orders'), invalidateCache('dashboard'), order.adminCancel);
router.post('/:id/complimentary', requirePermission('orders', 'update'), zodBody(markComplimentarySchema), logActivity('complimentary', 'orders'), invalidateCache('dashboard'), order.adminComplimentary);
router.get('/history', order.history);
router.get('/stats', requirePermission('orders', 'read'), order.stats);
router.get('/admin', requirePermission('orders', 'read'), order.adminList);
router.patch('/:id/status', requirePermission('orders', 'update'), zodBody(updateStatusSchema), logActivity('status', 'orders'), invalidateCache('dashboard'), order.updateStatus);

export default router;