/**
 * Payment Webhook Controller
 *
 * Handles incoming webhook notifications from payment providers.
 * Each webhook:
 * 1. Is authenticated (signature verification)
 * 2. Is parsed and validated
 * 3. Updates the order payment status
 * 4. Is idempotent (duplicate webhooks are ignored)
 *
 * Security:
 * - Only accepts webhooks from configured providers
 * - Verifies HMAC signatures where supported
 * - Logs webhook events without exposing sensitive data
 * - Does not store raw webhook bodies with credentials
 */

import type { Request, Response } from 'express';
import { paymentManager } from '../services/payment/paymentAdapter';
import * as ordersRepo from '../db/orders';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

/** Valid payment status transitions for webhook updates. */
const VALID_WEBHOOK_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'paid', 'failed', 'cancelled', 'expired'],
  processing: ['paid', 'failed', 'cancelled', 'expired'],
  paid: ['refunded'],
  failed: ['pending', 'processing'],
  cancelled: ['pending'],
  expired: ['pending'],
  refunded: [],
};

/**
 * POST /api/v1/payments/webhook/:provider
 *
 * Receives webhook notifications from payment providers.
 * The :provider parameter identifies which provider sent the webhook.
 */
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { provider } = req.params;
  const rawBody = JSON.stringify(req.body);

  // Parse the webhook payload
  const payload = {
    provider,
    transactionId: req.body.transaction_id ?? req.body.referenceNumber ?? req.body.id ?? '',
    orderId: req.body.order_id ?? req.body.merchantRefNumber ?? req.body.orderId ?? '',
    status: req.body.status ?? 'pending',
    amount: req.body.amount ?? req.body.amount_cents,
    rawBody,
    signature: req.headers['x-signature'] as string ?? req.body.signature ?? '',
    timestamp: req.body.timestamp ?? new Date().toISOString(),
    metadata: req.body,
  };

  // Verify and parse the webhook through the provider
  const verifiedPayload = await paymentManager.handleWebhook(payload);
  if (!verifiedPayload) {
    console.warn(`[webhook] Rejected webhook from unknown provider: ${provider}`);
    throw new ApiError(400, 'Invalid webhook');
  }

  const { orderId, transactionId, status } = verifiedPayload;

  if (!orderId || orderId === '00000000-0000-0000-0000-000000000000') {
    // Test or invalid webhook
    console.log(`[webhook] Ignored webhook for test/invalid order: ${orderId}`);
    res.json(new ApiResponse(200, null, 'Webhook acknowledged'));
    return;
  }

  // Get the order
  const order = await ordersRepo.getById(orderId);
  if (!order) {
    console.warn(`[webhook] Order not found: ${orderId}`);
    throw new ApiError(404, 'Order not found');
  }

  // Check if this is a duplicate webhook (idempotency)
  const currentPaymentStatus = (order.paymentStatus as string) ?? 'pending';
  if (currentPaymentStatus === status) {
    console.log(`[webhook] Duplicate webhook ignored: order ${order.orderNo} already ${status}`);
    res.json(new ApiResponse(200, null, 'Webhook already processed'));
    return;
  }

  // Validate the status transition
  const allowedTransitions = VALID_WEBHOOK_TRANSITIONS[currentPaymentStatus] ?? [];
  if (!allowedTransitions.includes(status)) {
    console.warn(`[webhook] Invalid transition: ${currentPaymentStatus} → ${status} for order ${order.orderNo}`);
    throw new ApiError(400, `Invalid payment status transition: ${currentPaymentStatus} → ${status}`);
  }

  // Update the order payment status
  await ordersRepo.updatePaymentStatus(orderId, {
    paymentStatus: status,
    paymentReference: transactionId,
  });

  console.log(`[webhook] Order ${order.orderNo} payment status: ${currentPaymentStatus} → ${status}`);

  res.json(new ApiResponse(200, null, 'Webhook processed'));
});

/**
 * POST /api/v1/payments/webhook
 *
 * Generic webhook endpoint (provider determined from payload or headers).
 */
export const handleGenericWebhook = asyncHandler(async (req: Request, res: Response) => {
  const provider = req.body.provider
    ?? req.headers['x-provider']
    ?? req.query.provider
    ?? 'unknown';

  // Redirect to provider-specific handler
  req.params = { ...req.params, provider: String(provider) };
  await handleWebhook(req, res, () => {});
});
