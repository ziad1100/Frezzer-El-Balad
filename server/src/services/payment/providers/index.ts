/**
 * Payment Providers Index
 *
 * Exports all available payment providers.
 * Each provider can be initialized with credentials from environment variables.
 *
 * To enable a provider, set the corresponding environment variables:
 * - FAWRY_MERCHANT_ID, FAWRY_API_KEY, FAWRY_ENVIRONMENT
 * - PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID, PAYMOB_IFRAME_ID, PAYMOB_WEBHOOK_HMAC
 * - AMAN_MERCHANT_CODE, AMAN_API_KEY, AMAN_ENVIRONMENT
 */

import { paymentManager } from '../paymentAdapter';
import { FawryPaymentProvider } from './fawry';
import { PaymobPaymentProvider } from './paymob';
import { AmanPaymentProvider } from './aman';

export { FawryPaymentProvider } from './fawry';
export { PaymobPaymentProvider } from './paymob';
export { AmanPaymentProvider } from './aman';

/**
 * Initialize and register all payment providers based on environment variables.
 * Call this once at server startup.
 */
export async function initializePaymentProviders(): Promise<void> {
  // Fawry
  if (process.env.FAWRY_MERCHANT_ID && process.env.FAWRY_API_KEY) {
    const fawry = new FawryPaymentProvider();
    const ok = await fawry.initialize({
      merchantId: process.env.FAWRY_MERCHANT_ID,
      apiKey: process.env.FAWRY_API_KEY,
      environment: process.env.FAWRY_ENVIRONMENT ?? 'sandbox',
    });
    if (ok) {
      paymentManager.registerProvider(fawry);
      console.log('[payment] Fawry provider registered');
    } else {
      console.warn('[payment] Fawry provider failed to initialize');
    }
  }

  // Paymob
  if (process.env.PAYMOB_API_KEY && process.env.PAYMOB_INTEGRATION_ID) {
    const paymob = new PaymobPaymentProvider();
    const ok = await paymob.initialize({
      apiKey: process.env.PAYMOB_API_KEY,
      integrationId: Number(process.env.PAYMOB_INTEGRATION_ID),
      iframeId: process.env.PAYMOB_IFRAME_ID ? Number(process.env.PAYMOB_IFRAME_ID) : undefined,
      webhookHmacSecret: process.env.PAYMOB_WEBHOOK_HMAC,
      successUrl: process.env.PAYMOB_SUCCESS_URL,
      cancelUrl: process.env.PAYMOB_CANCEL_URL,
    });
    if (ok) {
      paymentManager.registerProvider(paymob);
      console.log('[payment] Paymob provider registered');
    } else {
      console.warn('[payment] Paymob provider failed to initialize');
    }
  }

  // AMAN
  if (process.env.AMAN_MERCHANT_CODE && process.env.AMAN_API_KEY) {
    const aman = new AmanPaymentProvider();
    const ok = await aman.initialize({
      merchantCode: process.env.AMAN_MERCHANT_CODE,
      apiKey: process.env.AMAN_API_KEY,
      environment: process.env.AMAN_ENVIRONMENT ?? 'sandbox',
    });
    if (ok) {
      paymentManager.registerProvider(aman);
      console.log('[payment] AMAN provider registered');
    } else {
      console.warn('[payment] AMAN provider failed to initialize');
    }
  }

  // Log registered providers
  console.log('[payment] Payment providers initialized (cash always available)');
}
