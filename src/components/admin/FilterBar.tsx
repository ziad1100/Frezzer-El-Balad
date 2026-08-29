import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PeriodKey = 'today' | 'week' | 'month' | 'custom';

interface FilterBarProps {
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  customStart?: string;
  customEnd?: string;
  onCustomStartChange?: (v: string) => void;
  onCustomEndChange?: (v: string) => void;
  children?: ReactNode;
  className?: string;
}

const periodLabels: Record<PeriodKey, { ar: string; en: string }> = {
  today: { ar: 'اليوم', en: 'Today' },
  week: { ar: 'هذا الأسبوع', en: 'This Week' },
  month: { ar: 'هذا الشهر', en: 'This Month' },
  custom: { ar: 'مخصص', en: 'Custom' },
};

export function FilterBar({
  period,
  onPeriodChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  children,
  className,
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <div className="inline-flex rounded-xl border border-[var(--tw-border)] bg-[var(--tw-surface-alt)] p-0.5">
        {(['today', 'week', 'month', 'custom'] as PeriodKey[]).map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-200',
              period === p
                ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/20'
                : 'text-[var(--tw-text-muted)] hover:text-[var(--tw-text)]',
            )}
          >
            {periodLabels[p].ar}
          </button>
        ))}
      </div>
      {period === 'custom' && onCustomStartChange && onCustomEndChange && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart ?? ''}
            onChange={(e) => onCustomStartChange(e.target.value)}
            className="h-9 rounded-xl border border-[var(--tw-input-border)] bg-[var(--tw-input-bg)] px-3 text-xs text-[var(--tw-text)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
          <span className="text-[var(--tw-text-subtle)]">—</span>
          <input
            type="date"
            value={customEnd ?? ''}
            onChange={(e) => onCustomEndChange(e.target.value)}
            className="h-9 rounded-xl border border-[var(--tw-input-border)] bg-[var(--tw-input-bg)] px-3 text-xs text-[var(--tw-text)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
      )}
      {children}
    </div>
  );
}
