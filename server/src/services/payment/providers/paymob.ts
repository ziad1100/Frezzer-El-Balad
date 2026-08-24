/**
 * Paymob Payment Gateway Adapter
 *
 * Implements the PaymentProvider interface for Paymob.
 * Based on Paymob Accept API documentation:
 * https://developers.paymob.com/paymob-docs
 *
 * Supported methods:
 * - Card payments (Visa, Mastercard, Amex, Meeza)
 * - Mobile wallets (Vodafone Cash, Orange Cash, e& money, We Pay)
 * - Apple Pay / Google Pay
 *
 * Requires:
 * - Paymob merchant account
 * - API Secret Key
 * - Integration IDs for each payment method
 * - Webhook endpoint configured in Paymob dashboard
 *
 * Sandbox: https://accept.paymob.com/ (test mode)
 */

import type { PaymentProvider, PaymentRequest, PaymentResult, WebhookPayload } from '../paymentAdapter';

export interface PaymobConfig {
  apiKey: string;
  integrationId: number;
  iframeId?: number;
  /** Webhook HMAC secret for verifying callbacks */
  webhookHmacSecret?: string;
  /** Success redirect URL */
  successUrl?: string;
  /** Cancel redirect URL */
  cancelUrl?: string;
}

type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'expired' | 'refunded';

/** Paymob API response for order creation. */
interface PaymobOrderResponse {
  id: number;
  token: string;
  redirect_url: string;
}

/** Paymob API response for payment key. */
interface PaymobKeyResponse {
  token: string;
}

const PAYMOB_API_BASE = 'https://accept.paymob.com/api';

export class PaymobPaymentProvider implements PaymentProvider {
  readonly id = 'paymob';
  readonly name = 'Paymob';
  readonly methods = ['card' as const, 'vodafone_cash' as const] as PaymentProvider['methods'];

  private config: PaymobConfig | null = null;

  async initialize(config: Record<string, unknown>): Promise<boolean> {
    const paymobConfig = config as unknown as PaymobConfig;
    if (!paymobConfig.apiKey || !paymobConfig.integrationId) {
      console.error('[payment:paymob] Missing apiKey or integrationId');
      return false;
    }
    this.config = paymobConfig;
    return true;
  }

  private async authenticate(): Promise<string> {
    if (!this.config) throw new Error('Paymob not initialized');
    const res = await fetch(`${PAYMOB_API_BASE}/auth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: this.config.apiKey }),
    });
    if (!res.ok) throw new Error(`Paymob auth failed: ${res.status}`);
    const data = (await res.json()) as { token: string };
    return data.token;
  }

  async charge(request: PaymentRequest): Promise<PaymentResult> {
    if (!this.config) {
      return { success: false, status: 'failed', errorCode: 'NOT_INITIALIZED', errorMessage: 'Paymob not initialized' };
    }

    try {
      // Step 1: Authenticate
      const authToken = await this.authenticate();

      // Step 2: Create order
      const orderRes = await fetch(`${PAYMOB_API_BASE}/ecommerce/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          auth_token: authToken,
          delivery_needed: false,
          amount_cents: Math.round(request.amount * 100), // Paymob uses cents
          currency: 'EGP',
          items: [{
            name: request.description ?? `Order ${request.orderNo}`,
            amount_cents: Math.round(request.amount * 100),
            description: request.description ?? `Order ${request.orderNo}`,
            quantity: 1,
          }],
        }),
      });

      if (!orderRes.ok) {
        const errData = (await orderRes.json()) as { message?: string };
        return {
          success: false,
          status: 'failed',
          errorCode: 'ORDER_CREATION_FAILED',
          errorMessage: errData.message ?? 'Failed to create Paymob order',
        };
      }

      const orderData = (await orderRes.json()) as PaymobOrderResponse;

      // Step 3: Get payment key
      const keyRes = await fetch(`${PAYMOB_API_BASE}/acceptance/payment_keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          auth_token: authToken,
          amount_cents: Math.round(request.amount * 100),
          expiration: 3600,
          order_id: orderData.id,
          billing_data: {
            apartment: 'NA',
            email: request.customerEmail ?? 'no@email.com',
            floor: 'NA',
            first_name: request.customerName?.split(' ')[0] ?? 'Customer',
            street: 'NA',
            building: 'NA',
            phone_number: request.customerPhone ?? '+200000000000',
            shipping_method: 'NA',
            postal_code: 'NA',
            city: 'Cairo',
            country: 'EG',
            last_name: request.customerName?.split(' ').slice(1).join(' ') ?? '',
            state: 'Cairo',
          },
          integration_id: this.config.integrationId,
        }),
      });

      if (!keyRes.ok) {
        return {
          success: false,
          status: 'failed',
          errorCode: 'PAYMENT_KEY_FAILED',
          errorMessage: 'Failed to generate payment key',
        };
      }

      const keyData = (await keyRes.json()) as PaymobKeyResponse;

      return {
        success: true,
        status: 'processing',
        transactionId: String(orderData.id),
        reference: orderData.token,
        redirectUrl: `https://accept.paymob.com/api/acceptance/iframes/${this.config.iframeId ?? 0}?payment_token=${keyData.token}`,
      };
    } catch (err) {
      return {
        success: false,
        status: 'failed',
        errorCode: 'NETWORK_ERROR',
        errorMessage: err instanceof Error ? err.message : 'Paymob API error',
      };
    }
  }

  async getStatus(transactionId: string): Promise<PaymentResult> {
    if (!this.config) {
      return { success: false, status: 'failed', errorCode: 'NOT_INITIALIZED', errorMessage: 'Paymob not initialized' };
    }

    try {
      const authToken = await this.authenticate();

      const res = await fetch(`${PAYMOB_API_BASE}/acceptance/transactions/${transactionId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!res.ok) {
        return { success: false, status: 'failed', errorCode: 'NOT_FOUND', errorMessage: 'Transaction not found' };
      }

      const data = (await res.json()) as { transaction_status?: string };
      const paymobStatus = data.transaction_status ?? '';
      const statusMap: Record<string, PaymentStatus> = {
        'AUTHORIZATION_SUCCESS': 'paid',
        'CAPTURED': 'paid',
        'PEND': 'processing',
        'AUTHORIZATION_INVALID': 'failed',
        'EXPIRED': 'expired',
        'CANCELLED': 'cancelled',
      };

      return {
        success: statusMap[paymobStatus] === 'paid',
        status: statusMap[paymobStatus] ?? 'failed',
        transactionId,
      };
    } catch (err) {
      return {
        success: false,
        status: 'failed',
        errorCode: 'NETWORK_ERROR',
        errorMessage: err instanceof Error ? err.message : 'Paymob status check failed',
      };
    }
  }

  async refund(transactionId: string, amount: number): Promise<PaymentResult> {
    if (!this.config) {
      return { success: false, status: 'failed', errorCode: 'NOT_INITIALIZED', errorMessage: 'Paymob not initialized' };
    }

    try {
      const authToken = await this.authenticate();

      const res = await fetch(`${PAYMOB_API_BASE}/acceptance/void_refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          auth_token: authToken,
          transaction_id: Number(transactionId),
          amount_cents: Math.round(amount * 100),
          refund: { amount_cents: Math.round(amount * 100) },
        }),
      });

      const data = (await res.json()) as { id?: number; message?: string };
      return {
        success: res.ok && Boolean(data.id),
        status: res.ok ? 'refunded' : 'failed',
        transactionId,
        errorCode: res.ok ? undefined : data.message,
        errorMessage: data.message,
      };
    } catch (err) {
      return {
        success: false,
        status: 'failed',
        errorCode: 'NETWORK_ERROR',
        errorMessage: err instanceof Error ? err.message : 'Paymob refund failed',
      };
    }
  }

  async verifyWebhook(payload: WebhookPayload): Promise<WebhookPayload | null> {
    if (!this.config) return null;

    // Paymob sends HMAC signature in headers for verification
    // In production, verify payload.signature against HMAC-SHA512
    if (this.config.webhookHmacSecret && payload.signature) {
      // TODO: Implement HMAC verification when webhook secret is configured
      // const expectedSignature = crypto.createHmac('sha512', this.config.webhookHmacSecret)
      //   .update(payload.rawBody).digest('hex');
      // if (payload.signature !== expectedSignature) return null;
    }

    if (!payload.transactionId) return null;

    // Determine status from metadata
    const metadata = payload.metadata as Record<string, unknown> | undefined;
    const paymobStatus = String(metadata?.transaction_status ?? '');
    const statusMap: Record<string, PaymentStatus> = {
      'AUTHORIZATION_SUCCESS': 'paid',
      'CAPTURED': 'paid',
      'PEND': 'processing',
      'AUTHORIZATION_INVALID': 'failed',
      'EXPIRED': 'expired',
      'CANCELLED': 'cancelled',
    };

    return {
      ...payload,
      status: (statusMap[paymobStatus] ?? payload.status) as PaymentStatus,
    };
  }
}
