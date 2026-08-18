import { useTranslation } from 'react-i18next';
import { BadgeCheck, Pencil, Trash2 } from 'lucide-react';
import type { Review } from '@/types';
import { StarRating } from '@/components/review/StarRating';
import { Button } from '@/components/ui/Button';

interface ReviewCardProps {
  review: Review;
  canEdit?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ReviewCard({ review, canEdit = false, onEdit, onDelete }: ReviewCardProps) {
  const { t, i18n } = useTranslation();
  const author = typeof review.user === 'object' ? review.user : null;
  const fullName = author?.fullName || t('review.anonymous');
  const initial = fullName.trim().charAt(0).toUpperCase() || '?';
  const date = new Date(review.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <article className="rounded-2xl border border-night-800 bg-night-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {author?.avatar ? (
            <img src={author.avatar} alt="" className="h-10 w-10 rounded-full border border-night-700 object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600/20 text-sm font-bold text-brand-400">
              {initial}
            </span>
          )}
          <div>
            <p className="flex items-center gap-2 font-semibold text-night-100">
              {fullName}
              {review.isVerifiedPurchase ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {t('review.verifiedPurchase')}
                </span>
              ) : null}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <StarRating value={review.rating} readOnly size="sm" />
              <span className="text-xs text-night-500">{date}</span>
            </div>
          </div>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit} className="text-xs">
              <Pencil className="h-3.5 w-3.5" />
              {t('review.edit')}
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label={t('review.delete')} className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-400">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
      {review.comment ? <p className="mt-3 whitespace-pre-wrap leading-relaxed text-night-300">{review.comment}</p> : null}
    </article>
  );
}