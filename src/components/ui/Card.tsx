import { type ComponentProps, type ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

/* ── Card Variants ──────────────────────────────────────────────── */
type CardVariant = 'default' | 'elevated' | 'flat' | 'interactive';

const cardVariants: Record<CardVariant, string> = {
  default: 'rounded-2xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)]',
  elevated: 'rounded-2xl border border-[var(--tw-card-border)] bg-[var(--tw-surface-elevated)] shadow-lg shadow-black/5',
  flat: 'rounded-2xl bg-[var(--tw-surface-alt)]',
  interactive: 'rounded-2xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] transition-all duration-200 hover:border-[var(--tw-border-strong)] hover:shadow-lg hover:shadow-black/5',
};

export function Card({
  variant = 'default',
  className,
  ...props
}: ComponentProps<'div'> & { variant?: CardVariant }) {
  return (
    <div
      className={cn(cardVariants[variant], className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5', className)} {...props} />;
}

/* ── Badge ──────────────────────────────────────────────────────── */
type BadgeTone = 'brand' | 'fresh' | 'gold' | 'success' | 'neutral' | 'danger' | 'info' | 'warning';

const tones: Record<BadgeTone, string> = {
  brand: 'bg-brand-500/15 text-brand-500 border-brand-500/30',
  fresh: 'bg-fresh-500/15 text-fresh-500 border-fresh-500/30',
  gold: 'bg-gold-500/15 text-gold-500 border-gold-500/30',
  success: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  danger: 'bg-red-500/15 text-red-500 border-red-500/30',
  info: 'bg-ice-500/15 text-ice-500 border-ice-500/30',
  warning: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
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

/* ── Skeleton ────────────────────────────────────────────────────── */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-2xl bg-gradient-to-r from-[var(--tw-surface-alt)] via-[var(--tw-border)] to-[var(--tw-surface-alt)] bg-[length:200%_100%]',
        className,
      )}
      {...props}
    />
  );
}

/* ── Spinner ─────────────────────────────────────────────────────── */
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

/* ── LoadingState ────────────────────────────────────────────────── */
export function LoadingState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Spinner />
      {message && <p className="text-sm text-[var(--tw-text-muted)]">{message}</p>}
    </div>
  );
}

/* ── EmptyState ──────────────────────────────────────────────────── */
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
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--tw-surface-alt)] text-[var(--tw-text-subtle)]">
        {icon ?? <Inbox className="h-8 w-8" />}
      </div>
      <div>
        <h3 className="text-lg font-bold text-[var(--tw-text)]">{title}</h3>
        {hint && <p className="mt-1 max-w-sm text-sm text-[var(--tw-text-muted)]">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── ErrorState ──────────────────────────────────────────────────── */
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
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-[var(--tw-text)]">{title}</h3>
        {hint && <p className="mt-1 max-w-sm text-sm text-[var(--tw-text-muted)]">{hint}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          {retryLabel ?? 'Retry'}
        </Button>
      )}
    </div>
  );
}
