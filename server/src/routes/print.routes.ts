import { Router } from 'express';
import * as print from '../controllers/print.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Admin routes — print job management
router.post('/', requirePermission('orders', 'update'), print.createPrintJob);
router.get('/recent', requirePermission('orders', 'read'), print.listRecentJobs);
router.get('/order/:orderId', requirePermission('orders', 'read'), print.getOrderPrintJobs);
router.patch('/:jobId/success', requirePermission('orders', 'update'), print.reportSuccess);
router.patch('/:jobId/failure', requirePermission('orders', 'update'), print.reportFailure);
router.post('/:jobId/retry', requirePermission('orders', 'update'), print.retryPrintJob);
router.post('/order/:orderId/mark', requirePermission('orders', 'update'), print.markOrderPrinted);

// Local print service polling — requires a service token (basic auth)
router.get('/poll', print.pollJob);

export default router;
