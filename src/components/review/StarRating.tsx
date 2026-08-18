import { useState, type KeyboardEvent } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const sizes = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const;

const labels = ['1', '2', '3', '4', '5'];

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: keyof typeof sizes;
  readOnly?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function StarRating({ value, onChange, size = 'md', readOnly = false, ariaLabel, className }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const shown = readOnly || !onChange ? value : hover || value;

  const setRating = (v: number): void => {
    if (readOnly || !onChange) return;
    setHover(0);
    onChange(v);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (readOnly || !onChange) return;
    const max = 5;
    let next = value;
    if (e.key === 'ArrowRight') next = Math.min(max, value + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(1, value - 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
    else if (e.key === 'Home') next = 1;
    else if (e.key === 'End') next = max;
    else return;
    e.preventDefault();
    onChange(next);
  };

  const interactive = !readOnly && Boolean(onChange);

  return (
    <div
      dir="ltr"
      role={interactive ? 'radiogroup' : undefined}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn('inline-flex items-center gap-0.5', interactive && 'outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-brand-500', className)}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const active = shown >= i;
        return (
          <span
            key={i}
            role="radio"
            aria-checked={interactive ? value === i : undefined}
            aria-label={`${labels[i - 1]} star${i > 1 ? 's' : ''}`}
            tabIndex={interactive && value === 0 && i === 1 ? 0 : interactive && value === i ? 0 : interactive ? -1 : undefined}
            // Prevent the un-focusable stars being tab stops when interactive: only the selected star is reachable.
            onClick={() => setRating(i)}
            onKeyDown={(e) => {
              if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setRating(i);
              }
            }}
            onMouseEnter={interactive ? () => setHover(i) : undefined}
            onMouseLeave={interactive ? () => setHover(0) : undefined}
            onTouchStart={interactive ? () => setHover(i) : undefined}
            className={cn(
              'transition-colors',
              interactive && 'cursor-pointer',
              active ? 'fill-gold-400 text-gold-400' : 'fill-transparent text-night-600',
            )}
          >
            <Star className={sizes[size]} strokeWidth={1.5} />
          </span>
        );
      })}
    </div>
  );
}