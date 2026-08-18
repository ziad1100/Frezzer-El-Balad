import { useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
}

export function OtpInput({ value, onChange, length = 6, error }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const digits = useMemo(() => Array.from({ length }, (_, i) => value[i] ?? ''), [value, length]);

  const focusAt = (index: number): void => {
    const el = refs.current[index];
    if (el) el.focus();
  };

  const update = (next: string): void => {
    onChange(next.replace(/\D/g, '').slice(0, length));
  };

  const handleChange = (index: number, raw: string): void => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = value.split('');
    next[index] = digit;
    update(next.join(''));
    if (digit && index < length - 1) focusAt(index + 1);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[index]) {
        const next = value.split('');
        next[index] = '';
        update(next.join(''));
      } else if (index > 0) {
        const next = value.split('');
        next[index - 1] = '';
        update(next.join(''));
        focusAt(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusAt(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted) {
      update(pasted);
      refs.current[Math.min(pasted.length, length - 1)]?.focus();
    }
  };

  return (
    <div className="flex justify-between gap-2" dir="ltr">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          aria-label={`otp digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={cn(
            'h-13 w-11 rounded-xl border bg-night-900 text-center text-xl font-bold text-night-100',
            'transition-colors focus:border-brand-500 focus:outline-none',
            error ? 'border-red-500' : 'border-night-700 hover:border-night-600',
          )}
        />
      ))}
    </div>
  );
}