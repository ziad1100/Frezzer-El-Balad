import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CalendarDays, Download, Eraser, Package, RefreshCw, ShoppingBag, Star, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';
import { adminListOrders, adminReviewStats, clearDashboardStats, exportDashboard, getDashboard, getDashboardDay, refreshDashboard } from '@/api/admin';
import { getErrorMessage } from '@/lib/api';
import { Card, CardContent, EmptyState, ErrorState, Skeleton } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader, StatusBadge, TableWrap, Td, Th } from '@/components/admin/primitives';
import { cn, formatPrice } from '@/lib/utils';

type PeriodKey = 'today' | 'week' | 'month';

const PERIOD_KEYS: Record<PeriodKey, string> = {
  today: 'admin.overview.today',
  week: 'admin.overview.thisWeek',
  month: 'admin.overview.thisMonth',
};

export function AdminIndexPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();

  const dashboard = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: getDashboard });
  const recent = useQuery({
    queryKey: ['admin', 'orders', { page: 1, limit: 8 }],
    queryFn: () => adminListOrders({ page: 1, limit: 8 }),
  });

  const reviewStats = useQuery({ queryKey: ['admin', 'reviews', 'stats'], queryFn: adminReviewStats });

  const [period, setPeriod] = useState<PeriodKey>('today');
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));

  const refreshMutation = useMutation({
    mutationFn: refreshDashboard,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'day'] }),
      ]);
      toast.success(t('admin.refreshSuccess'));
    },
    onError: () => toast.error(t('admin.refreshError')),
  });

  const [confirmClear, setConfirmClear] = useState(false);
  const [resetTyped, setResetTyped] = useState('');

  const clearMutation = useMutation({
    mutationFn: clearDashboardStats,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'day'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
      ]);
      toast.success(t('admin.clearStatsSuccess'));
      setConfirmClear(false);
      setResetTyped('');
    },
    onError: () => toast.error(t('admin.clearStatsError')),
  });

  const closeClearModal = () => {
    setConfirmClear(false);
    setResetTyped('');
  };

  const exportMutation = useMutation({
    mutationFn: () => exportDashboard(day, period),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('admin.exportSuccess'));
    },
    onError: (error) => toast.error(getErrorMessage(error) || t('admin.exportError')),
  });

  const dayStats = useQuery({
    queryKey: ['admin', 'day', day],
    queryFn: () => getDashboardDay(day),
    enabled: Boolean(day),
  });

  const stats = [
    { key: t('admin.revenue'), value: dashboard.data ? formatPrice(dashboard.data.revenue, lang) : '—', icon: Banknote },
    { key: t('admin.nav.orders'), value: dashboard.data?.orders ?? '—', icon: ShoppingBag },
    { key: t('admin.overview.customers'), value: dashboard.data?.customers ?? '—', icon: Users },
    { key: t('admin.status.pending'), value: dashboard.data?.pendingOrders ?? '—', icon: Package },
    { key: t('admin.overview.recentRevenue'), value: dashboard.data ? formatPrice(dashboard.data.recentRevenue, lang) : '—', icon: TrendingUp },
    { key: t('admin.overview.products'), value: dashboard.data?.products ?? '—', icon: Package },
  ];

  const reviewTiles = reviewStats.data
    ? [
        { label: t('admin.totalReviews'), value: String(reviewStats.data.total) },
        { label: t('admin.avgRating'), value: reviewStats.data.average.toFixed(1) },
        { label: t('admin.reviewsToday'), value: String(reviewStats.data.today) },
        { label: t('admin.pendingReviews'), value: String(reviewStats.data.pending) },
        { label: t('admin.fiveStarReviews'), value: String(reviewStats.data.fiveStar), tone: 'text-gold-400' },
        { label: t('admin.oneStarReviews'), value: String(reviewStats.data.oneStar), tone: 'text-red-400' },
        {
          label: t('admin.restaurantRatingLabel'),
          value: `${reviewStats.data.restaurantAverage.toFixed(1)} (${reviewStats.data.restaurantTotal})`,
        },
      ]
    : [];

  const financial = dashboard.data
    ? [
        { key: t('admin.totalOrders'), value: String(dashboard.data.orders), tone: 'text-night-50' },
        { key: t('admin.completedOrders'), value: String(dashboard.data.completedOrders), tone: 'text-emerald-400' },
        { key: t('admin.cancelledOrders'), value: String(dashboard.data.cancelledOrders), tone: 'text-red-400' },
        { key: t('admin.refundedOrders'), value: String(dashboard.data.refundedOrders), tone: 'text-slate-300' },
        { key: t('admin.complimentaryOrders'), value: String(dashboard.data.complimentaryOrders), tone: 'text-gold-400' },
        { key: t('admin.grossRevenue'), value: formatPrice(dashboard.data.grossRevenue, lang), tone: 'text-night-50' },
        { key: t('admin.discounts'), value: formatPrice(dashboard.data.discounts, lang), tone: 'text-amber-400' },
        { key: t('admin.deliveryFees'), value: formatPrice(dashboard.data.deliveryFees, lang), tone: 'text-night-50' },
        { key: t('admin.netRevenue'), value: formatPrice(dashboard.data.netRevenue, lang), tone: 'text-emerald-400' },
      ]
    : [];

  const dayRows = dayStats.data
    ? [
        { key: t('admin.nav.orders'), value: String(dayStats.data.orders) },
        { key: t('admin.completedOrders'), value: String(dayStats.data.completed) },
        { key: t('admin.cancelledOrders'), value: String(dayStats.data.cancelled) },
        { key: t('admin.refundedOrders'), value: String(dayStats.data.refunded) },
        { key: t('admin.complimentaryOrders'), value: String(dayStats.data.complimentary) },
        { key: t('admin.revenue'), value: formatPrice(dayStats.data.revenue, lang) },
      ]
    : [];

  const trend = dashboard.data?.revenueTrend ?? [];
  const trendData = trend.slice(-7);
  const statuses = dashboard.data?.statusBreakdown ?? [];
  const top = dashboard.data?.topProducts ?? [];

  const metrics = dashboard.data?.periodOverview?.[period];
  const periodCards = [
    { key: t('admin.revenue'), value: metrics ? formatPrice(metrics.revenue, lang) : '—', icon: Banknote },
    { key: t('admin.nav.orders'), value: metrics?.orders ?? '—', icon: ShoppingBag },
    { key: t('admin.overview.productsSold'), value: metrics?.unitsSold ?? '—', icon: Package },
    { key: t('admin.overview.customers'), value: metrics?.customers ?? '—', icon: Users },
  ];

  const dailyStats = dashboard.data?.dailyStats ?? [];
  const unitsWindow = period === 'today' ? dailyStats.slice(-1) : period === 'month' ? dailyStats : dailyStats.slice(-7);
  const periodTop = metrics?.topProducts ?? [];

  return (
    <div>
      <PageHeader
        title={t('admin.dashboardHeader')}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              loading={clearMutation.isPending}
              disabled={clearMutation.isPending}
              onClick={() => setConfirmClear(true)}
              title={t('admin.clearStatsTitle')}
            >
              <Eraser className="h-4 w-4" />
              {t('admin.clearStats')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={exportMutation.isPending}
              disabled={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
            >
              <Download className="h-4 w-4" />
              {exportMutation.isPending ? t('admin.exporting') : t('admin.export')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={refreshMutation.isPending}
              disabled={refreshMutation.isPending}
              onClick={() => refreshMutation.mutate()}
            >
              <RefreshCw className={cn('h-4 w-4', refreshMutation.isPending && 'animate-spin')} />
              {refreshMutation.isPending ? t('admin.refreshing') : t('admin.refresh')}
            </Button>
          </div>
        }
      />

      {dashboard.isError ? (
        <Card>
          <CardContent>
            <ErrorState
              title={t('common.loadError')}
              onRetry={() => dashboard.refetch()}
              retryLabel={t('common.retry')}
            />
          </CardContent>
        </Card>
      ) : dashboard.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ key, value, icon: Icon }) => (
            <Card key={key}>
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600/15 text-brand-500">
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm text-night-400">{key}</p>
                  <p className="mt-0.5 text-2xl font-extrabold text-night-50">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-bold text-night-200">{t('admin.financialTitle')}</h3>
            {financial.length > 0 ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                {financial.map(({ key, value, tone }) => (
                  <div key={key}>
                    <dt className="text-xs text-night-500">{key}</dt>
                    <dd className={`mt-0.5 text-lg font-extrabold ${tone}`}>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <EmptyState title={t('admin.emptyList')} icon={<Banknote className="h-10 w-10" />} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-night-200">{t('admin.dailyTitle')}</h3>
              <Input
                type="date"
                value={day}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDay(e.target.value)}
                className="h-9 w-44 text-sm"
                aria-label={t('admin.selectDate')}
              />
            </div>
            {dayStats.isLoading ? (
              <Skeleton className="h-32" />
            ) : dayStats.isError ? (
              <ErrorState
                title={t('common.loadError')}
                onRetry={() => void dayStats.refetch()}
                retryLabel={t('common.retry')}
              />
            ) : dayRows.length > 0 ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                {dayRows.map(({ key, value }) => (
                  <div key={key}>
                    <dt className="flex items-center gap-1.5 text-xs text-night-500">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {key}
                    </dt>
                    <dd className="mt-0.5 text-lg font-extrabold text-night-50">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <EmptyState title={t('admin.emptyList')} icon={<CalendarDays className="h-10 w-10" />} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-night-200">
              <Star className="h-4 w-4 text-gold-400" />
              {t('admin.reviewsOverview')}
            </h3>
            <Link to="/admin/reviews" className="text-sm font-bold text-brand-500 hover:text-brand-400">
              {t('admin.nav.reviews')}
            </Link>
          </div>
          {reviewStats.isLoading ? (
            <Skeleton className="h-28" />
          ) : reviewStats.data ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {reviewTiles.map(({ label, value, tone }) => (
                <div key={label} className="rounded-xl border border-night-800 bg-night-950/60 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-night-500">{label}</p>
                  <p className={cn('mt-1 text-2xl font-extrabold text-night-50', tone)} dir="ltr">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-night-50">{t('admin.periodTitle')}</h2>
          <div className="inline-flex rounded-xl border border-night-800 bg-night-900 p-1">
            {(['today', 'week', 'month'] as PeriodKey[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'rounded-lg px-4 py-1.5 text-sm font-bold transition-colors',
                  period === p ? 'bg-brand-600 text-white' : 'text-night-300 hover:text-night-50',
                )}
              >
                {t(PERIOD_KEYS[p])}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {periodCards.map(({ key, value, icon: Icon }) => (
            <Card key={key}>
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600/15 text-brand-500">
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm text-night-400">{key}</p>
                  <p className="mt-0.5 text-2xl font-extrabold text-night-50">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-4 text-sm font-bold text-night-200">{t('admin.topProducts')}</h3>
              {periodTop.length > 0 ? (
                <ul className="space-y-3">
                  {periodTop.map((p) => (
                    <li key={`${p._id}-${p.name}`} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-semibold text-night-200">{p.name}</span>
                      <span className="shrink-0 text-xs text-night-500">
                        {p.count}× · {formatPrice(p.revenue, lang)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title={t('admin.emptyList')} icon={<Package className="h-10 w-10" />} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="mb-4 text-sm font-bold text-night-200">
                {period === 'today' ? t('admin.unitsToday') : t('admin.unitsTrend', { days: period === 'month' ? 30 : 7 })}
              </h3>
              {unitsWindow.length > 0 ? (
                <div className="flex h-40 items-end gap-2">
                  {unitsWindow.map((d) => {
                    const max = Math.max(...unitsWindow.map((x) => x.unitsSold), 1);
                    return (
                      <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-brand-500 to-gold-400"
                          style={{ height: `${Math.max(4, (d.unitsSold / max) * 110)}px` }}
                        />
                        <span className="text-[10px] text-night-500">{d.date.slice(8)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title={t('admin.emptyList')} icon={<Package className="h-10 w-10" />} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {trendData.length > 0 ? (
          <Card className="lg:col-span-1">
            <CardContent className="p-5">
              <h3 className="mb-4 text-sm font-bold text-night-200">{t('admin.last7Days')}</h3>
              <div className="flex h-40 items-end gap-2">
                {trendData.map((d) => {
                  const max = Math.max(...trendData.map((x) => x.revenue), 1);
                  return (
                    <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-brand-700 to-brand-500"
                        style={{ height: `${Math.max(4, (d.revenue / max) * 110)}px` }}
                      />
                      <span className="text-[10px] text-night-500">{d.date.slice(8)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="lg:col-span-1">
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-bold text-night-200">{t('admin.statusTitle')}</h3>
            {statuses.length > 0 ? (
              <ul className="space-y-3">
                {statuses.map((s) => (
                  <li key={s.status} className="flex items-center justify-between gap-3">
                    <StatusBadge status={s.status} />
                    <span className="text-sm font-bold text-night-50">{s.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t('admin.emptyList')} icon={<Package className="h-10 w-10" />} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-bold text-night-200">{t('admin.topProducts')}</h3>
            {top.length > 0 ? (
              <ul className="space-y-3">
                {top.map((p) => (
                  <li key={p._id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-semibold text-night-200">{p.name}</span>
                    <span className="shrink-0 text-xs text-night-500">
                      {p.count}× · {formatPrice(p.revenue, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t('admin.emptyList')} icon={<Package className="h-10 w-10" />} />
            )}
          </CardContent>
        </Card>
      </div>

      <Modal open={confirmClear} onClose={closeClearModal} title={t('admin.clearStatsTitle')} size="sm">
        <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm leading-relaxed text-night-200">
          <p className="mb-2 font-bold text-red-400">⚠️ {t('admin.clearStatsWarning')}</p>
          <p>{t('admin.clearStatsConfirm')}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-bold text-red-400">{t('admin.clearStatsZeroTitle')}</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-night-300">
                {(t('admin.clearStatsZeroItems', { returnObjects: true }) as unknown as string[]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold text-emerald-400">{t('admin.clearStatsKeepTitle')}</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-night-300">
                {(t('admin.clearStatsKeepItems', { returnObjects: true }) as unknown as string[]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-night-500">
            {t('admin.clearStatsTypeHint')}
          </label>
          <Input
            value={resetTyped}
            onChange={(e) => setResetTyped(e.target.value)}
            placeholder="RESET"
            dir="ltr"
            className="h-10 w-full font-mono text-center tracking-[0.3em]"
            autoComplete="off"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={closeClearModal} disabled={clearMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={clearMutation.isPending}
            disabled={resetTyped.trim().toUpperCase() !== 'RESET'}
            onClick={() => clearMutation.mutate()}
          >
            {t('admin.clearStats')}
          </Button>
        </div>
      </Modal>

      <div className="mt-6">
        <PageHeader title={t('admin.recentOrders')} />
        {recent.isLoading ? (
          <Skeleton className="h-40" />
        ) : recent.isError ? (
          <Card>
            <CardContent>
              <ErrorState
                title={t('common.loadError')}
                onRetry={() => recent.refetch()}
                retryLabel={t('common.retry')}
              />
            </CardContent>
          </Card>
        ) : recent.data && recent.data.items.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>{t('admin.nav.orders')}</Th>
                <Th>{t('admin.customer')}</Th>
                <Th>{t('common.min')}</Th>
                <Th>{t('admin.total')}</Th>
                <Th>{t('admin.statusChange')}</Th>
              </tr>
            </thead>
            <tbody>
              {recent.data.items.map((o) => (
                <tr key={o._id} className="transition-colors hover:bg-night-800/40">
                  <Td className="font-bold text-night-50">
                    <Link to="/admin/orders" className="hover:text-brand-400">
                      {o.orderNo}
                    </Link>
                  </Td>
                  <Td>{o.customerName}</Td>
                  <Td>{formatPrice(o.subtotal, lang)}</Td>
                  <Td className="font-bold text-night-50">{formatPrice(o.total, lang)}</Td>
                  <Td>
                    <StatusBadge status={o.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <Card>
            <CardContent>
              <EmptyState title={t('admin.emptyList')} icon={<ShoppingBag className="h-12 w-12" />} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}