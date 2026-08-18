import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api';
import {
  createMealReview,
  createRestaurantReview,
  deleteReview,
  getOrderReviewState,
  getReview,
  updateReview,
  type ReviewUpdatePayload,
} from '@/api/reviews';
import type { Review } from '@/types';
import {
  RestaurantReviewForm,
  type RestaurantReviewFormValues,
} from '@/components/review/RestaurantReviewForm';
import { ReviewForm, type ReviewFormValues } from '@/components/review/ReviewForm';
import { StarRating } from '@/components/review/StarRating';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/admin/primitives';

interface RestaurantState {
  _id: string;
  rating: number;
  comment: string;
  foodQuality?: number | null;
  delivery?: number | null;
  packaging?: number | null;
  service?: number | null;
  overall?: number | null;
}

type DialogState =
  | { mode: 'meal-create'; product: { productId: string; name: string } }
  | { mode: 'meal-edit'; review: Review }
  | { mode: 'restaurant-create' }
  | { mode: 'restaurant-edit'; review: RestaurantState }
  | { mode: 'delete'; review: Review }
  | null;

export function OrderReviewPanel({ orderId, orderNo }: { orderId: string; orderNo: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogState>(null);

  const state = useQuery({
    queryKey: ['reviews', 'order', orderId],
    queryFn: () => getOrderReviewState(orderId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['reviews', 'order', orderId] });
    void queryClient.invalidateQueries({ queryKey: ['reviews', 'eligible'] });
    void queryClient.invalidateQueries({ queryKey: ['reviews', 'meal'] });
  };

  const mealCreate = useMutation({
    mutationFn: (values: ReviewFormValues) => {
      if (dialog?.mode !== 'meal-create') return Promise.reject(new Error('Missing review target'));
      return createMealReview({
        product: dialog.product.productId,
        orderId,
        rating: values.rating,
        comment: values.comment,
      });
    },
    onSuccess: () => {
      toast.success(t('review.submitted'));
      setDialog(null);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const restaurantCreate = useMutation({
    mutationFn: (values: RestaurantReviewFormValues) => createRestaurantReview({ orderId, ...values }),
    onSuccess: () => {
      toast.success(t('review.submitted'));
      setDialog(null);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const reviewEdit = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ReviewUpdatePayload }) => updateReview(id, values),
    onSuccess: () => {
      toast.success(t('review.updated'));
      setDialog(null);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteReview(id),
    onSuccess: () => {
      toast.success(t('review.deleted'));
      setDialog(null);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const openMealEdit = async (reviewId: string): Promise<void> => {
    try {
      const review = await getReview(reviewId);
      setDialog({ mode: 'meal-edit', review });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const openRestaurantEdit = (): void => {
    const r = state.data?.restaurant;
    if (!r) return;
    setDialog({
      mode: 'restaurant-edit',
      review: {
        _id: r._id,
        rating: r.rating,
        comment: r.comment,
        foodQuality: r.foodQuality,
        delivery: r.delivery,
        packaging: r.packaging,
        service: r.service,
        overall: r.overall,
      },
    });
  };

  const items = state.data?.items ?? [];
  const restaurant = state.data?.restaurant ?? null;

  return (
    <div className="mt-4 border-t border-night-800 pt-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-night-200">
        <ClipboardCheck className="h-4 w-4 text-gold-400" />
        {t('review.rateYourOrder')}
      </p>

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-night-800 bg-night-950/50 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                {item.images?.[0] ? (
                  <img src={item.images[0]} alt="" className="h-9 w-9 rounded-lg border border-night-700 object-cover" />
                ) : null}
                <span className="text-sm text-night-200">{item.itemName}</span>
              </div>
              {item.reviewId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <StarRating value={item.reviewRating ?? 0} readOnly size="sm" />
                  <Button variant="outline" size="sm" onClick={() => void openMealEdit(item.reviewId as string)}>
                    <Pencil className="h-3.5 w-3.5" />
                    {t('review.edit')}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setDialog({ mode: 'meal-create', product: { productId: item.productId, name: item.itemName } })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('review.reviewThisMeal')}
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-night-800 bg-night-950/50 px-3 py-2.5">
        <span className="text-sm text-night-200">{t('review.experienceTitle')}</span>
        {restaurant ? (
          <div className="flex flex-wrap items-center gap-2">
            <StarRating value={restaurant.rating} readOnly size="sm" />
            <Button variant="outline" size="sm" onClick={openRestaurantEdit}>
              <Pencil className="h-3.5 w-3.5" />
              {t('review.edit')}
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setDialog({ mode: 'restaurant-create' })}>
            <Plus className="h-3.5 w-3.5" />
            {t('review.rateYourExperience')}
          </Button>
        )}
      </div>

      <Modal open={dialog?.mode === 'meal-create'} onClose={() => setDialog(null)} title={t('review.writeTitle')}>
        <p className="mb-4 text-sm text-night-400">
          {orderNo} — {dialog?.mode === 'meal-create' ? dialog.product.name : ''}
        </p>
        <ReviewForm submitLabel={t('review.submit')} onSubmit={(values) => mealCreate.mutateAsync(values)} />
      </Modal>

      <Modal open={dialog?.mode === 'meal-edit'} onClose={() => setDialog(null)} title={t('review.editTitle')}>
        {dialog?.mode === 'meal-edit' ? (
          <>
            <ReviewForm
              submitLabel={t('review.save')}
              initialRating={dialog.review.rating}
              initialComment={dialog.review.comment}
              onSubmit={(values) => reviewEdit.mutateAsync({ id: dialog.review._id as string, values })}
              onCancel={() => setDialog(null)}
            />
            <div className="mt-4 border-t border-night-800 pt-4">
              <Button variant="ghost" className="text-red-400 hover:bg-red-500/10 hover:text-red-400" onClick={() => setDialog({ mode: 'delete', review: dialog.review as Review })}>
                <Trash2 className="h-4 w-4" />
                {t('review.delete')}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal open={dialog?.mode === 'restaurant-create'} onClose={() => setDialog(null)} title={t('review.rateYourExperience')}>
        <RestaurantReviewForm onSubmit={(values) => restaurantCreate.mutateAsync(values)} />
      </Modal>

      <Modal open={dialog?.mode === 'restaurant-edit'} onClose={() => setDialog(null)} title={t('review.editTitle')}>
        {dialog?.mode === 'restaurant-edit' ? (
          <RestaurantReviewForm
            initial={{
              rating: dialog.review.rating,
              comment: dialog.review.comment,
              foodQuality: dialog.review.foodQuality ?? undefined,
              delivery: dialog.review.delivery ?? undefined,
              packaging: dialog.review.packaging ?? undefined,
              service: dialog.review.service ?? undefined,
              overall: dialog.review.overall ?? undefined,
            }}
            onSubmit={(values) =>
              reviewEdit.mutateAsync({
                id: dialog.review._id as string,
                values: {
                  rating: values.rating,
                  comment: values.comment,
                  foodQuality: values.foodQuality,
                  delivery: values.delivery,
                  packaging: values.packaging,
                  service: values.service,
                  overall: values.overall,
                },
              })
            }
            onCancel={() => setDialog(null)}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={dialog?.mode === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={() => dialog?.mode === 'delete' && remove.mutate(dialog.review._id as string)}
        title={t('review.deleteTitle')}
        message={t('review.confirmDelete')}
        loading={remove.isPending}
      />
    </div>
  );
}