/**
 * Credit Card Payment Flow (Placeholder)
 *
 * This is a placeholder for future payment gateway integration.
 * It does NOT process real card payments.
 * It does NOT store or transmit card data.
 *
 * When a real payment gateway is configured, replace this component
 * with the provider's hosted checkout / secure tokenized elements.
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
  const lang = i18n.language;
  const isAr = lang === 'ar';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] p-4">
        <CreditCard className="h-8 w-8 text-brand-400" />
        <div>
          <h3 className="font-bold text-[var(--tw-text)]">
            {isAr ? 'الدفع ببطاقة ائتمان' : 'Credit Card Payment'}
          </h3>
          <p className="text-sm text-[var(--tw-text-muted)]">
            {isAr ? 'المبلغ:' : 'Amount:'} {amount.toLocaleString()} EGP
          </p>
        </div>
      </div>

      {/* Not Available Notice */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-400" />
        <h4 className="mb-2 font-bold text-amber-400">
          {isAr ? 'الدفع الإلكتروني غير متاح حالياً' : 'Online payment is not available yet'}
        </h4>
        <p className="mb-4 text-sm text-[var(--tw-text-muted)]">
          {isAr
            ? 'نعمل على تفعيل الدفع الإلكتروني قريباً. يمكنك استخدام طريقة الدفع عند الاستلام أو فودافون كاش.'
            : 'We are working on enabling online payments. You can use Cash on Delivery or Vodafone Cash.'}
        </p>
        <p className="mb-4 text-xs text-[var(--tw-text-muted)]">
          {isAr
            ? 'لا يتم تخزين أي بيانات بطاقة في نظامنا.'
            : 'No card data is stored in our system.'}
        </p>
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
