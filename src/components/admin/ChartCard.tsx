import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
}

export function ChartCard({ title, subtitle, action, children, className, loading, empty, emptyMessage }: ChartCardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)]',
      className,
    )}>
      <div className="flex items-center justify-between border-b border-[var(--tw-card-border)] px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--tw-text)]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--tw-text-muted)]">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : empty ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <p className="text-sm text-[var(--tw-text-muted)]">{emptyMessage ?? 'لا توجد بيانات لهذه الفترة'}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
