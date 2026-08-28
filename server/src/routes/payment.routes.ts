import { Router } from 'express';
import * as payment from '../controllers/payment.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Customer: submit manual payment proof
router.post('/submit', payment.submitManualPayment);

// Customer: get payment transactions for an order
router.get('/order/:orderId', payment.getOrderPayments);

// Public: payment settings (non-sensitive config)
router.get('/settings', payment.getPaymentSettings);

// Admin: payment verification
router.get(
  '/admin/pending',
  requirePermission('orders', 'read'),
  payment.listPendingPayments,
);

router.get(
  '/admin/:id',
  requirePermission('orders', 'read'),
  payment.getTransaction,
);

router.post(
  '/admin/:id/approve',
  requirePermission('orders', 'update'),
  payment.approvePayment,
);

router.post(
  '/admin/:id/reject',
  requirePermission('orders', 'update'),
  payment.rejectPayment,
);

// Admin: payment settings
router.get(
  '/admin/settings',
  requirePermission('settings', 'read'),
  payment.getPaymentSettings,
);

router.patch(
  '/admin/settings',
  requirePermission('settings', 'update'),
  payment.updatePaymentSettings,
);

export default router;
