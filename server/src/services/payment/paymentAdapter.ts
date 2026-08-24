/**
 * Server-side Payment Adapter Architecture
 *
 * Mirrors the frontend payment adapter for server-side payment processing.
 * Used by the order controller and webhook handlers.
 *
 * Currently: Cash-only.
 * Future: Each provider implements PaymentProvider.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'refunded';

export type PaymentMethod = 'cash' | 'card' | 'vodafone_cash' | 'fawry' | 'aman' | 'paymob' | 'other';

export interface PaymentResult {
  success: boolean;
  status: PaymentStatus;
  transactionId?: string;
  reference?: string;
  redirectUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface PaymentRequest {
  orderId: string;
  orderNo: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
}

export interface WebhookPayload {
  provider: string;
  transactionId: string;
  orderId?: string;
  status: PaymentStatus;
  amount?: number;
  rawBody: string;
  signature?: string;
  metadata?: Record<string, unknown>;
}

// ── Provider Interface ──────────────────────────────────────────────────────

export interface PaymentProvider {
  readonly id: string;
  readonly name: string;
  readonly methods: PaymentMethod[];
  initialize(config: Record<string, unknown>): Promise<boolean>;
  charge(request: PaymentRequest): Promise<PaymentResult>;
  getStatus(transactionId: string): Promise<PaymentResult>;
  refund(transactionId: string, amount: number): Promise<PaymentResult>;
  verifyWebhook(payload: WebhookPayload): Promise<WebhookPayload | null>;
}

// ── Payment Manager ─────────────────────────────────────────────────────────

export class PaymentManager {
  private providers = new Map<string, PaymentProvider>();

  registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): PaymentProvider | undefined {
    return this.providers.get(id);
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    if (request.method === 'cash') {
      return {
        success: true,
        status: 'paid',
        transactionId: `CASH-${request.orderId}`,
        reference: `cash-${Date.now()}`,
      };
    }

    const provider = Array.from(this.providers.values()).find(
      (p) => p.methods.includes(request.method),
    );

    if (!provider) {
      return {
        success: false,
        status: 'failed',
        errorCode: 'NO_PROVIDER',
        errorMessage: `No payment provider configured for method: ${request.method}`,
      };
    }

    try {
      return await provider.charge(request);
    } catch (err) {
      return {
        success: false,
        status: 'failed',
        errorCode: 'PROVIDER_ERROR',
        errorMessage: err instanceof Error ? err.message : 'Payment provider error',
      };
    }
  }

  async handleWebhook(payload: WebhookPayload): Promise<WebhookPayload | null> {
    const provider = this.providers.get(payload.provider);
    if (!provider) return null;
    return provider.verifyWebhook(payload);
  }
}

export const paymentManager = new PaymentManager();

// ── Cash Provider ───────────────────────────────────────────────────────────

export const CashProvider: PaymentProvider = {
  id: 'cash',
  name: 'Cash on Delivery',
  methods: ['cash'],
  async initialize(): Promise<boolean> { return true; },
  async charge(request: PaymentRequest): Promise<PaymentResult> {
    return {
      success: true,
      status: 'paid',
      transactionId: `CASH-${request.orderId}`,
      reference: `cash-${Date.now()}`,
    };
  },
  async getStatus(transactionId: string): Promise<PaymentResult> {
    return { success: true, status: 'paid', transactionId };
  },
  async refund(): Promise<PaymentResult> {
    return { success: false, status: 'failed', errorCode: 'NOT_SUPPORTED', errorMessage: 'Cash cannot be refunded via gateway' };
  },
  async verifyWebhook(): Promise<WebhookPayload | null> { return null; },
};

paymentManager.registerProvider(CashProvider);

// ── Payment Status Transitions ──────────────────────────────────────────────

const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['processing', 'paid', 'failed', 'cancelled', 'expired'],
  processing: ['paid', 'failed', 'cancelled', 'expired'],
  paid: ['refunded'],
  failed: ['pending', 'processing'],
  cancelled: ['pending'],
  expired: ['pending'],
  refunded: [],
};

export function isValidPaymentTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
