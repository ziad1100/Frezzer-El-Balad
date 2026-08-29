import { forwardRef, type ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'fresh' | 'gold' | 'outline' | 'ghost' | 'danger' | 'brand-soft' | 'fresh-soft';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-600/20 focus-visible:outline-brand-500',
  fresh: 'bg-fresh-500 text-white hover:bg-fresh-600 shadow-md shadow-fresh-500/20 focus-visible:outline-fresh-500',
  gold: 'bg-gold-500 text-white hover:bg-gold-600 shadow-md shadow-gold-500/20 focus-visible:outline-gold-500',
  outline: 'border border-[var(--tw-border-strong)] text-[var(--tw-text)] hover:border-brand-500/60 hover:text-brand-500 hover:bg-brand-500/5',
  ghost: 'text-[var(--tw-text-muted)] hover:text-[var(--tw-text)] hover:bg-[var(--tw-hover)]',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-600/20 focus-visible:outline-red-500',
  'brand-soft': 'bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 border border-brand-500/20',
  'fresh-soft': 'bg-fresh-500/10 text-fresh-500 hover:bg-fresh-500/20 border border-fresh-500/20',
};

const sizes: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-[11px] rounded-lg',
  sm: 'h-8 px-3 text-xs rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-6 text-base rounded-xl',
  xl: 'h-14 px-8 text-lg rounded-2xl',
  icon: 'h-9 w-9 rounded-xl',
};

const base =
  'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer';

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
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
