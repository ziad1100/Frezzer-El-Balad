/**
 * Payment Controller
 *
 * Handles payment-related operations:
 * - Submit Vodafone Cash / manual payment proofs
 * - Admin payment verification (approve/reject)
 * - Payment transaction history
 * - Payment settings
 */

import type { Request, Response } from 'express';
import * as paymentRepo from '../db/payment-transactions';
import * as ordersRepo from '../db/orders';
import { query } from '../db';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import type { AuthRequest } from '../middlewares/auth';
import { ROLES, PAYMENT_STATUS } from '../constants';
import { paymentManager } from '../services/payment/paymentAdapter';

/**
 * Submit a manual payment (Vodafone Cash, Bank Transfer, InstaPay).
 * Customer provides transaction details + optional proof.
 */
export const submitManualPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    orderId,
    paymentMethod,
    transactionReference,
    senderPhone,
    senderName,
    proofUrl,
    proofType,
  } = req.body;

  if (!orderId) throw new ApiError(400, 'Order ID is required');
  if (!paymentMethod) throw new ApiError(400, 'Payment method is required');

  // Verify the order belongs to this user (or user is admin)
  const order = await ordersRepo.getById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const userId = req.user!.id;
  const isAdmin = req.user!.role === ROLES.ADMIN || req.user!.role === ROLES.MANAGER || req.user!.role === ROLES.EMPLOYEE;
  const orderUserId = typeof order.user === 'string' ? order.user : (order.user as { _id: string })?._id;

  if (!isAdmin && orderUserId !== userId) {
    throw new ApiError(403, 'You can only submit payment for your own orders');
  }

  // Validate payment method
  const validManualMethods = ['vodafone_cash', 'bank_transfer', 'instapay'];
  if (!validManualMethods.includes(paymentMethod)) {
    throw new ApiError(400, 'Invalid manual payment method');
  }

  // Idempotency: check for duplicate transaction reference
  if (transactionReference) {
    const duplicate = await paymentRepo.findDuplicateTransaction(orderId, transactionReference);
    if (duplicate) {
      throw new ApiError(409, 'This transaction reference has already been submitted');
    }
  }

  // Validate required fields per method
  if (paymentMethod === 'vodafone_cash') {
    if (!senderPhone) throw new ApiError(400, 'Phone number used for transfer is required');
    if (!transactionReference) throw new ApiError(400, 'Transaction number is required');
  }

  // Create payment transaction
  const transaction = await paymentRepo.createTransaction({
    orderId,
    paymentMethod,
    provider: 'manual',
    amount: Number(order.total),
    status: 'pending_verification',
    transactionReference: transactionReference ?? '',
    senderPhone: senderPhone ?? '',
    senderName: senderName ?? '',
    proofUrl: proofUrl ?? '',
    proofType: proofType ?? '',
    metadata: {
      submittedBy: userId,
      orderNo: order.orderNo,
    },
  });

  // Update order payment status
  await paymentRepo.updateOrderPaymentStatus(orderId, 'pending_verification');

  // Update order paymentDetails
  await query(
    `UPDATE orders SET "paymentDetails" = $2 WHERE id = $1`,
    [orderId, JSON.stringify({
      method: paymentMethod,
      transactionId: transaction.id,
      reference: transactionReference ?? '',
      senderPhone: senderPhone ?? '',
      submittedAt: new Date().toISOString(),
    })],
  );

  res.status(201).json(new ApiResponse(201, transaction, 'Payment submitted for verification'));
});

/**
 * Admin: List pending verification payments.
 */
export const listPendingPayments = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const result = await paymentRepo.getPendingVerification(limit, offset);
  res.json(new ApiResponse(200, {
    items: result.items,
    total: result.total,
    page,
    pages: Math.ceil(result.total / limit),
  }));
});

/**
 * Admin: Get payment transaction details.
 */
export const getTransaction = asyncHandler(async (req: Request, res: Response) => {
  const transaction = await paymentRepo.getTransactionById(req.params.id);
  if (!transaction) throw new ApiError(404, 'Transaction not found');

  // Get associated order info
  const order = await ordersRepo.getById(transaction.orderId);
  res.json(new ApiResponse(200, {
    ...transaction,
    order: order ? {
      orderNo: order.orderNo,
      customerName: order.customerName,
      phone: order.phone,
      total: order.total,
    } : null,
  }));
});

/**
 * Admin: Approve a payment transaction.
 */
export const approvePayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const transaction = await paymentRepo.getTransactionById(req.params.id);
  if (!transaction) throw new ApiError(404, 'Transaction not found');
  if (transaction.status !== 'pending_verification') {
    throw new ApiError(400, 'This transaction is not pending verification');
  }

  const approved = await paymentRepo.approveTransaction(req.params.id, req.user!.id);
  if (!approved) throw new ApiError(400, 'Failed to approve transaction');

  // Update order payment status to paid
  await paymentRepo.updateOrderPaymentStatus(
    transaction.orderId,
    PAYMENT_STATUS.PAID,
    transaction.transactionReference,
  );

  res.json(new ApiResponse(200, approved, 'Payment approved'));
});

/**
 * Admin: Reject a payment transaction.
 */
export const rejectPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { reason } = req.body;
  if (!reason) throw new ApiError(400, 'Rejection reason is required');

  const transaction = await paymentRepo.getTransactionById(req.params.id);
  if (!transaction) throw new ApiError(404, 'Transaction not found');
  if (transaction.status !== 'pending_verification') {
    throw new ApiError(400, 'This transaction is not pending verification');
  }

  const rejected = await paymentRepo.rejectTransaction(req.params.id, req.user!.id, reason);
  if (!rejected) throw new ApiError(400, 'Failed to reject transaction');

  // Update order payment status to rejected
  await paymentRepo.updateOrderPaymentStatus(transaction.orderId, 'rejected');

  res.json(new ApiResponse(200, rejected, 'Payment rejected'));
});

/**
 * Get payment transactions for an order.
 */
export const getOrderPayments = asyncHandler(async (req: Request, res: Response) => {
  const transactions = await paymentRepo.getTransactionsByOrder(req.params.orderId);
  res.json(new ApiResponse(200, transactions));
});

/**
 * Get payment settings (public-safe config).
 * Returns only non-sensitive payment configuration.
 */
export const getPaymentSettings = asyncHandler(async (_req: Request, res: Response) => {
  const result = await query(
    `SELECT value FROM settings WHERE key = 'paymentSettings'`,
  );

  const defaultSettings = {
    vodafoneCash: {
      enabled: true,
      walletNumber: '',
      instructions: {
        ar: 'قم بالتحويل إلى رقم المحفظة التالي، ثم أدخل بيانات التحويل',
        en: 'Transfer to the following wallet number, then enter transfer details',
      },
    },
    bankTransfer: {
      enabled: false,
      bankName: '',
      accountNumber: '',
      accountName: '',
      instructions: { ar: '', en: '' },
    },
    instapay: {
      enabled: false,
      accountName: '',
      instructions: { ar: '', en: '' },
    },
    card: {
      enabled: false,
      provider: 'none',
    },
    cashOnDelivery: {
      enabled: true,
    },
  };

  const settings = result[0]?.value ?? defaultSettings;
  res.json(new ApiResponse(200, settings));
});

/**
 * Initiate a card (Visa) payment via Paymob.
 *
 * Creates a Paymob payment session for an existing order and returns
 * the redirect URL where the customer enters card details on Paymob's
 * hosted checkout.
 *
 * POST /api/v1/payments/card/init
 * Body: { orderId: string }
 */
export const initCardPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { orderId } = req.body;
  if (!orderId) throw new ApiError(400, 'Order ID is required');

  // Get the order
  const order = await ordersRepo.getById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  // Verify the order belongs to this user (or user is admin)
  const userId = req.user!.id;
  const isAdmin = req.user!.role === ROLES.ADMIN || req.user!.role === ROLES.MANAGER || req.user!.role === ROLES.EMPLOYEE;
  const orderUserId = typeof order.user === 'string' ? order.user : (order.user as { _id: string })?._id;

  if (!isAdmin && orderUserId !== userId) {
    throw new ApiError(403, 'You can only initiate payment for your own orders');
  }

  // Verify payment method is card
  if (order.paymentMethod !== 'card') {
    throw new ApiError(400, 'This order does not use card payment');
  }

  // Verify order is in a payable state
  const payableStatuses = ['pending', 'confirmed'];
  if (!payableStatuses.includes(order.status as string)) {
    throw new ApiError(400, 'This order cannot be paid in its current status');
  }

  // Check if there's already a pending card payment transaction (idempotency)
  const existingTransactions = await paymentRepo.getTransactionsByOrder(orderId);
  const pendingCardTx = existingTransactions.find(
    (tx) => tx.paymentMethod === 'card' && tx.provider === 'paymob' && ['pending', 'processing'].includes(tx.status),
  );
  if (pendingCardTx) {
    throw new ApiError(409, 'A card payment is already in progress for this order');
  }

  // Get the paymob provider
  const paymobProvider = paymentManager.getProvider('paymob');
  if (!paymobProvider) {
    throw new ApiError(503, 'Card payment is not configured. Please contact the administrator.');
  }

  // Create payment request
  const paymentRequest = {
    orderId: order.id as string,
    orderNo: order.orderNo as string,
    amount: Number(order.total),
    currency: 'EGP',
    method: 'card' as const,
    customerName: order.customerName as string,
    customerPhone: order.phone as string,
    description: `Order ${order.orderNo}`,
  };

  // Charge via Paymob
  const result = await paymobProvider.charge(paymentRequest);

  if (!result.success || !result.redirectUrl) {
    throw new ApiError(502, result.errorMessage ?? 'Failed to initiate card payment');
  }

  // Store the payment transaction
  await paymentRepo.createTransaction({
    orderId: order.id as string,
    paymentMethod: 'card',
    provider: 'paymob',
    amount: Number(order.total),
    status: 'processing',
    providerTransactionId: result.transactionId ?? '',
    transactionReference: result.reference ?? '',
    metadata: {
      paymobOrderId: result.transactionId,
      paymobToken: result.reference,
    },
  });

  // Update order payment status to processing
  await paymentRepo.updateOrderPaymentStatus(orderId, 'processing');

  res.json(new ApiResponse(200, {
    redirectUrl: result.redirectUrl,
    transactionId: result.transactionId,
  }, 'Card payment initiated'));
});

/**
 * Check card payment status for an order.
 * Used by the frontend to poll for payment confirmation after redirect.
 *
 * GET /api/v1/payments/card/status/:orderId
 */
export const getCardPaymentStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;

  const order = await ordersRepo.getById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  res.json(new ApiResponse(200, {
    paymentStatus: order.paymentStatus ?? 'pending',
    status: order.status,
    orderNo: order.orderNo,
  }));
});

/**
 * Admin: Update payment settings.
 */
export const updatePaymentSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const settings = req.body;
  if (!settings || typeof settings !== 'object') {
    throw new ApiError(400, 'Invalid settings');
  }

  // Only store non-sensitive configuration
  const safeSettings = {
    vodafoneCash: {
      enabled: Boolean(settings.vodafoneCash?.enabled),
      walletNumber: String(settings.vodafoneCash?.walletNumber ?? ''),
      instructions: settings.vodafoneCash?.instructions ?? { ar: '', en: '' },
    },
    bankTransfer: {
      enabled: Boolean(settings.bankTransfer?.enabled),
      bankName: String(settings.bankTransfer?.bankName ?? ''),
      accountNumber: String(settings.bankTransfer?.accountNumber ?? ''),
      accountName: String(settings.bankTransfer?.accountName ?? ''),
      instructions: settings.bankTransfer?.instructions ?? { ar: '', en: '' },
    },
    instapay: {
      enabled: Boolean(settings.instapay?.enabled),
      accountName: String(settings.instapay?.accountName ?? ''),
      instructions: settings.instapay?.instructions ?? { ar: '', en: '' },
    },
    card: {
      enabled: Boolean(settings.card?.enabled),
      provider: String(settings.card?.provider ?? 'none'),
    },
    cashOnDelivery: {
      enabled: Boolean(settings.cashOnDelivery?.enabled ?? true),
    },
  };

  await query(
    `INSERT INTO settings (key, value) VALUES ('paymentSettings', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1`,
    [JSON.stringify(safeSettings)],
  );

  res.json(new ApiResponse(200, safeSettings, 'Payment settings updated'));
});
