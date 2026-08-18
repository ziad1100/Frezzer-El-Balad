import { useTranslation } from 'react-i18next';
import type { ReviewSummary } from '@/types';
import { StarRating } from '@/components/review/StarRating';
import { cn } from '@/lib/utils';

export function RatingSummary({ summary, className }: { summary: ReviewSummary; className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex flex-col gap-6 rounded-2xl border border-night-800 bg-night-900 p-6 sm:flex-row sm:items-center', className)}>
      <div className="flex flex-col items-center gap-2 text-center sm:w-44 sm:shrink-0">
        <span className="text-5xl font-extrabold text-night-50" dir="ltr">
          {summary.average.toFixed(1)}
        </span>
        <StarRating value={Math.round(summary.average)} readOnly size="md" ariaLabel={t('review.averageRating')} />
        <span className="text-sm text-night-400">{t('review.basedOn', { count: summary.total })}</span>
      </div>
      <div className="flex-1 space-y-2">
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = summary[String(stars) as '5' | '4' | '3' | '2' | '1'];
          const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
          return (
            <div key={stars} className="flex items-center gap-3 text-sm">
              <span className="w-10 shrink-0 text-night-300" dir="ltr">
                {stars} ★
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-night-800">
                <div className="h-full rounded-full bg-gold-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 shrink-0 text-end text-xs text-night-500" dir="ltr">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}