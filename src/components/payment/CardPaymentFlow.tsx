/**
 * Card Payment Flow — Placeholder
 *
 * Card payment is not currently available.
 * Shows an unavailable message and allows the user to go back.
 */

import { useTranslation } from 'react-i18next';
import { CreditCard, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface CardPaymentFlowProps {
  orderId: string;
  amount: number;
  provider: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CardPaymentFlow({ amount, onCancel }: CardPaymentFlowProps) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

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

      {/* Unavailable notice */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <p className="text-sm text-amber-400">
            {isAr
              ? 'الدفع الإلكتروني غير متاح حالياً. يرجى استخدام طريقة دفع أخرى.'
              : 'Electronic payment is not available at the moment. Please use another payment method.'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          {isAr ? 'العودة لاختيار طريقة الدفع' : 'Back to payment methods'}
        </Button>
      </div>
    </div>
  );
}
