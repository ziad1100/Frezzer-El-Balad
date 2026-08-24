/**
 * AMAN Payment Gateway Adapter
 *
 * Implements the PaymentProvider interface for AMAN (Egyptian payment network).
 * AMAN is a reference-number based payment system similar to Fawry.
 * Customers pay at AMAN retail stores across Egypt.
 *
 * Supported methods:
 * - Reference number payments (pay at any AMAN store)
 *
 * Requires:
 * - AMAN merchant account
 * - API credentials (merchantCode, apiKey)
 * - Webhook endpoint for payment confirmation
 *
 * Note: AMAN API documentation is limited. This adapter provides a
 * structured integration point. Actual API endpoints and authentication
 * may need to be adjusted based on AMAN's current API documentation.
 *
 * API Base: https://paylink.egycs.com/api
 */

import type { PaymentProvider, PaymentRequest, PaymentResult, WebhookPayload } from '../paymentAdapter';

export interface AmanConfig {
  merchantCode: string;
  apiKey: string;
  /** 'sandbox' or 'production' */
  environment: 'sandbox' | 'production';
  /** Webhook URL for payment status updates */
  webhookUrl?: string;
}

/** AMAN payment status codes. */
const AMAN_STATUS_MAP: Record<string, PaymentStatus> = {
  'Success': 'paid',
  'Paid': 'paid',
  'Completed': 'paid',
  'Failed': 'failed',
  'Cancelled': 'cancelled',
  'Expired': 'expired',
  'Pending': 'processing',
  'Initiated': 'processing',
};

type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'expired' | 'refunded';

const BASE_URLS = {
  sandbox: 'https://paylink.egycs.com/api',
  production: 'https://paylink.egycs.com/api',
};

export class AmanPaymentProvider implements PaymentProvider {
  readonly id = 'aman';
  readonly name = 'AMAN';
  readonly methods = ['other' as const] as PaymentProvider['methods'];

  private config: AmanConfig | null = null;

  async initialize(config: Record<string, unknown>): Promise<boolean> {
    const amanConfig = config as unknown as AmanConfig;
    if (!amanConfig.merchantCode || !amanConfig.apiKey) {
      console.error('[payment:aman] Missing merchantCode or apiKey');
      return false;
    }
    this.config = amanConfig;
    return true;
  }

  private get baseUrl(): string {
    return BASE_URLS[this.config?.environment ?? 'sandbox'];
  }

  async charge(request: PaymentRequest): Promise<PaymentResult> {
    if (!this.config) {
      return { success: false, status: 'failed', errorCode: 'NOT_INITIALIZED', errorMessage: 'AMAN not initialized' };
    }

    try {
      const payload = {
        merchantCode: this.config.merchantCode,
        apiKey: this.config.apiKey,
        orderId: request.orderId,
        amount: request.amount,
        currency: 'EGP',
        description: request.description ?? `Order ${request.orderNo}`,
        customerName: request.customerName ?? '',
        customerPhone: request.customerPhone ?? '',
        customerEmail: request.customerEmail ?? '',
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await fetch(`${this.baseUrl}/v1/payment/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { code?: number; referenceNumber?: string; transactionId?: string; orderId?: string; message?: string };

      if (data.code === 200 || data.referenceNumber) {
        return {
          success: true,
          status: 'processing',
          transactionId: data.referenceNumber ?? data.transactionId,
          reference: data.orderId,
        };
      }

      return {
        success: false,
        status: 'failed',
        errorCode: String(data.code ?? 'UNKNOWN'),
        errorMessage: data.message ?? 'AMAN charge failed',
      };
    } catch (err) {
      return {
        success: false,
        status: 'failed',
        errorCode: 'NETWORK_ERROR',
        errorMessage: err instanceof Error ? err.message : 'AMAN API error',
      };
    }
  }

  async getStatus(transactionId: string): Promise<PaymentResult> {
    if (!this.config) {
      return { success: false, status: 'failed', errorCode: 'NOT_INITIALIZED', errorMessage: 'AMAN not initialized' };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/v1/payment/status?referenceNumber=${transactionId}&merchantCode=${this.config.merchantCode}&apiKey=${this.config.apiKey}`,
      );

      const data = (await response.json()) as { status?: string };
      const status = AMAN_STATUS_MAP[data.status ?? ''] ?? 'failed';

      return {
        success: status === 'paid',
        status,
        transactionId,
      };
    } catch (err) {
      return {
        success: false,
        status: 'failed',
        errorCode: 'NETWORK_ERROR',
        errorMessage: err instanceof Error ? err.message : 'AMAN status check failed',
      };
    }
  }

  async refund(transactionId: string, amount: number): Promise<PaymentResult> {
    if (!this.config) {
      return { success: false, status: 'failed', errorCode: 'NOT_INITIALIZED', errorMessage: 'AMAN not initialized' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/payment/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantCode: this.config.merchantCode,
          apiKey: this.config.apiKey,
          referenceNumber: transactionId,
          refundAmount: amount,
        }),
      });

      const data = (await response.json()) as { code?: number; message?: string };
      return {
        success: data.code === 200,
        status: data.code === 200 ? 'refunded' : 'failed',
        transactionId,
        errorCode: data.code === 200 ? undefined : String(data.code),
        errorMessage: data.message,
      };
    } catch (err) {
      return {
        success: false,
        status: 'failed',
        errorCode: 'NETWORK_ERROR',
        errorMessage: err instanceof Error ? err.message : 'AMAN refund failed',
      };
    }
  }

  async verifyWebhook(payload: WebhookPayload): Promise<WebhookPayload | null> {
    if (!this.config) return null;

    // AMAN sends webhook with referenceNumber and status
    // In production, verify signature using shared secret
    if (!payload.transactionId) return null;

    const status = AMAN_STATUS_MAP[String(payload.metadata?.status)] ?? 'failed';
    return { ...payload, status };
  }
}
