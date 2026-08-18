import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Ban, Eye, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminListProducts, adminListReviews, adminModerateReview, adminReviewStats, deleteReview } from '@/api/admin';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Card';
import {
  ConfirmDialog,
  PageHeader,
  Pagination,
  SearchBox,
  TableWrap,
  Td,
  Th,
} from '@/components/admin/primitives';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/review/StarRating';
import type { AdminReviewStats, Review, ReviewStatus } from '@/types';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

export function AdminReviewsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [rating, setRating] = useState('');
  const [type, setType] = useState('');
  const [meal, setMeal] = useState('');
  const [verified, setVerified] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const reviews = useQuery({
    queryKey: ['admin', 'reviews', { page, q: search, status, rating, type, meal, verified, sort }],
    queryFn: () => adminListReviews({ page, limit: 10, q: search, status, rating, type, product: meal, verified, sort }),
  });

  const meals = useQuery({
    queryKey: ['admin', 'products', 'review-filter'],
    queryFn: async () => {
      const [a, b] = await Promise.all([
        adminListProducts({ page: 1, limit: 50 }),
        adminListProducts({ page: 2, limit: 50 }),
      ]);
      return [...a.items, ...b.items];
    },
  });

  const stats = useQuery({ queryKey: ['admin', 'reviews', 'stats'], queryFn: adminReviewStats });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  };

  const moderateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) => adminModerateReview(id, status),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const [deleting, setDeleting] = useState<Review | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReview(id),
    onSuccess: () => {
      toast.success(t('review.deleted'));
      invalidate();
      setDeleting(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const reviewerName = (r: Review): string =>
    typeof r.user === 'object' && r.user ? r.user.fullName : '—';
  const productName = (r: Review): string => {
    if (r.reviewType === 'restaurant') return t('review.experienceTitle');
    return typeof r.product === 'object' && r.product ? r.product.name : '—';
  };
  const productImage = (r: Review): string =>
    typeof r.product === 'object' && r.product && r.product.images?.[0] ? r.product.images[0] : '';

  const statCards: { label: string; value: string; tone?: string }[] = stats.data
    ? [
        { label: t('admin.totalReviews'), value: String(stats.data.total) },
        { label: t('admin.avgRating'), value: stats.data.average.toFixed(1) },
        { label: t('admin.reviewsToday'), value: String(stats.data.today) },
        { label: t('admin.fiveStarReviews'), value: String(stats.data.fiveStar), tone: 'text-gold-400' },
        { label: t('admin.oneStarReviews'), value: String(stats.data.oneStar), tone: 'text-red-400' },
        { label: t('admin.restaurantRatingLabel'), value: `${stats.data.restaurantAverage.toFixed(1)} (${stats.data.restaurantTotal})` },
      ]
    : [];

  return (
    <div>
      <PageHeader title={t('admin.nav.reviews')} subtitle={t('admin.reviewsSubtitle')} />

      {stats.data ? (
        <div className="mb-6 rounded-2xl border border-night-800 bg-night-900 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {statCards.map((c) => (
              <div key={c.label} className="rounded-xl border border-night-800 bg-night-950/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-night-500">{c.label}</p>
                <p className={cn('mt-1 text-2xl font-extrabold text-night-50', c.tone)} dir="ltr">{c.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <MealList title={t('admin.mostReviewed')} meals={stats.data.mostReviewed} showReviews />
            <MealList title={t('admin.highestRated')} meals={stats.data.highestRated} />
            <MealList title={t('admin.lowestRated')} meals={stats.data.lowestRated} />
          </div>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={t('admin.searchPlaceholder')} />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 w-40" aria-label="status">
          <option value="">{t('admin.allStatuses')}</option>
          <option value="published">{t('admin.published')}</option>
          <option value="pending">{t('admin.pending')}</option>
          <option value="hidden">{t('admin.hidden')}</option>
        </Select>
        <Select value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }} className="h-10 w-36" aria-label="rating">
          <option value="">{t('admin.allRatings')}</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={String(n)}>{n} ★</option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="h-10 w-44" aria-label="type">
          <option value="">{t('admin.allTypes')}</option>
          <option value="meal">{t('admin.mealReviews')}</option>
          <option value="restaurant">{t('admin.restaurantReviews')}</option>
        </Select>
        <Select value={meal} onChange={(e) => { setMeal(e.target.value); setPage(1); }} className="h-10 w-56" aria-label="meal">
          <option value="">{t('admin.allMeals')}</option>
          {meals.data?.map((p) => (
            <option key={p._id} value={p._id}>
              {i18n.language === 'ar' ? p.name : p.nameEn || p.name}
            </option>
          ))}
        </Select>
        <Select value={verified} onChange={(e) => { setVerified(e.target.value); setPage(1); }} className="h-10 w-44" aria-label="verified">
          <option value="">{t('admin.allPurchases')}</option>
          <option value="1">{t('review.verifiedPurchase')}</option>
          <option value="0">{t('admin.unverified')}</option>
        </Select>
        <Select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="h-10 w-36" aria-label="sort">
          <option value="newest">{t('admin.newest')}</option>
          <option value="oldest">{t('admin.oldest')}</option>
        </Select>
      </div>

      {reviews.isLoading ? (
        <Skeleton className="h-96" />
      ) : reviews.data && reviews.data.items.length > 0 ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>{t('admin.product')}</Th>
                <Th>{t('admin.reviewer')}</Th>
                <Th>{t('admin.rating')}</Th>
                <Th>{t('admin.comment')}</Th>
                <Th>{t('admin.verified')}</Th>
                <Th>{t('admin.status')}</Th>
                <Th className="text-end">{t('admin.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {reviews.data.items.map((r) => (
                <tr key={r._id} className="transition-colors hover:bg-night-800/40">
                  <Td>
                    <div className="flex items-center gap-3">
                      {productImage(r) ? (
                        <img src={productImage(r)} alt="" className="h-10 w-10 rounded-lg border border-night-700 object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-night-700 bg-night-800 text-xs text-night-500">
                          {t(r.reviewType === 'restaurant' ? 'review.experienceTitle' : 'admin.mealReviews')}
                        </span>
                      )}
                      <span className="max-w-[180px] truncate font-semibold text-night-50">{productName(r)}</span>
                    </div>
                  </Td>
                  <Td>
                    <p className="font-semibold text-night-100">{reviewerName(r)}</p>
                    {typeof r.user === 'object' && r.user.email ? (
                      <p className="text-xs text-night-500">{r.user.email}</p>
                    ) : null}
                  </Td>
                  <Td>
                    <StarRating value={r.rating} readOnly size="sm" />
                    <p className="mt-0.5 text-xs text-night-500" dir="ltr">{r.rating} / 5</p>
                  </Td>
                  <Td>
                    <p className="max-w-[300px] text-sm text-night-300 line-clamp-2" title={r.comment}>
                      {r.comment || '—'}
                    </p>
                  </Td>
                  <Td>
                    {r.isVerifiedPurchase ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {t('review.verifiedPurchase')}
                      </span>
                    ) : (
                      <span className="text-xs text-night-500">{t('admin.unverified')}</span>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={r.status === 'published' ? 'success' : r.status === 'pending' ? 'gold' : 'neutral'}>
                      {t(`admin.${r.status}`)}
                    </Badge>
                  </Td>
                  <Td className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      {r.status !== 'published' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={moderateMutation.isPending}
                          onClick={() => moderateMutation.mutate({ id: r._id as string, status: 'published' })}
                          title={t('admin.publish')}
                        >
                          <Eye className="h-4 w-4" />
                          {t('admin.publish')}
                        </Button>
                      ) : null}
                      {r.status !== 'hidden' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={moderateMutation.isPending}
                          onClick={() => moderateMutation.mutate({ id: r._id as string, status: 'hidden' })}
                          title={t('admin.hide')}
                        >
                          <Ban className="h-4 w-4" />
                          {t('admin.hide')}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                        disabled={moderateMutation.isPending || deleteMutation.isPending}
                        onClick={() => setDeleting(r)}
                        title={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t('common.delete')}
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={reviews.data.page} pages={reviews.data.pages} onPage={setPage} />

          <ConfirmDialog
            open={Boolean(deleting)}
            onClose={() => setDeleting(null)}
            onConfirm={() => deleting && deleteMutation.mutate(deleting._id as string)}
            title={t('admin.confirmDeleteTitle')}
            message={
              deleting
                ? t('admin.deleteReviewConfirm', {
                    meal: productName(deleting),
                    comment: deleting.comment?.slice(0, 80) || '—',
                  })
                : ''
            }
            loading={deleteMutation.isPending}
          />
        </>
      ) : (
        <Card>
          <CardContent className="py-14">
            <EmptyState title={t('admin.emptyList')} hint={t('admin.emptyListHint')} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MealList({
  title,
  meals,
  showReviews = false,
}: {
  title: string;
  meals: AdminReviewStats['mostReviewed'];
  showReviews?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  if (!meals.length) {
    return (
      <div className="rounded-xl border border-night-800 bg-night-950/60 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-night-500">{title}</p>
        <p className="text-sm text-night-500">{t('admin.noMealStats')}</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-night-800 bg-night-950/60 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-night-500">{title}</p>
      <ul className="space-y-1.5">
        {meals.slice(0, 5).map((m) => (
          <li key={m._id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-night-200">{lang === 'ar' ? m.name : m.nameEn || m.name}</span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-night-500" dir="ltr">
              {m.average !== undefined ? (
                <>
                  <Star className="h-3 w-3 fill-gold-400 text-gold-400" />
                  {m.average.toFixed(1)}
                </>
              ) : null}
              {showReviews ? `${t('admin.reviews')} ${m.reviews}` : `(${m.reviews})`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}