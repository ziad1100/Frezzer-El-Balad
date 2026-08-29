import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  iconBg?: string;
  className?: string;
}

export function StatCard({ icon, label, value, subtitle, trend, iconBg, className }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] p-5 transition-all duration-200 hover:shadow-md hover:shadow-black/5',
      className,
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          <span className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            iconBg ?? 'bg-brand-500/10 text-brand-500',
          )}>
            {icon}
          </span>
          <div>
            <p className="text-xs font-medium text-[var(--tw-text-muted)]">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-[var(--tw-text)]">{value}</p>
          </div>
        </div>
        {trend && (
          <span className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold',
            trend.isPositive ? 'bg-fresh-500/10 text-fresh-500' : 'bg-red-500/10 text-red-500',
          )}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-2 text-xs text-[var(--tw-text-muted)]">{subtitle}</p>
      )}
    </div>
  );
}
