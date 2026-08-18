import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MessageSquareQuote, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api';
import {
  createMealReview,
  deleteReview,
  getEligibleOrders,
  listMealReviews,
  updateReview,
} from '@/api/reviews';
import { useAppSelector } from '@/hooks';
import type { Review } from '@/types';
import { QuickReview } from '@/components/review/QuickReview';
import { RatingSummary } from '@/components/review/RatingSummary';
import { ReviewCard } from '@/components/review/ReviewCard';
import { ReviewForm, type ReviewFormValues } from '@/components/review/ReviewForm';
import { Button } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Card';
import { Label, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/admin/primitives';

type DialogState =
  | { mode: 'create' }
  | { mode: 'edit'; review: Review }
  | { mode: 'delete'; review: Review }
  | null;

export function ReviewsSection({ productId, productName }: { productId: string; productName: string }) {
  const { t } = useTranslation();
  const user = useAppSelector((s) => s.auth.user);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedOrder, setSelectedOrder] = useState('');

  const reviews = useQuery({
    queryKey: ['reviews', 'meal', productId, { page }],
    queryFn: () => listMealReviews(productId, { page, limit: 5 }),
  });

  const eligible = useQuery({
    queryKey: ['reviews', 'eligible', productId],
    queryFn: () => getEligibleOrders(productId),
    enabled: user !== null,
  });

  const eligibleOrders = useMemo(() => eligible.data ?? [], [eligible.data]);

  const invalidateAll = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['reviews', 'meal', productId] });
    void queryClient.invalidateQueries({ queryKey: ['reviews', 'eligible', productId] });
    void queryClient.invalidateQueries({ queryKey: ['product'] });
  };

  const createMutation = useMutation({
    mutationFn: (values: ReviewFormValues) =>
      createMealReview({ product: productId, orderId: selectedOrder, rating: values.rating, comment: values.comment }),
    onSuccess: () => {
      toast.success(t('review.submitted'));
      setDialog(null);
      invalidateAll();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ReviewFormValues }) => updateReview(id, values),
    onSuccess: () => {
      toast.success(t('review.updated'));
      setDialog(null);
      invalidateAll();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReview(id),
    onSuccess: () => {
      toast.success(t('review.deleted'));
      setDialog(null);
      invalidateAll();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const items = reviews.data?.items ?? [];
  const pages = reviews.data?.pages ?? 1;
  const summary = reviews.data?.summary;

  const openCreate = (): void => {
    if (!eligibleOrders.length) return;
    setSelectedOrder(eligibleOrders[0]._id);
    setDialog({ mode: 'create' });
  };

  const canReview = user !== null && eligibleOrders.length > 0;
  const dataError = createMutation.isError || updateMutation.isError || deleteMutation.isError;

  return (
    <section className="mt-14">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold text-night-50">{t('review.title')}</h2>
        {user ? (
          canReview ? (
            <Button variant="gold" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('review.addReview')}
            </Button>
          ) : (
            <p className="text-sm text-night-500">{t('review.noEligibleOrders')}</p>
          )
        ) : (
          <Button variant="outline" onClick={() => setDialog({ mode: 'create' })}>
            {t('review.writeLogin')}
          </Button>
        )}
      </div>

      {dataError ? (
        <p className="mb-4 text-sm text-red-400">{t('review.submitFailed')}</p>
      ) : null}

      {/* Instant 5-star + comment rating — lives on the meal page, not the cards. */}
      <div className="mb-6">
        <QuickReview productId={productId} />
      </div>

      {summary ? <RatingSummary summary={summary} className="mb-6" /> : null}

      {reviews.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <>
          <h3 className="mb-3 text-lg font-extrabold text-night-100">{t('review.previousReviews')}</h3>
          <div className="space-y-3">
            {items.map((r) => (
              <ReviewCard
                key={r._id}
                review={r}
                canEdit={user !== null && (typeof r.user === 'object' ? r.user._id === user.id : false)}
                onEdit={() => setDialog({ mode: 'edit', review: r })}
                onDelete={() => setDialog({ mode: 'delete', review: r })}
              />
            ))}
          </div>
          {pages > 1 ? (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <span className="text-sm font-bold text-night-300">
                {page} / {pages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={<MessageSquareQuote className="h-14 w-14" />}
          title={t('review.noReviews')}
          hint={t('review.noReviewsHint')}
        />
      )}

      <Modal open={dialog?.mode === 'create'} onClose={() => setDialog(null)} title={t('review.writeTitle')}>
        <p className="mb-4 text-sm text-night-400">{productName}</p>
        {user ? (
          eligibleOrders.length > 0 ? (
            <>
              <div className="mb-4">
                <Label htmlFor="review-order">{t('review.order')}</Label>
                <Select id="review-order" value={selectedOrder} onChange={(e) => setSelectedOrder(e.target.value)}>
                  {eligibleOrders.map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.orderNo} — {new Date(o.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </Select>
              </div>
              <ReviewForm
                submitLabel={t('review.submit')}
                onSubmit={(values) => createMutation.mutateAsync(values)}
              />
            </>
          ) : (
            <p className="text-sm text-night-400">{t('review.noEligibleOrders')}</p>
          )
        ) : (
          <div className="flex justify-end">
            <Link to="/login">
              <Button variant="gold">{t('auth.login')}</Button>
            </Link>
          </div>
        )}
      </Modal>

      <Modal open={dialog?.mode === 'edit'} onClose={() => setDialog(null)} title={t('review.editTitle')}>
        {dialog?.mode === 'edit' ? (
          <ReviewForm
            submitLabel={t('review.save')}
            initialRating={dialog.review.rating}
            initialComment={dialog.review.comment}
            onSubmit={(values) => updateMutation.mutateAsync({ id: dialog.review._id as string, values })}
            onCancel={() => setDialog(null)}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={dialog?.mode === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={() => dialog?.mode === 'delete' && deleteMutation.mutate(dialog.review._id as string)}
        title={t('review.deleteTitle')}
        message={t('review.confirmDelete')}
        loading={deleteMutation.isPending}
      />
    </section>
  );
}