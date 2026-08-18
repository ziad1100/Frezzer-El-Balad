import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 object-contain', className)}
      aria-label="فريزر البلد"
    >
      {/* Background circle */}
      <circle cx="50" cy="50" r="48" fill="#1E3A5F" />
      
      {/* Snowflake icon */}
      <g transform="translate(50,50)" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round">
        {/* Vertical line */}
        <line x1="0" y1="-20" x2="0" y2="20" />
        {/* Diagonal lines */}
        <line x1="-17.3" y1="-10" x2="17.3" y2="10" />
        <line x1="-17.3" y1="10" x2="17.3" y2="-10" />
        {/* Snowflake tips */}
        <line x1="-5" y1="-18" x2="0" y2="-22" />
        <line x1="5" y1="-18" x2="0" y2="-22" />
        <line x1="-5" y1="18" x2="0" y2="22" />
        <line x1="5" y1="18" x2="0" y2="22" />
        <line x1="-20" y1="-5" x2="-22" y2="0" />
        <line x1="-20" y1="5" x2="-22" y2="0" />
        <line x1="20" y1="-5" x2="22" y2="0" />
        <line x1="20" y1="5" x2="22" y2="0" />
      </g>
      
      {/* Brand text */}
      <text
        x="50"
        y="78"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="10"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
      >
        FREEZER
      </text>
    </svg>
  );
}