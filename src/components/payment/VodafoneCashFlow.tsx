/**
 * Vodafone Cash Payment Flow
 *
 * Handles the complete Vodafone Cash payment process:
 * 1. Shows wallet number and transfer instructions
 * 2. Customer enters transfer details
 * 3. Optional proof upload
 * 4. Submits for admin verification
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, CheckCircle, AlertCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Label, FieldError, Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { submitManualPayment, type PaymentSettings } from '@/api/payment';
import { toast } from 'sonner';

interface VodafoneCashFlowProps {
  orderId: string;
  amount: number;
  settings: PaymentSettings['vodafoneCash'];
  onSuccess: () => void;
  onCancel: () => void;
}

export function VodafoneCashFlow({ orderId, amount, settings, onSuccess, onCancel }: VodafoneCashFlowProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';

  const [senderPhone, setSenderPhone] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [transferTime, setTransferTime] = useState('');
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!senderPhone.trim()) {
      newErrors.senderPhone = isAr ? 'من فضلك أدخل رقم الهاتف الذي تم التحويل منه' : 'Enter the phone number used for transfer';
    } else if (!/^01[0125]\d{8}$/.test(senderPhone.trim())) {
      newErrors.senderPhone = isAr ? 'رقم الهاتف غير صالح' : 'Invalid phone number';
    }

    if (!transactionRef.trim()) {
      newErrors.transactionRef = isAr ? 'من فضلك أدخل رقم العملية' : 'Enter the transaction number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(isAr ? 'نوع الملف غير مدعوم' : 'Unsupported file type');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isAr ? 'الملف كبير جداً (الحد الأقصى 5 ميجا)' : 'File too large (max 5MB)');
      return;
    }

    setProofFile(file);

    // Create preview for images
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
        paymentMethod: 'vodafone_cash',
        transactionReference: transactionRef.trim(),
        senderPhone: senderPhone.trim(),
        // Note: In a real app, we'd upload the proof to a file storage service
        // and pass the URL. For now, we pass the file name as a placeholder.
        proofUrl: proofFile ? proofFile.name : '',
        proofType: proofFile?.type ?? '',
      });

      setSubmitted(true);
      toast.success(isAr ? 'تم إرسال بيانات الدفع للمراجعة' : 'Payment details submitted for review');
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(isAr ? 'حدث خطأ أثناء إرسال بيانات الدفع' : 'Error submitting payment details');
      console.error('[VodafoneCash] submit error:', message);
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
          {isAr
            ? 'تم إرسال بيانات الدفع للمراجعة. سيتم تأكيد الدفع من الإدارة.'
            : 'Payment details submitted for review. The admin will verify your payment.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Wallet Number & Instructions */}
      <div className="rounded-2xl border border-[#E60000]/20 bg-gradient-to-br from-[#E60000]/10 via-[#E60000]/5 to-transparent p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E60000]/15">
            <Smartphone className="h-4 w-4 text-[#E60000]" />
          </span>
          <h4 className="text-sm font-bold text-[#E60000]">
            {isAr ? 'الخطوة 1: قم بالتحويل عبر Vodafone Cash' : 'Step 1: Transfer via Vodafone Cash'}
          </h4>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-[var(--tw-text-muted)]">
          {settings.instructions[isAr ? 'ar' : 'en'] ||
            (isAr ? 'قم بالتحويل إلى رقم المحفظة التالي' : 'Transfer to the following wallet number')}
        </p>
        {settings.walletNumber && (
          <div className="flex items-center justify-between rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--tw-text-muted)]">
              {isAr ? 'رقم المحفظة' : 'Wallet Number'}
            </span>
            <span className="font-mono text-lg font-bold text-[var(--tw-text)]" dir="ltr">
              {settings.walletNumber}
            </span>
          </div>
        )}
        <div className="mt-3 rounded-xl border border-gold-500/30 bg-gold-500/10 p-3">
          <p className="text-sm font-bold text-gold-400">
            {isAr ? 'المبلغ المطلوب:' : 'Amount to pay:'}{' '}
            <span className="text-lg">{amount.toLocaleString()} EGP</span>
          </p>
        </div>
      </div>

      {/* Transfer Details Form */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-[var(--tw-text)]">
          {isAr ? 'الخطوة 2: أدخل بيانات التحويل' : 'Step 2: Enter transfer details'}
        </h4>

        <div>
          <Label>{isAr ? 'رقم الهاتف الذي تم التحويل منه' : 'Phone number used for transfer'}</Label>
          <Input
            dir="ltr"
            inputMode="numeric"
            maxLength={11}
            value={senderPhone}
            onChange={(e) => setSenderPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
            error={Boolean(errors.senderPhone)}
          />
          <FieldError message={errors.senderPhone} />
        </div>

        <div>
          <Label>{isAr ? 'رقم العملية / رقم التحويل' : 'Transaction / Transfer number'}</Label>
          <Input
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            placeholder={isAr ? 'أدخل رقم العملية' : 'Enter transaction number'}
            error={Boolean(errors.transactionRef)}
          />
          <FieldError message={errors.transactionRef} />
        </div>

        <div>
          <Label>{isAr ? 'وقت التحويل (اختياري)' : 'Transfer time (optional)'}</Label>
          <Input
            type="datetime-local"
            value={transferTime}
            onChange={(e) => setTransferTime(e.target.value)}
          />
        </div>

        <div>
          <Label>{isAr ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</Label>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isAr ? 'أي ملاحظات إضافية' : 'Any additional notes'}
          />
        </div>
      </div>

      {/* Proof Upload */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-[var(--tw-text)]">
          {isAr ? 'الخطوة 3: إرفاق إثبات التحويل (اختياري)' : 'Step 3: Attach transfer proof (optional)'}
        </h4>

        <div className="flex items-center gap-3">
          <label className={cn(
            'flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--tw-border-strong)] px-4 py-3 text-sm text-[var(--tw-text-muted)] transition-colors hover:border-brand-500 hover:text-brand-400',
            proofFile && 'border-emerald-500/50 bg-emerald-500/5 text-emerald-400',
          )}>
            <Upload className="h-4 w-4" />
            {proofFile
              ? proofFile.name
              : isAr ? 'اختر صورة (JPG, PNG) أو PDF' : 'Choose image (JPG, PNG) or PDF'}
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleProofChange}
              className="sr-only"
            />
          </label>
        </div>

        {proofPreview && (
          <div className="mt-2">
            <img
              src={proofPreview}
              alt={isAr ? 'إثبات التحويل' : 'Transfer proof'}
              className="max-h-40 rounded-lg border border-[var(--tw-border-strong)] object-contain"
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          onClick={handleSubmit}
          loading={submitting}
          className="flex-1"
        >
          {submitting
            ? (isAr ? 'جاري الإرسال...' : 'Submitting...')
            : (isAr ? 'تم التحويل — إرسال الطلب' : 'Transferred — Submit Order')}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          {isAr ? 'إلغاء' : 'Cancel'}
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-xs text-amber-300">
          {isAr
            ? 'لن يُعتبر الدفع مكتملاً حتى يتم تأكيده من الإدارة. يمكنك تتبع حالة الطلب من صفحة الطلبات.'
            : 'Payment will not be considered complete until verified by the admin. You can track your order status from the orders page.'}
        </p>
      </div>
    </div>
  );
}
