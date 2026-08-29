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
      {/* Background circle with gradient */}
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#logo-gradient)" />
      
      {/* Snowflake icon — representing frozen products */}
      <g transform="translate(50,44)" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Main axes */}
        <line x1="0" y1="-18" x2="0" y2="18" />
        <line x1="-15.6" y1="-9" x2="15.6" y2="9" />
        <line x1="-15.6" y1="9" x2="15.6" y2="-9" />
        {/* Tips — snowflake branches */}
        <line x1="-4" y1="-16" x2="0" y2="-20" />
        <line x1="4" y1="-16" x2="0" y2="-20" />
        <line x1="-4" y1="16" x2="0" y2="20" />
        <line x1="4" y1="16" x2="0" y2="20" />
        <line x1="-18" y1="-4" x2="-20" y2="0" />
        <line x1="-18" y1="4" x2="-20" y2="0" />
        <line x1="18" y1="-4" x2="20" y2="0" />
        <line x1="18" y1="4" x2="20" y2="0" />
        {/* Center dot */}
        <circle cx="0" cy="0" r="2" fill="#FFFFFF" stroke="none" />
      </g>
      
      {/* Brand text — Arabic name */}
      <text
        x="50"
        y="78"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="10"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        letterSpacing="0.5"
      >
        FREEZER EL BALAD
      </text>
    </svg>
  );
}
