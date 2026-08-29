/**
 * Bank Transfer Payment Flow
 *
 * Similar to Vodafone Cash but for bank transfers.
 * Customer transfers to bank account and submits proof.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, CheckCircle, AlertCircle, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Label, FieldError, Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { submitManualPayment, type PaymentSettings } from '@/api/payment';
import { toast } from 'sonner';

interface BankTransferFlowProps {
  orderId: string;
  amount: number;
  settings: PaymentSettings['bankTransfer'];
  onSuccess: () => void;
  onCancel: () => void;
}

export function BankTransferFlow({ orderId, amount, settings, onSuccess, onCancel }: BankTransferFlowProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';

  const [senderName, setSenderName] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!transactionRef.trim()) {
      newErrors.transactionRef = isAr ? 'من فضلك أدخل رقم المرجع' : 'Enter the reference number';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(isAr ? 'نوع الملف غير مدعوم' : 'Unsupported file type');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isAr ? 'الملف كبير جداً (الحد الأقصى 5 ميجا)' : 'File too large (max 5MB)');
      return;
    }
    setProofFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setProofPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setProofPreview(null);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await submitManualPayment({
        orderId,
        paymentMethod: 'bank_transfer',
        transactionReference: transactionRef.trim(),
        senderName: senderName.trim(),
        proofUrl: proofFile ? proofFile.name : '',
        proofType: proofFile?.type ?? '',
      });
      setSubmitted(true);
      toast.success(isAr ? 'تم إرسال بيانات الدفع للمراجعة' : 'Payment details submitted for review');
      onSuccess();
    } catch {
      toast.error(isAr ? 'حدث خطأ أثناء إرسال بيانات الدفع' : 'Error submitting payment details');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <CheckCircle className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
        <h3 className="mb-2 text-lg font-bold text-emerald-400">
          {isAr ? 'تم الإرسال بنجاح' : 'Submitted Successfully'}
        </h3>
        <p className="text-sm text-[var(--tw-text-muted)]">
          {isAr ? 'تم إرسال بيانات الدفع للمراجعة.' : 'Payment details submitted for review.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Bank Account Info */}
      <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-brand-400" />
          <h4 className="text-sm font-bold text-brand-400">
            {isAr ? 'معلومات الحساب البنكي' : 'Bank Account Details'}
          </h4>
        </div>
        <div className="space-y-2 text-sm">
          {settings.bankName && (
            <div className="flex justify-between">
              <span className="text-[var(--tw-text-muted)]">{isAr ? 'البنك' : 'Bank'}:</span>
              <span className="font-bold text-[var(--tw-text)]">{settings.bankName}</span>
            </div>
          )}
          {settings.accountNumber && (
            <div className="flex justify-between">
              <span className="text-[var(--tw-text-muted)]">{isAr ? 'رقم الحساب' : 'Account Number'}:</span>
              <span className="font-mono font-bold text-[var(--tw-text)]" dir="ltr">{settings.accountNumber}</span>
            </div>
          )}
          {settings.accountName && (
            <div className="flex justify-between">
              <span className="text-[var(--tw-text-muted)]">{isAr ? 'اسم الحساب' : 'Account Name'}:</span>
              <span className="font-bold text-[var(--tw-text)]">{settings.accountName}</span>
            </div>
          )}
        </div>
        <div className="mt-3 rounded-lg border border-gold-500/30 bg-gold-500/10 p-3">
          <p className="text-sm font-bold text-gold-400">
            {isAr ? 'المبلغ المطلوب:' : 'Amount:'} {amount.toLocaleString()} EGP
          </p>
        </div>
      </div>

      {/* Transfer Details */}
      <div className="space-y-4">
        <div>
          <Label>{isAr ? 'اسم المحول (اختياري)' : 'Sender name (optional)'}</Label>
          <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} />
        </div>
        <div>
          <Label>{isAr ? 'رقم المرجع / التحويل' : 'Reference / Transfer number'}</Label>
          <Input
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            placeholder={isAr ? 'أدخل رقم المرجع' : 'Enter reference number'}
            error={Boolean(errors.transactionRef)}
          />
          <FieldError message={errors.transactionRef} />
        </div>
        <div>
          <Label>{isAr ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      {/* Proof Upload */}
      <div>
        <Label>{isAr ? 'إرفاق إثبات التحويل (اختياري)' : 'Attach transfer proof (optional)'}</Label>
        <label className={cn(
          'mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--tw-border-strong)] px-4 py-3 text-sm text-[var(--tw-text-muted)] transition-colors hover:border-brand-500',
          proofFile && 'border-emerald-500/50 bg-emerald-500/5 text-emerald-400',
        )}>
          <Upload className="h-4 w-4" />
          {proofFile ? proofFile.name : isAr ? 'اختر ملف' : 'Choose file'}
          <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleProofChange} className="sr-only" />
        </label>
        {proofPreview && (
          <img src={proofPreview} alt="Proof" className="mt-2 max-h-32 rounded-lg border border-[var(--tw-border-strong)]" />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSubmit} loading={submitting} className="flex-1">
          {submitting ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'تم التحويل — إرسال' : 'Transferred — Submit')}
        </Button>
        <Button variant="outline" onClick={onCancel}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-xs text-amber-300">
          {isAr ? 'لن يُعتبر الدفع مكتملاً حتى يتم تأكيده من الإدارة.' : 'Payment not considered complete until verified by admin.'}
        </p>
      </div>
    </div>
  );
}
