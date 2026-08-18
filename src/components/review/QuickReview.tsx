import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { createQuickReview } from '@/api/reviews';
import { useAppSelector } from '@/hooks';
import { StarRating } from '@/components/review/StarRating';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const MAX_COMMENT = 600;

interface QuickReviewProps {
  productId: string;
}

/**
 * Inline meal-card rating widget (5 stars + comment + submit). Logged-in
 * customers can rate any meal directly — the review is published instantly and
 * shows up in the admin Reviews dashboard. One quick review per user + meal.
 */
export function QuickReview({ productId }: QuickReviewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAppSelector((state) => state.auth.user);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [rejected, setRejected] = useState(false);

  const submit = useMutation({
    mutationFn: () => createQuickReview({ product: productId, rating, comment: comment.trim() }),
    onSuccess: () => {
      toast.success(t('review.submitted'));
      setDone(true);
      setRating(0);
      setComment('');
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['product'] });
      void queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        // Already reviewed in a previous session — show the honest message.
        setRejected(true);
        setDone(true);
        return;
      }
      setError(t('review.submitFailed'));
    },
  });

  if (done) {
    return rejected ? (
      <p className="border-t border-night-800 pt-3 text-xs font-semibold text-amber-400">
        {t('review.alreadyReviewed')}
      </p>
    ) : (
      <p className="flex items-center gap-1.5 border-t border-night-800 pt-3 text-xs font-semibold text-emerald-400">
        <Check className="h-3.5 w-3.5" />
        {t('review.published')}
      </p>
    );
  }

  if (!user) {
    return (
      <div className="border-t border-night-800 pt-3">
        <Link to="/login" className="text-xs font-semibold text-night-400 transition-colors hover:text-brand-500">
          {t('review.loginToRate')} ⭐
        </Link>
      </div>
    );
  }

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (rating < 1) {
      setError(t('review.ratingRequired'));
      return;
    }
    setError('');
    submit.mutate();
  };

  return (
    <form className="border-t border-night-800 pt-3" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-night-300">{t('review.rateThisMeal')}</span>
        <StarRating value={rating} onChange={setRating} size="sm" ariaLabel={t('review.rateThisMeal')} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Input
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
          placeholder={t('review.commentPlaceholder')}
          aria-label={t('review.yourReview')}
          className="h-9 flex-1 text-sm"
        />
        <Button
          type="submit"
          size="sm"
          variant="gold"
          loading={submit.isPending}
          disabled={rating < 1}
        >
          {t('review.submit')}
        </Button>
      </div>
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
    </form>
  );
}
