/**
 * Payment Transactions DB Module
 *
 * Handles all payment transaction CRUD operations.
 * Stores payment proofs, transaction references, and verification status.
 * NEVER stores raw card numbers, CVV, PIN, or other sensitive credentials.
 */

import { query } from './index';

export interface PaymentTransaction {
  id: string;
  orderId: string;
  paymentMethod: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  transactionReference: string;
  providerTransactionId: string;
  senderPhone: string;
  senderName: string;
  proofUrl: string;
  proofType: string;
  cardLast4: string;
  cardBrand: string;
  metadata: Record<string, unknown>;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionInput {
  orderId: string;
  paymentMethod: string;
  provider?: string;
  amount: number;
  currency?: string;
  status?: string;
  transactionReference?: string;
  providerTransactionId?: string;
  senderPhone?: string;
  senderName?: string;
  proofUrl?: string;
  proofType?: string;
  cardLast4?: string;
  cardBrand?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new payment transaction record.
 */
export async function createTransaction(input: CreateTransactionInput): Promise<PaymentTransaction> {
  const rows = await query<PaymentTransaction>(
    `INSERT INTO payment_transactions
      ("orderId", "paymentMethod", provider, amount, currency, status,
       "transactionReference", "providerTransactionId",
       "senderPhone", "senderName", "proofUrl", "proofType",
       "cardLast4", "cardBrand", metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      input.orderId,
      input.paymentMethod,
      input.provider ?? 'manual',
      input.amount,
      input.currency ?? 'EGP',
      input.status ?? 'pending',
      input.transactionReference ?? '',
      input.providerTransactionId ?? '',
      input.senderPhone ?? '',
      input.senderName ?? '',
      input.proofUrl ?? '',
      input.proofType ?? '',
      input.cardLast4 ?? '',
      input.cardBrand ?? '',
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return rows[0];
}

/**
 * Get a transaction by ID.
 */
export async function getTransactionById(id: string): Promise<PaymentTransaction | null> {
  const rows = await query<PaymentTransaction>(
    'SELECT * FROM payment_transactions WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Get all transactions for an order.
 */
export async function getTransactionsByOrder(orderId: string): Promise<PaymentTransaction[]> {
  const rows = await query<PaymentTransaction>(
    'SELECT * FROM payment_transactions WHERE "orderId" = $1 ORDER BY "createdAt" DESC',
    [orderId],
  );
  return rows;
}

/**
 * Get pending verification transactions (admin review queue).
 */
export async function getPendingVerification(limit = 50, offset = 0): Promise<{
  items: Array<PaymentTransaction & { orderNo: string; customerName: string; phone: string }>;
  total: number;
}> {
  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM payment_transactions WHERE status = 'pending_verification'`,
  );
  const total = parseInt(countRows[0]?.count ?? '0', 10);

  const items = await query<PaymentTransaction & { orderNo: string; customerName: string; phone: string }>(
    `SELECT pt.*, o."orderNo", o."customerName", o.phone
     FROM payment_transactions pt
     JOIN orders o ON o.id = pt."orderId"
     WHERE pt.status = 'pending_verification'
     ORDER BY pt."createdAt" ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );

  return { items, total };
}

/**
 * Approve a payment transaction.
 */
export async function approveTransaction(
  id: string,
  verifiedBy: string,
): Promise<PaymentTransaction | null> {
  const rows = await query<PaymentTransaction>(
    `UPDATE payment_transactions
     SET status = 'paid', "verifiedBy" = $2, "verifiedAt" = now()
     WHERE id = $1 AND status = 'pending_verification'
     RETURNING *`,
    [id, verifiedBy],
  );
  return rows[0] ?? null;
}

/**
 * Reject a payment transaction.
 */
export async function rejectTransaction(
  id: string,
  verifiedBy: string,
  reason: string,
): Promise<PaymentTransaction | null> {
  const rows = await query<PaymentTransaction>(
    `UPDATE payment_transactions
     SET status = 'rejected', "verifiedBy" = $2, "rejectionReason" = $3, "verifiedAt" = now()
     WHERE id = $1 AND status = 'pending_verification'
     RETURNING *`,
    [id, verifiedBy, reason],
  );
  return rows[0] ?? null;
}

/**
 * Update order payment status after transaction approval.
 */
export async function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: string,
  transactionReference?: string,
): Promise<void> {
  await query(
    `UPDATE orders
     SET "paymentStatus" = $2,
         "paymentReference" = COALESCE(NULLIF($3, ''), "paymentReference"),
         "paidAt" = CASE WHEN $2 = 'paid' THEN now() ELSE "paidAt" END
     WHERE id = $1`,
    [orderId, paymentStatus, transactionReference ?? ''],
  );
}

/**
 * Check for duplicate transaction by reference + order (idempotency).
 */
export async function findDuplicateTransaction(
  orderId: string,
  transactionReference: string,
): Promise<PaymentTransaction | null> {
  if (!transactionReference) return null;
  const rows = await query<PaymentTransaction>(
    `SELECT * FROM payment_transactions
     WHERE "orderId" = $1 AND "transactionReference" = $2
     LIMIT 1`,
    [orderId, transactionReference],
  );
  return rows[0] ?? null;
}
