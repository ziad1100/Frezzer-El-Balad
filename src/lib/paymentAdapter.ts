/**
 * Payment Adapter Architecture
 *
 * Provides a clean abstraction layer for payment providers.
 * Each provider (Fawry, Aman, Paymob, etc.) implements the PaymentProvider interface.
 * The CheckoutPage uses PaymentManager to delegate payment processing.
 *
 * Currently: Cash-only (no gateway integration).
 * Future: Each new provider only needs to implement PaymentProvider.
 */

// ── Payment States ──────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'pending'      // Order created, payment not yet attempted
  | 'processing'   // Payment request sent to gateway, awaiting confirmation
  | 'paid'         // Payment confirmed by gateway
  | 'failed'       // Payment attempt failed
  | 'cancelled'    // User or system cancelled the payment
  | 'expired'      // Payment window expired (e.g., OTP timeout)
  | 'refunded';    // Payment was refunded

export type PaymentMethod = 'cash' | 'card' | 'vodafone_cash' | 'fawry' | 'aman' | 'paymob' | 'other';

// ── Payment Result ──────────────────────────────────────────────────────────

export interface PaymentResult {
  success: boolean;
  status: PaymentStatus;
  transactionId?: string;
  reference?: string;
  redirectUrl?: string;   // For gateways that redirect (e.g., Fawry web)
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

// ── Payment Request ─────────────────────────────────────────────────────────

export interface PaymentRequest {
  orderId: string;
  orderNo: string;
  amount: number;          // Amount in EGP (minor units if gateway requires)
  currency: string;        // 'EGP'
  method: PaymentMethod;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// ── Webhook Payload ─────────────────────────────────────────────────────────

export interface WebhookPayload {
  provider: string;
  transactionId: string;
  orderId?: string;
  status: PaymentStatus;
  amount?: number;
  rawBody: string;
  signature?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

// ── Payment Provider Interface ──────────────────────────────────────────────

export interface PaymentProvider {
  readonly id: string;
  readonly name: string;
  readonly methods: PaymentMethod[];

  /** Initialize the provider with credentials (called once). */
  initialize(config: Record<string, unknown>): Promise<boolean>;

  /** Create a payment charge / initiate a transaction. */
  charge(request: PaymentRequest): Promise<PaymentResult>;

  /** Check the status of a previous transaction. */
  getStatus(transactionId: string): Promise<PaymentResult>;

  /** Refund a previous payment. */
  refund(transactionId: string, amount: number): Promise<PaymentResult>;

  /** Verify and parse an incoming webhook. Returns null if signature is invalid. */
  verifyWebhook(payload: WebhookPayload): Promise<WebhookPayload | null>;
}

// ── Payment Manager ─────────────────────────────────────────────────────────

/**
 * Central payment orchestrator. Routes payment requests to the correct provider.
 * In cash mode, returns immediately without any gateway call.
 */
export class PaymentManager {
  private providers = new Map<string, PaymentProvider>();

  /** Register a payment provider. */
  registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.id, provider);
  }

  /** Get a provider by ID. */
  getProvider(id: string): PaymentProvider | undefined {
    return this.providers.get(id);
  }

  /** List all registered providers. */
  getAvailableProviders(): Array<{ id: string; name: string; methods: PaymentMethod[] }> {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      methods: p.methods,
    }));
  }

  /** Process a payment through the appropriate provider. */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Cash: no gateway interaction needed
    if (request.method === 'cash') {
      return {
        success: true,
        status: 'paid',
        transactionId: `CASH-${request.orderId}`,
        reference: `cash-${Date.now()}`,
      };
    }

    // Find provider that supports this method
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

  /** Handle an incoming webhook from a payment provider. */
  async handleWebhook(payload: WebhookPayload): Promise<WebhookPayload | null> {
    const provider = this.providers.get(payload.provider);
    if (!provider) {
      console.warn(`[payment] Unknown webhook provider: ${payload.provider}`);
      return null;
    }
    return provider.verifyWebhook(payload);
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const paymentManager = new PaymentManager();

// ── Cash Provider (always available) ────────────────────────────────────────

/**
 * Cash payment provider — handles cash-on-delivery.
 * No gateway integration needed. Always succeeds immediately.
 */
export const CashProvider: PaymentProvider = {
  id: 'cash',
  name: 'Cash on Delivery',
  methods: ['cash'],

  async initialize(): Promise<boolean> {
    return true; // Always ready
  },

  async charge(request: PaymentRequest): Promise<PaymentResult> {
    return {
      success: true,
      status: 'paid',
      transactionId: `CASH-${request.orderId}`,
      reference: `cash-${Date.now()}`,
    };
  },

  async getStatus(transactionId: string): Promise<PaymentResult> {
    return {
      success: true,
      status: 'paid',
      transactionId,
    };
  },

  async refund(): Promise<PaymentResult> {
    return {
      success: false,
      status: 'failed',
      errorCode: 'NOT_SUPPORTED',
      errorMessage: 'Cash payments cannot be refunded through the gateway',
    };
  },

  async verifyWebhook(): Promise<WebhookPayload | null> {
    return null; // Cash has no webhooks
  },
};

// Register cash provider by default
paymentManager.registerProvider(CashProvider);

// ── Helper: Validate payment status transitions ─────────────────────────────

const VALID_PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['processing', 'paid', 'failed', 'cancelled', 'expired'],
  processing: ['paid', 'failed', 'cancelled', 'expired'],
  paid: ['refunded'],
  failed: ['pending', 'processing'], // Can retry
  cancelled: ['pending'],            // Can restart
  expired: ['pending'],              // Can restart
  refunded: [],                      // Terminal
};

/**
 * Check if a payment status transition is valid.
 * Prevents inconsistent state changes.
 */
export function isValidPaymentTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return VALID_PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get human-readable label for a payment status.
 */
export function getPaymentStatusLabel(status: PaymentStatus, lang: 'ar' | 'en'): string {
  const labels: Record<PaymentStatus, { ar: string; en: string }> = {
    pending: { ar: 'قيد الانتظار', en: 'Pending' },
    processing: { ar: 'جارٍ المعالجة', en: 'Processing' },
    paid: { ar: 'مدفوع', en: 'Paid' },
    failed: { ar: 'فشل', en: 'Failed' },
    cancelled: { ar: 'ملغي', en: 'Cancelled' },
    expired: { ar: 'منتهي الصلاحية', en: 'Expired' },
    refunded: { ar: 'مسترد', en: 'Refunded' },
  };
  return labels[status]?.[lang] ?? status;
}
