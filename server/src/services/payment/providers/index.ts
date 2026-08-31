/**
 * Payment Providers Index
 *
 * Exports all available payment providers.
 */

/**
 * Initialize and register all payment providers based on environment variables.
 * Call this once at server startup.
 */
export async function initializePaymentProviders(): Promise<void> {
  // Cash provider is always available (registered by default in paymentAdapter)
  console.log('[payment] Payment providers initialized (cash always available)');
}
