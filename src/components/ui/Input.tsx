import { forwardRef, useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InputProps extends ComponentProps<'input'> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-xl border bg-night-900 px-4 text-base text-night-100 placeholder:text-night-500',
        'transition-colors focus:border-brand-500 focus:outline-none',
        error ? 'border-red-500' : 'border-night-700 hover:border-night-600',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          className={cn('pe-10', className)}
          {...props}
          type={visible ? 'text' : 'password'}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 end-3 flex items-center text-night-400 hover:text-night-200"
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';

export interface TextareaProps extends ComponentProps<'textarea'> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-xl border bg-night-900 px-4 py-3 text-base text-night-100 placeholder:text-night-500',
        'transition-colors focus:border-brand-500 focus:outline-none',
        error ? 'border-red-500' : 'border-night-700 hover:border-night-600',
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = 'Textarea';

export interface SelectProps extends ComponentProps<'select'> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-11 w-full appearance-none rounded-xl border bg-night-900 px-4 text-base text-night-100',
        'transition-colors focus:border-brand-500 focus:outline-none',
        error ? 'border-red-500' : 'border-night-700 hover:border-night-600',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);

Select.displayName = 'Select';

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-400">{message}</p>;
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      className={cn('mb-1.5 block text-sm font-medium text-night-200', className)}
      {...props}
    />
  );
}