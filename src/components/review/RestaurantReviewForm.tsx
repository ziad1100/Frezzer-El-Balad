import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { StarRating } from '@/components/review/StarRating';
import { Button } from '@/components/ui/Button';
import { Label, Textarea, FieldError } from '@/components/ui/Input';

const MAX_COMMENT = 600;

export interface RestaurantReviewFormValues {
  rating: number;
  comment: string;
  foodQuality?: number;
  delivery?: number;
  packaging?: number;
  service?: number;
  overall?: number;
}

interface RestaurantReviewFormProps {
  onSubmit: (values: RestaurantReviewFormValues) => Promise<unknown>;
  onCancel?: () => void;
  initial?: Partial<RestaurantReviewFormValues>;
}

interface CategoryRow {
  key: 'foodQuality' | 'delivery' | 'packaging' | 'service' | 'overall';
  labelKey: 'foodQuality' | 'delivery' | 'packaging' | 'service' | 'overall';
}

const CATEGORIES: CategoryRow[] = [
  { key: 'foodQuality', labelKey: 'foodQuality' },
  { key: 'delivery', labelKey: 'delivery' },
  { key: 'packaging', labelKey: 'packaging' },
  { key: 'service', labelKey: 'service' },
  { key: 'overall', labelKey: 'overall' },
];

export function RestaurantReviewForm({ onSubmit, onCancel, initial = {} }: RestaurantReviewFormProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(initial.rating ?? 0);
  const [comment, setComment] = useState(initial.comment ?? '');
  const [categories, setCategories] = useState<Record<string, number>>(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c.key, initial[c.key] ?? 0])),
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setCategory = (key: string, value: number): void => {
    setCategories((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (rating < 1) {
      setError(t('review.ratingRequired'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({
        rating,
        comment: comment.trim(),
        foodQuality: categories.foodQuality || undefined,
        delivery: categories.delivery || undefined,
        packaging: categories.packaging || undefined,
        service: categories.service || undefined,
        overall: categories.overall || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      <div>
        <Label className="mb-2">{t('review.experienceTitle')}</Label>
        <StarRating value={rating} onChange={setRating} size="lg" ariaLabel={t('review.experienceTitle')} />
        {error ? <FieldError message={error} /> : null}
        <p className="mt-2 text-xs text-night-500">{t('review.categoriesOptional')}</p>
      </div>
      <div className="mt-4 space-y-2.5">
        {CATEGORIES.map((c) => (
          <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-night-800 bg-night-950/50 px-3 py-2">
            <span className="text-sm text-night-200">{t(`review.${c.labelKey}`)}</span>
            <StarRating value={categories[c.key]} onChange={(v) => setCategory(c.key, v)} size="sm" ariaLabel={t(`review.${c.labelKey}`)} />
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Label htmlFor="experience-comment">{t('review.yourReview')}</Label>
        <Textarea
          id="experience-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
          placeholder={t('review.commentPlaceholder')}
          rows={3}
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
          {t('review.submit')}
        </Button>
      </div>
    </form>
  );
}