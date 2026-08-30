/**
 * Payment API Functions
 *
 * Handles payment-related API calls:
 * - Submit manual payment proofs
 * - Get payment transactions
 * - Admin payment verification
 * - Payment settings
 */

import { api, unwrap } from '@/lib/api';
import type { ApiEnvelope } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────

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
  // Joined from order
  orderNo?: string;
  customerName?: string;
  phone?: string;
}

export interface PaymentSettings {
  vodafoneCash: {
    enabled: boolean;
    walletNumber: string;
    instructions: { ar: string; en: string };
  };
  bankTransfer: {
    enabled: boolean;
    bankName: string;
    accountNumber: string;
    accountName: string;
    instructions: { ar: string; en: string };
  };
  instapay: {
    enabled: boolean;
    accountName: string;
    instructions: { ar: string; en: string };
  };
  card: {
    enabled: boolean;
    provider: string;
  };
  cashOnDelivery: {
    enabled: boolean;
  };
}

export interface PendingPaymentItem extends PaymentTransaction {
  orderNo: string;
  customerName: string;
  phone: string;
}

export interface PendingPaymentsResponse {
  items: PendingPaymentItem[];
  total: number;
  page: number;
  pages: number;
}

// ── Customer API ───────────────────────────────────────────────────────────

/**
 * Submit a manual payment (Vodafone Cash, Bank Transfer, InstaPay).
 */
export const submitManualPayment = (payload: {
  orderId: string;
  paymentMethod: string;
  transactionReference?: string;
  senderPhone?: string;
  senderName?: string;
  proofUrl?: string;
  proofType?: string;
}): Promise<PaymentTransaction> =>
  unwrap(api.post<ApiEnvelope<PaymentTransaction>>('/payment/submit', payload));

/**
 * Get payment transactions for an order.
 */
export const getOrderPayments = (orderId: string): Promise<PaymentTransaction[]> =>
  unwrap(api.get<ApiEnvelope<PaymentTransaction[]>>(`/payment/order/${orderId}`));

/**
 * Get payment settings (public-safe config).
 */
export const getPaymentSettings = (): Promise<PaymentSettings> =>
  unwrap(api.get<ApiEnvelope<PaymentSettings>>('/payment/settings'));

/**
 * Initiate a card (Visa) payment via Paymob.
 * Returns a redirect URL to Paymob's hosted checkout.
 */
export const initCardPayment = (orderId: string): Promise<{ redirectUrl: string; transactionId: string }> =>
  unwrap(api.post<ApiEnvelope<{ redirectUrl: string; transactionId: string }>>('/payment/card/init', { orderId }));

/**
 * Check card payment status for an order.
 */
export const getCardPaymentStatus = (orderId: string): Promise<{ paymentStatus: string; status: string; orderNo: string }> =>
  unwrap(api.get<ApiEnvelope<{ paymentStatus: string; status: string; orderNo: string }>>(`/payment/card/status/${orderId}`));

// ── Admin API ──────────────────────────────────────────────────────────────

/**
 * Admin: List pending verification payments.
 */
export const adminListPendingPayments = (params: { page?: number; limit?: number } = {}): Promise<PendingPaymentsResponse> =>
  unwrap(api.get<ApiEnvelope<PendingPaymentsResponse>>('/payment/admin/pending', { params }));

/**
 * Admin: Get payment transaction details.
 */
export const adminGetTransaction = (id: string): Promise<PaymentTransaction & { order: { orderNo: string; customerName: string; phone: string; total: number } | null }> =>
  unwrap(api.get<ApiEnvelope<PaymentTransaction & { order: { orderNo: string; customerName: string; phone: string; total: number } | null }>>(`/payment/admin/${id}`));

/**
 * Admin: Approve a payment transaction.
 */
export const adminApprovePayment = (id: string): Promise<PaymentTransaction> =>
  unwrap(api.post<ApiEnvelope<PaymentTransaction>>(`/payment/admin/${id}/approve`));

/**
 * Admin: Reject a payment transaction.
 */
export const adminRejectPayment = (id: string, reason: string): Promise<PaymentTransaction> =>
  unwrap(api.post<ApiEnvelope<PaymentTransaction>>(`/payment/admin/${id}/reject`, { reason }));

/**
 * Admin: Get payment settings.
 */
export const adminGetPaymentSettings = (): Promise<PaymentSettings> =>
  unwrap(api.get<ApiEnvelope<PaymentSettings>>('/payment/admin/settings'));

/**
 * Admin: Update payment settings.
 */
export const adminUpdatePaymentSettings = (settings: Partial<PaymentSettings>): Promise<PaymentSettings> =>
  unwrap(api.patch<ApiEnvelope<PaymentSettings>>('/payment/admin/settings', settings));
