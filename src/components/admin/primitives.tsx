import { type ComponentProps, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, ChevronRight, Search, UploadCloud, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { uploadImage } from '@/api/admin';
import { cn } from '@/lib/utils';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-night-50">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-night-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-night-800 bg-night-900">
      <table className="w-full min-w-[640px] text-start text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn('px-4 py-3 text-start text-xs font-bold uppercase tracking-wider text-night-500', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, ...props }: ComponentProps<'td'>) {
  return (
    <td className={cn('border-t border-night-800 px-4 py-3 align-middle text-night-200', className)} {...props}>
      {children}
    </td>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-night-500" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-64 ps-10" />
    </div>
  );
}

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-5 flex items-center justify-center gap-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
      </Button>
      <span className="text-sm font-bold text-night-300">
        {page} / {pages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
      </Button>
    </div>
  );
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  preparing: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  on_delivery: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
  refunded: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  complimentary: 'bg-gold-500/15 text-gold-400 border-gold-500/30',
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold capitalize',
        statusStyles[status] ?? 'border-night-700 text-night-400',
      )}
    >
      {t(`admin.status.${status}`)}
    </span>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  loading,
  confirmLabel,
  confirmVariant = 'primary',
  reason,
  onReasonChange,
  reasonLabel,
  reasonPlaceholder,
  reasonRequired = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'gold' | 'outline' | 'ghost';
  reason?: string;
  onReasonChange?: (v: string) => void;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
}) {
  const { t } = useTranslation();
  const canConfirm = !reasonRequired || (reason?.trim().length ?? 0) > 0;
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-night-300">{message}</p>
      {reasonLabel !== undefined ? (
        <div className="mt-4">
          <Label className="mb-1.5 text-xs font-bold uppercase tracking-wider text-night-500">{reasonLabel}</Label>
          <Textarea
            value={reason}
            onChange={(e) => onReasonChange?.(e.target.value)}
            placeholder={reasonPlaceholder}
            rows={3}
            error={reasonRequired && (reason?.trim().length ?? 0) === 0}
          />
        </div>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button variant={confirmVariant} size="sm" loading={loading} disabled={!canConfirm} onClick={onConfirm}>
          {confirmLabel ?? t('common.delete')}
        </Button>
      </div>
    </Modal>
  );
}

export function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-emerald-500' : 'bg-night-700',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-night-900',
      )}
    >
      <span
        className={cn(
          'inline-block h-4.5 w-4.5 transform rounded-full bg-night-50 shadow transition-transform',
          checked ? 'translate-x-5.5 rtl:-translate-x-5.5' : 'translate-x-1 rtl:-translate-x-1',
        )}
      />
    </button>
  );
}

export function ImageUpload({ value, onChange, label }: { value: string; onChange: (url: string) => void; label?: string }) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch {
      setError(t('admin.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {label ? <p className="mb-1.5 text-sm font-medium text-night-200">{label}</p> : null}
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-night-700">
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label={t('common.close')}
              className="absolute end-0 top-0 rounded-bl-lg bg-night-900/90 p-0.5 text-night-50 hover:bg-red-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-night-600 px-4 text-sm font-semibold text-night-300 transition-colors hover:border-brand-500 hover:text-brand-400">
          <UploadCloud className="h-4 w-4" />
          {uploading ? t('common.loading') : t('admin.upload')}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => void handleFile(e.target.files?.[0])} />
        </label>
      </div>
      {error ? <p className="mt-1 text-sm text-red-400">{error}</p> : null}
      {value ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
          <Check className="h-3.5 w-3.5" />
          {t('admin.uploaded')}
        </p>
      ) : null}
    </div>
  );
}
