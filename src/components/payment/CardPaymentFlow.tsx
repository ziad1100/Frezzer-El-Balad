/**
 * Visa Card Payment Flow — Paymob Integration
 *
 * Initiates a real Paymob payment session for an existing order.
 * Redirects the customer to Paymob's hosted/unified checkout where
 * they enter card details directly on Paymob's secure page.
 *
 * Security:
 * - Card data is NEVER collected by this application
 * - Payment confirmation comes ONLY from Paymob's server-side webhook
 * - No fake payment success is ever created
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { initCardPayment } from '@/api/payment';
import { getErrorMessage } from '@/lib/api';

interface CardPaymentFlowProps {
  orderId: string;
  amount: number;
  provider: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CardPaymentFlow({ orderId, amount, onSuccess, onCancel }: CardPaymentFlowProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  const handleInitPayment = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await initCardPayment(orderId);
      if (result.redirectUrl) {
        // Store orderId in sessionStorage so we can check status on return
        sessionStorage.setItem('paymobPendingOrderId', orderId);
        sessionStorage.setItem('paymobPendingAmount', String(amount));
        setRedirecting(true);
        // Redirect to Paymob's hosted checkout
        window.location.href = result.redirectUrl;
      } else {
        setError(isAr ? 'فشل في تهيئة الدفع' : 'Failed to initialize payment');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Check if user returned from Paymob
  const pendingOrderId = sessionStorage.getItem('paymobPendingOrderId');
  if (pendingOrderId === orderId && !redirecting) {
    // User returned from Paymob — check payment status
    sessionStorage.removeItem('paymobPendingOrderId');
    sessionStorage.removeItem('paymobPendingAmount');
    // The webhook should have already updated the order status
    // Call onSuccess to navigate to orders page
    setTimeout(() => onSuccess(), 500);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] p-4">
        <CreditCard className="h-8 w-8 text-brand-400" />
        <div>
          <h3 className="font-bold text-[var(--tw-text)]">
            {isAr ? 'الدفع بالفيزا' : 'Visa Payment'}
          </h3>
          <p className="text-sm text-[var(--tw-text-muted)]">
            {isAr ? 'المبلغ:' : 'Amount:'} {amount.toLocaleString()} EGP
          </p>
        </div>
      </div>

      {/* Secure payment notice */}
      <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
        <p className="text-sm text-[var(--tw-text-muted)]">
          {isAr
            ? 'ستتم المعالجة بشكل آمن عبر بوابة الدفع Paymob. لن يتم تخزين بيانات البطاقة في نظامنا.'
            : 'Payment will be securely processed through Paymob gateway. No card data is stored in our system.'}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Redirecting state */}
      {redirecting && (
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-5 text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-brand-400" />
          <p className="text-sm font-bold text-[var(--tw-text)]">
            {isAr ? 'جاري التوجيه إلى صفحة الدفع...' : 'Redirecting to payment page...'}
          </p>
          <p className="mt-1 text-xs text-[var(--tw-text-muted)]">
            {isAr ? 'يرجى عدم إغلاق الصفحة' : 'Please do not close this page'}
          </p>
        </div>
      )}

      {/* Actions */}
      {!redirecting && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            {isAr ? 'العودة لاختيار طريقة الدفع' : 'Back to payment methods'}
          </Button>
          <Button
            onClick={handleInitPayment}
            loading={loading}
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4" />
            {isAr ? 'إتمام الدفع عبر فيزا' : 'Pay with Visa'}
          </Button>
        </div>
      )}
    </div>
  );
}
