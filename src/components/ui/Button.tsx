import { forwardRef, type ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'fresh' | 'gold' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-600/20',
  fresh: 'bg-fresh-500 text-white hover:bg-fresh-600 shadow-md shadow-fresh-500/20',
  gold: 'bg-fresh-500 text-white hover:bg-fresh-600 shadow-md shadow-fresh-500/20',
  outline: 'border border-[var(--tw-border-strong)] text-[var(--tw-text)] hover:border-brand-500/60 hover:text-brand-500',
  ghost: 'text-[var(--tw-text-muted)] hover:text-[var(--tw-text)] hover:bg-[var(--tw-hover)]',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-600/20',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-9 w-9',
};

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
