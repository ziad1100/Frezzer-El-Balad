import { Router } from 'express';
import { handleWebhook, handleGenericWebhook } from '../controllers/paymentWebhook.controller';

const router = Router();

/**
 * Payment webhook endpoints.
 * These routes do NOT require authentication — webhooks come from external providers.
 * Security is handled by signature verification inside the controller.
 */

// Provider-specific webhook endpoint
// POST /api/v1/payments/webhook/fawry
// POST /api/v1/payments/webhook/aman
router.post('/webhook/:provider', handleWebhook);

// Generic webhook (provider determined from payload)
router.post('/webhook', handleGenericWebhook);

export default router;
