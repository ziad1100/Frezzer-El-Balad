import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/images/orabiLogo.jpeg"
      alt="ORABI"
      loading="eager"
      className={cn('shrink-0 object-contain', className)}
    />
  );
}