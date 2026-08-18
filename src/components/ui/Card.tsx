import { type ComponentProps, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-2xl border border-night-800 bg-night-900', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5', className)} {...props} />;
}

type BadgeTone = 'brand' | 'gold' | 'success' | 'neutral';

const tones: Record<BadgeTone, string> = {
  brand: 'bg-brand-600/15 text-brand-400 border-brand-600/30',
  gold: 'bg-gold-500/15 text-gold-400 border-gold-500/30',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  neutral: 'bg-night-800 text-night-300 border-night-700',
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
  return <div className={cn('animate-pulse rounded-xl bg-night-800', className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="loading"
      className={cn('h-8 w-8 animate-spin rounded-full border-2 border-night-600 border-t-brand-500', className)}
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
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {icon ? <div className="text-night-500">{icon}</div> : null}
      <h3 className="text-lg font-bold text-night-100">{title}</h3>
      {hint ? <p className="max-w-sm text-sm text-night-400">{hint}</p> : null}
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
          <Button variant="gold" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : undefined
      }
    />
  );
}