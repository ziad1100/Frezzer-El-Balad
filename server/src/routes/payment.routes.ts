import { Router } from 'express';
import * as payment from '../controllers/payment.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

// Public: payment settings (non-sensitive config) — no auth required
router.get('/settings', payment.getPaymentSettings);

// ── Authenticated routes below ──
router.use(requireAuth);

// Customer: submit manual payment proof
router.post('/submit', payment.submitManualPayment);

// Customer: initiate card (Visa) payment via Paymob
router.post('/card/init', payment.initCardPayment);

// Customer: check card payment status
router.get('/card/status/:orderId', payment.getCardPaymentStatus);

// Customer: get payment transactions for an order
router.get('/order/:orderId', payment.getOrderPayments);

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
