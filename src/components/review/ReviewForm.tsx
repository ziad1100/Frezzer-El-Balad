import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { StarRating } from '@/components/review/StarRating';
import { Button } from '@/components/ui/Button';
import { Label, Textarea, FieldError } from '@/components/ui/Input';

const MAX_COMMENT = 600;

export interface ReviewFormValues {
  rating: number;
  comment: string;
}

interface ReviewFormProps {
  submitLabel: string;
  onSubmit: (values: ReviewFormValues) => Promise<unknown>;
  onCancel?: () => void;
  initialRating?: number;
  initialComment?: string;
}

export function ReviewForm({ submitLabel, onSubmit, onCancel, initialRating = 0, initialComment = '' }: ReviewFormProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (rating < 1) {
      setError(t('review.ratingRequired'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ rating, comment: comment.trim() });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      <div>
        <Label className="mb-2">{t('review.rateThisMeal')}</Label>
        <StarRating value={rating} onChange={setRating} size="lg" ariaLabel={t('review.rateThisMeal')} />
        {error ? <FieldError message={error} /> : null}
      </div>
      <div className="mt-4">
        <Label htmlFor="review-comment">{t('review.yourReview')}</Label>
        <Textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
          placeholder={t('review.commentPlaceholder')}
          rows={4}
        />
        <div className="mt-1 flex items-center justify-between">
          <FieldError message={comment.length >= MAX_COMMENT ? t('review.commentTooLong') : undefined} />
          <span className="ms-auto text-xs text-night-500" dir="ltr">
            {comment.length}/{MAX_COMMENT}
          </span>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {t('common.cancel')}
          </Button>
        ) : null}
        <Button type="submit" variant="gold" loading={submitting} disabled={rating < 1}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}