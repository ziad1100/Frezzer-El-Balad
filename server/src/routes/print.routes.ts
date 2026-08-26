import { Router } from 'express';
import * as print from '../controllers/print.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Admin routes — print job management
router.post('/', requirePermission('orders', 'update'), print.createPrintJob);
router.post('/test', requirePermission('orders', 'update'), print.createTestPrintJob);
router.get('/recent', requirePermission('orders', 'read'), print.listRecentJobs);
router.get('/order/:orderId', requirePermission('orders', 'read'), print.getOrderPrintJobs);
router.patch('/:jobId/success', requirePermission('orders', 'update'), print.reportSuccess);
router.patch('/:jobId/failure', requirePermission('orders', 'update'), print.reportFailure);
router.post('/:jobId/retry', requirePermission('orders', 'update'), print.retryPrintJob);
router.post('/order/:orderId/mark', requirePermission('orders', 'update'), print.markOrderPrinted);

// Agent status endpoints (local print agent reports status)
router.patch('/agent/status', requirePermission('orders', 'update'), print.updateAgentStatus);
router.get('/agent/status', requirePermission('orders', 'read'), print.getAgentStatus);

// Print error codes reference
router.get('/error-codes', requirePermission('orders', 'read'), print.getErrorCodes);

// Local print service polling — requires a service token (basic auth)
router.get('/poll', print.pollJob);

export default router;
