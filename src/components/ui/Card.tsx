import { type ComponentProps, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)]', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-4', className)} {...props} />;
}

type BadgeTone = 'brand' | 'fresh' | 'gold' | 'success' | 'neutral';

const tones: Record<BadgeTone, string> = {
  brand: 'bg-brand-500/15 text-brand-500 border-brand-500/30',
  fresh: 'bg-fresh-500/15 text-fresh-500 border-fresh-500/30',
  gold: 'bg-fresh-500/15 text-fresh-500 border-fresh-500/30',
  success: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  neutral: 'bg-[var(--tw-surface-alt)] text-[var(--tw-text-muted)] border-[var(--tw-border)]',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-xl bg-[var(--tw-surface-alt)]', className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="loading"
      className={cn(
        'h-7 w-7 animate-spin rounded-full border-2 border-[var(--tw-border-strong)] border-t-brand-500',
        className,
      )}
    />
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      {icon ? <div className="text-[var(--tw-text-muted)]">{icon}</div> : null}
      <h3 className="text-lg font-bold text-[var(--tw-text)]">{title}</h3>
      {hint ? <p className="max-w-sm text-sm text-[var(--tw-text-muted)]">{hint}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  hint,
  onRetry,
  retryLabel,
}: {
  title: string;
  hint?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <EmptyState
      icon={<AlertTriangle className="h-14 w-14" />}
      title={title}
      hint={hint}
      action={
        onRetry ? (
          <Button variant="fresh" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : undefined
      }
    />
  );
}
