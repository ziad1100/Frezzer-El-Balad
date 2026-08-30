/**
 * InstaPay Payment Flow
 *
 * Handles the complete InstaPay payment process:
 * 1. Shows merchant InstaPay details (account name, IPA)
 * 2. Customer enters transfer reference
 * 3. Optional proof upload
 * 4. Submits for admin verification
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, CheckCircle, AlertCircle, Zap, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Label, FieldError, Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { submitManualPayment, type PaymentSettings } from '@/api/payment';
import { toast } from 'sonner';

interface InstaPayFlowProps {
  orderId: string;
  amount: number;
  settings: PaymentSettings['instapay'];
  onSuccess: () => void;
  onCancel: () => void;
}

export function InstaPayFlow({ orderId, amount, settings, onSuccess, onCancel }: InstaPayFlowProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';

  const [transactionRef, setTransactionRef] = useState('');
  const [senderName, setSenderName] = useState('');
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!transactionRef.trim()) {
      newErrors.transactionRef = isAr ? 'من فضلك أدخل رقم المرجع' : 'Enter the transaction reference';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success(isAr ? 'تم النسخ' : 'Copied');
      setTimeout(() => setCopied(false), 2000);
    });
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
        paymentMethod: 'instapay',
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
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
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

  const accountName = settings.accountName || '';
  const instructions = settings.instructions?.[isAr ? 'ar' : 'en'] || '';

  return (
    <div className="space-y-5">
      {/* Step 1: Transfer Instructions */}
      <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-600/10 via-brand-500/5 to-transparent p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20">
            <Zap className="h-4 w-4 text-brand-400" />
          </span>
          <h4 className="text-sm font-bold text-brand-400">
            {isAr ? 'الخطوة 1: قم بالتحويل عبر InstaPay' : 'Step 1: Transfer via InstaPay'}
          </h4>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-[var(--tw-text-muted)]">
          {instructions || (isAr
            ? 'قم بالتحويل إلى بيانات الحساب الموضحة أدناه عبر تطبيق InstaPay'
            : 'Transfer to the account details below using the InstaPay app')}
        </p>

        {/* Account Details */}
        <div className="space-y-2">
          {accountName && (
            <div className="flex items-center justify-between rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--tw-text-muted)]">
                {isAr ? 'اسم الحساب / المستفيد' : 'Account Name / Beneficiary'}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--tw-text)]">{accountName}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(accountName)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-brand-400"
                  title={isAr ? 'نسخ' : 'Copy'}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="mt-3 rounded-xl border border-gold-500/30 bg-gold-500/10 p-3">
          <p className="text-sm font-bold text-gold-400">
            {isAr ? 'المبلغ المطلوب:' : 'Amount to pay:'}{' '}
            <span className="text-lg">{amount.toLocaleString()} EGP</span>
          </p>
        </div>
      </div>

      {/* Step 2: Transfer Instructions */}
      <div className="rounded-2xl border border-[var(--tw-border)] bg-[var(--tw-surface-alt)] p-4">
        <h4 className="mb-3 text-sm font-bold text-[var(--tw-text)]">
          {isAr ? 'كيفية التحويل' : 'How to Transfer'}
        </h4>
        <ol className="space-y-2 text-sm text-[var(--tw-text-muted)]">
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[10px] font-bold text-brand-400">1</span>
            {isAr ? 'افتح تطبيق InstaPay' : 'Open the InstaPay app'}
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[10px] font-bold text-brand-400">2</span>
            {isAr ? 'اختر "تحويل فوري"' : 'Select "Instant Transfer"'}
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[10px] font-bold text-brand-400">3</span>
            {isAr ? 'قم بالتحويل إلى الحساب الموضح أعلاه' : 'Transfer to the account shown above'}
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[10px] font-bold text-brand-400">4</span>
            {isAr ? 'تأكد أن قيمة التحويل تساوي إجمالي الطلب' : 'Ensure the transfer amount matches the order total'}
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[10px] font-bold text-brand-400">5</span>
            {isAr ? 'أدخل رقم المرجع أدناه وأكمل تسجيل الطلب' : 'Enter the reference number below and complete the order'}
          </li>
        </ol>
      </div>

      {/* Step 2: Transfer Details Form */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-[var(--tw-text)]">
          {isAr ? 'الخطوة 2: أدخل بيانات التحويل' : 'Step 2: Enter transfer details'}
        </h4>

        <div>
          <Label>{isAr ? 'رقم المرجع / التحويل' : 'Transaction / Transfer Reference'}</Label>
          <Input
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            placeholder={isAr ? 'أدخل رقم المرجع من InstaPay' : 'Enter reference number from InstaPay'}
            error={Boolean(errors.transactionRef)}
          />
          <FieldError message={errors.transactionRef} />
        </div>

        <div>
          <Label>{isAr ? 'اسم المحول (اختياري)' : 'Sender name (optional)'}</Label>
          <Input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder={isAr ? 'اسمك كما يظهر في التطبيق' : 'Your name as shown in the app'}
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

      {/* Step 3: Proof Upload */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-[var(--tw-text)]">
          {isAr ? 'الخطوة 3: إرفاق إثبات التحويل (اختياري)' : 'Step 3: Attach transfer proof (optional)'}
        </h4>
        <label className={cn(
          'flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[var(--tw-border-strong)] px-4 py-3 text-sm text-[var(--tw-text-muted)] transition-colors hover:border-brand-500 hover:text-brand-400',
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
        {proofPreview && (
          <img
            src={proofPreview}
            alt={isAr ? 'إثبات التحويل' : 'Transfer proof'}
            className="max-h-40 rounded-xl border border-[var(--tw-border-strong)] object-contain"
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button onClick={handleSubmit} loading={submitting} className="flex-1" size="lg">
          {submitting
            ? (isAr ? 'جاري الإرسال...' : 'Submitting...')
            : (isAr ? 'تم التحويل — إرسال الطلب' : 'Transferred — Submit Order')}
        </Button>
        <Button variant="outline" onClick={onCancel} size="lg">
          {isAr ? 'إلغاء' : 'Cancel'}
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-xs leading-relaxed text-amber-300">
          {isAr
            ? 'لن يُعتبر الدفع مكتملاً حتى يتم تأكيده من الإدارة. يمكنك تتبع حالة الطلب من صفحة الطلبات.'
            : 'Payment will not be considered complete until verified by the admin. You can track your order status from the orders page.'}
        </p>
      </div>
    </div>
  );
}
