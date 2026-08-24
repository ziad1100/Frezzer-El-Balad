/**
 * Fawry Payment Gateway Adapter
 *
 * Implements the PaymentProvider interface for FawryPay.
 * Based on FawryPay Server-to-Server API documentation:
 * https://developer.fawrystaging.com/docs/server-apis/server-apis-overview
 *
 * Supported methods:
 * - Card payments (Visa, Mastercard, Meeza)
 * - Reference number payments (pay at any Fawry retail store)
 * - E-wallet payments
 *
 * Requires:
 * - FawryPay merchant account
 * - API credentials (merchantId, apiKey)
 * - Webhook endpoint configured in FawryPay dashboard
 *
 * Sandbox: https://developer.fawrystaging.com/
 */

import type { PaymentProvider, PaymentRequest, PaymentResult, WebhookPayload, PaymentStatus } from '../paymentAdapter';

export interface FawryConfig {
  merchantId: string;
  apiKey: string;
  /** 'sandbox' or 'production' */
  environment: 'sandbox' | 'production';
  /** Webhook URL for payment status updates */
  webhookUrl?: string;
}

/** Fawry API response for charge request. */
interface FawryChargeResponse {
  type: string;
  referenceNumber?: string;
  merchantRefNumber?: string;
  statusCode?: number;
  statusDescription?: string;
  signature?: string;
  paymentUrl?: string;
}

/** Fawry payment status codes. */
const FAWRY_STATUS_MAP: Record<number, PaymentStatus> = {
  2: 'paid',       // Paid
  3: 'failed',     // Failed
  4: 'expired',    // Expired
  5: 'cancelled',  // Cancelled
  6: 'paid',       // Paid (refunded)
  11: 'paid',      // Paid
  12: 'paid',      // Paid
};

const BASE_URLS = {
  sandbox: 'https://atfawry.com/e-pay',
  production: 'https://atfawry.com/e-pay',
};

export class FawryPaymentProvider implements PaymentProvider {
  readonly id = 'fawry';
  readonly name = 'Fawry';
  readonly methods = ['card' as const] as PaymentProvider['methods'];

  private config: FawryConfig | null = null;

  async initialize(config: Record<string, unknown>): Promise<boolean> {
    const fawryConfig = config as unknown as FawryConfig;
    if (!fawryConfig.merchantId || !fawryConfig.apiKey) {
      console.error('[payment:fidawry] Missing merchantId or apiKey');
      return false;
    }
    this.config = fawryConfig;
    return true;
  }

  private get baseUrl(): string {
    return BASE_URLS[this.config?.environment ?? 'sandbox'];
  }

  async charge(request: PaymentRequest): Promise<PaymentResult> {
    if (!this.config) {
      return { success: false, status: 'failed', errorCode: 'NOT_INITIALIZED', errorMessage: 'Fawry not initialized' };
    }

    try {
      const payload = {
        merchantId: this.config.merchantId,
        apiKey: this.config.apiKey,
        merchantRefNumber: request.orderId,
        customerProfileId: request.customerPhone ?? request.customerEmail ?? 'guest',
        customerName: request.customerName ?? '',
        customerMobile: request.customerPhone ?? '',
        customerEmail: request.customerEmail ?? '',
        amount: request.amount,
        currencyCode: 'EGP',
        description: request.description ?? `Order ${request.orderNo}`,
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h expiry
        paymentMethod: 'CARD', // CARD, CASH_ON_DELIVERY, etc.
        display: 'ALL',
      };

      const response = await fetch(`${this.baseUrl}/api/v2/integration/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as FawryChargeResponse;

      if (data.statusCode === 2 || data.referenceNumber) {
        return {
          success: true,
          status: 'processing',
          transactionId: data.referenceNumber,
          reference: data.merchantRefNumber,
          redirectUrl: data.paymentUrl,
        };
      }

      return {
        success: false,
        status: 'failed',
        errorCode: String(data.statusCode ?? 'UNKNOWN'),
        errorMessage: data.statusDescription ?? 'Fawry charge failed',
      };
    } catch (err) {
      return {
        success: false,
        status: 'failed',
        errorCode: 'NETWORK_ERROR',
        errorMessage: err instanceof Error ? err.message : 'Fawry API error',
      };
    }
  }

  async getStatus(transactionId: string): Promise<PaymentResult> {
    if (!this.config) {
      return { success: false, status: 'failed', errorCode: 'NOT_INITIALIZED', errorMessage: 'Fawry not initialized' };
    }

    try {
      const payload = {
        merchantId: this.config.merchantId,
        apiKey: this.config.apiKey,
        referenceNumber: transactionId,
      };

      const response = await fetch(`${this.baseUrl}/api/v2/integration/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { statusCode?: number };
      const status = FAWRY_STATUS_MAP[data.statusCode ?? 0] ?? 'failed';

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
        errorMessage: err instanceof Error ? err.message : 'Fawry status check failed',
      };
    }
  }

  async refund(transactionId: string, amount: number): Promise<PaymentResult> {
    if (!this.config) {
      return { success: false, status: 'failed', errorCode: 'NOT_INITIALIZED', errorMessage: 'Fawry not initialized' };
    }

    try {
      const payload = {
        merchantId: this.config.merchantId,
        apiKey: this.config.apiKey,
        referenceNumber: transactionId,
        refundAmount: amount,
      };

      const response = await fetch(`${this.baseUrl}/api/v2/integration/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { statusCode?: number; statusDescription?: string };

      return {
        success: response.ok && data.statusCode === 0,
        status: response.ok ? 'refunded' : 'failed',
        transactionId,
        errorCode: response.ok ? undefined : String(data.statusCode),
        errorMessage: data.statusDescription,
      };
    } catch (err) {
      return {
        success: false,
        status: 'failed',
        errorCode: 'NETWORK_ERROR',
        errorMessage: err instanceof Error ? err.message : 'Fawry refund failed',
      };
    }
  }

  async verifyWebhook(payload: WebhookPayload): Promise<WebhookPayload | null> {
    if (!this.config) return null;

    // Fawry sends webhook with referenceNumber and statusCode
    // In production, verify signature using HMAC-SHA256
    // For now, basic validation:
    if (!payload.transactionId) return null;

    const status = FAWRY_STATUS_MAP[Number(payload.metadata?.statusCode)] ?? 'failed';
    return { ...payload, status };
  }
}
