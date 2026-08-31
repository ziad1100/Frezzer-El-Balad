import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Download, Eraser, Package, RefreshCw, Search, ShoppingBag, TrendingDown, TrendingUp, ShoppingCart, Users } from 'lucide-react';
import { toast } from 'sonner';
import { adminListOrders, exportDashboard, getCategorySales, getDashboard, getInventoryStats, getInventoryValueByCategory, getPurchaseStats, getSalesStats, getTotalInventoryValue, listPurchases, refreshDashboard, resetPurchases, resetSales, systemReset } from '@/api/admin';
import { exportMovementReport, getMovementReport, type MovementReport } from '@/api/stock-movements';
import { getErrorMessage } from '@/lib/api';
import { Card, CardContent, EmptyState, ErrorState, Skeleton } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader, StatusBadge, TableWrap, Td, Th } from '@/components/admin/primitives';
import { cn, formatPrice } from '@/lib/utils';
import { FinancialChart } from '@/components/admin/charts/FinancialChart';
import { CategorySalesChart } from '@/components/admin/charts/CategorySalesChart';
import { TopProductsChart } from '@/components/admin/charts/TopProductsChart';
import { SalesVsPurchasesChart } from '@/components/admin/charts/SalesVsPurchasesChart';
import { InventoryValueChart } from '@/components/admin/charts/InventoryValueChart';

type PeriodKey = 'today' | 'week' | 'month' | 'year' | 'custom';

const PERIOD_KEYS: Record<PeriodKey, string> = {
  today: 'admin.overview.today',
  week: 'admin.overview.thisWeek',
  month: 'admin.overview.thisMonth',
  year: 'admin.overview.yearly',
  custom: 'admin.overview.custom',
};

const MAIN_CHART_PERIODS: PeriodKey[] = ['today', 'week', 'month', 'custom', 'year'];

export function AdminIndexPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();

  const dashboard = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: getDashboard });
  const recent = useQuery({
    queryKey: ['admin', 'orders', { page: 1, limit: 8 }],
    queryFn: () => adminListOrders({ page: 1, limit: 8 }),
  });


  const salesStats = useQuery({ queryKey: ['admin', 'sales'], queryFn: () => getSalesStats() });
  const purchaseStats = useQuery({ queryKey: ['admin', 'purchases', 'stats'], queryFn: () => getPurchaseStats() });
  const categorySales = useQuery({ queryKey: ['admin', 'category-sales'], queryFn: getCategorySales });
  const inventoryStats = useQuery({ queryKey: ['admin', 'inventory'], queryFn: getInventoryStats });
  const inventoryValue = useQuery({ queryKey: ['admin', 'inventory-value'], queryFn: getTotalInventoryValue });
  const inventoryValueByCategory = useQuery({ queryKey: ['admin', 'inventory-value-category'], queryFn: getInventoryValueByCategory });

  const [period, setPeriod] = useState<PeriodKey>('today');
  const [inventorySearch, setInventorySearch] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const refreshMutation = useMutation({
    mutationFn: refreshDashboard,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'day'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'sales'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'purchases'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'category-sales'] }),
      ]);
      toast.success(t('admin.refreshSuccess'));
    },
    onError: () => toast.error(t('admin.refreshError')),
  });

  const [confirmClear, setConfirmClear] = useState(false);
  const [resetTyped, setResetTyped] = useState('');

  const clearMutation = useMutation({
    mutationFn: systemReset,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'day'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'offers'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'sales'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'purchases'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'purchases', 'chart'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'category-sales'] }),
      ]);
      toast.success(t('admin.systemResetSuccess'));
      setConfirmClear(false);
      setResetTyped('');
    },
    onError: () => toast.error(t('admin.systemResetError')),
  });

  const closeClearModal = () => {
    setConfirmClear(false);
    setResetTyped('');
  };

  // ─── Reset Sales ──────────────────────────────────────────
  const [confirmSalesReset, setConfirmSalesReset] = useState(false);
  const [salesResetTyped, setSalesResetTyped] = useState('');

  const salesResetMutation = useMutation({
    mutationFn: resetSales,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'sales'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'category-sales'] }),
      ]);
      toast.success(t('admin.salesResetSuccess'));
      setConfirmSalesReset(false);
      setSalesResetTyped('');
    },
    onError: () => toast.error(t('admin.salesResetError')),
  });

  const closeSalesResetModal = () => {
    setConfirmSalesReset(false);
    setSalesResetTyped('');
  };

  // ─── Reset Purchases ─────────────────────────────────────
  const [confirmPurchasesReset, setConfirmPurchasesReset] = useState(false);
  const [purchasesResetTyped, setPurchasesResetTyped] = useState('');

  const purchasesResetMutation = useMutation({
    mutationFn: resetPurchases,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'purchases'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
      ]);
      toast.success(t('admin.purchasesResetSuccess'));
      setConfirmPurchasesReset(false);
      setPurchasesResetTyped('');
    },
    onError: () => toast.error(t('admin.purchasesResetError')),
  });

  const closePurchasesResetModal = () => {
    setConfirmPurchasesReset(false);
    setPurchasesResetTyped('');
  };

  // Export state
  const [exportPeriod, setExportPeriod] = useState<PeriodKey | 'custom'>('today');
  const [exportCustomStart, setExportCustomStart] = useState('');
  const [exportCustomEnd, setExportCustomEnd] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'summary' | 'movement'>('movement');
  const [exportPreview, setExportPreview] = useState<MovementReport | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const getExportDates = () => {
    const now = new Date();
    if (exportPeriod === 'today') {
      const d = now.toISOString().slice(0, 10);
      return { start: d, end: d };
    }
    if (exportPeriod === 'week') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
    }
    if (exportPeriod === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
    }
    return { start: exportCustomStart, end: exportCustomEnd };
  };

  const loadPreview = async () => {
    const { start, end } = getExportDates();
    if (!start || !end) return;
    setPreviewLoading(true);
    try {
      const report = await getMovementReport(start, end);
      setExportPreview(report);
    } catch {
      toast.error(lang === 'ar' ? 'فشل تحميل المعاينة' : 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const exportMutation = useMutation({
    mutationFn: () => {
      const { start, end } = getExportDates();
      if (exportType === 'movement') {
        return exportMovementReport(start, end, exportPeriod);
      }
      if (exportPeriod === 'custom') {
        return exportDashboard(undefined, 'custom', start, end);
      }
      return exportDashboard(undefined, exportPeriod);
    },
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

  // ─── Compute date ranges ─────────────────────────────────────
  const now = new Date();

  // ─── Purchases for charts ────────────────────────────────────
  const purchaseDateRange = (() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'today') {
      const ds = today.toISOString().slice(0, 10);
      return { startDate: ds, endDate: ds + 'T23:59:59' };
    }
    if (period === 'month') {
      const ms = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const me = today.toISOString().slice(0, 10);
      return { startDate: ms, endDate: me + 'T23:59:59' };
    }
    if (period === 'year') {
      const ys = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const ye = today.toISOString().slice(0, 10);
      return { startDate: ys, endDate: ye + 'T23:59:59' };
    }
    if (period === 'custom' && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd + 'T23:59:59' };
    }
    // week (default)
    const ws = new Date(today);
    ws.setDate(ws.getDate() - 6);
    return { startDate: ws.toISOString().slice(0, 10), endDate: today.toISOString().slice(0, 10) + 'T23:59:59' };
  })();

  const purchasesForChart = useQuery({
    queryKey: ['admin', 'purchases', 'chart', purchaseDateRange],
    queryFn: () => listPurchases({ page: 1, limit: 500, startDate: purchaseDateRange.startDate, endDate: purchaseDateRange.endDate }),
  });

  // ─── Financial chart data ────────────────────────────────────
  const dailyStats = dashboard.data?.dailyStats ?? [];
  const financialData = useMemo(() => {
    const purchasesByDate = new Map<string, number>();
    for (const p of purchasesForChart.data?.items ?? []) {
      const d = p.purchaseDate?.slice(0, 10) ?? '';
      if (d) purchasesByDate.set(d, (purchasesByDate.get(d) ?? 0) + p.totalCost);
    }

    const salesByDate = new Map<string, number>();
    for (const d of dailyStats) {
      salesByDate.set(d.date, d.revenue);
    }

    // Merge all dates
    const allDates = new Set([...salesByDate.keys(), ...purchasesByDate.keys()]);
    return Array.from(allDates)
      .sort()
      .map((date) => {
        const sales = Math.round((salesByDate.get(date) ?? 0) * 100) / 100;
        const purchases = Math.round((purchasesByDate.get(date) ?? 0) * 100) / 100;
        const outgoing = purchases; // Outgoing = purchases cost
        const revenue = sales - outgoing; // Revenue = sales - cost
        return { date, sales, outgoing, purchases, revenue };
      });
  }, [dailyStats, purchasesForChart.data]);

  // ─── Yearly aggregation for yearly view ──────────────────────
  const yearlyData = useMemo(() => {
    if (period !== 'year') return [];
    const byYear = new Map<string, { sales: number; outgoing: number; purchases: number; revenue: number }>();
    for (const d of financialData) {
      const year = d.date.slice(0, 4);
      const entry = byYear.get(year) ?? { sales: 0, outgoing: 0, purchases: 0, revenue: 0 };
      entry.sales += d.sales;
      entry.outgoing += d.outgoing;
      entry.purchases += d.purchases;
      entry.revenue += d.revenue;
      byYear.set(year, entry);
    }
    return Array.from(byYear.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, data]) => ({ date: year, ...data }));
  }, [financialData, period]);

  // ─── KPI Cards ──────────────────────────────────────────────
  const totalSales = salesStats.data?.salesValue ?? 0;
  const totalPurchases = purchaseStats.data?.totalCost ?? 0;
  const totalOutgoing = totalPurchases; // outgoing = cost of purchases
  const totalRevenue = dashboard.data?.revenue ?? 0;
  const netProfit = totalRevenue - totalOutgoing;
  const orderCount = dashboard.data?.orders ?? 0;
  const productCount = dashboard.data?.products ?? 0;
  const customerCount = dashboard.data?.customers ?? 0;
  const pendingOrders = dashboard.data?.pendingOrders ?? 0;
  const completedOrders = dashboard.data?.completedOrders ?? 0;
  const cancelledOrders = dashboard.data?.cancelledOrders ?? 0;
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

  // ─── Purchases vs Sales chart data ───────────────────────────
  const salesVsPurchasesData = useMemo(() => {
    const salesByDate = new Map<string, number>();
    for (const d of dailyStats) {
      salesByDate.set(d.date, d.revenue);
    }
    const purchasesByDate = new Map<string, number>();
    for (const p of purchasesForChart.data?.items ?? []) {
      const d = p.purchaseDate?.slice(0, 10) ?? '';
      if (d) purchasesByDate.set(d, (purchasesByDate.get(d) ?? 0) + p.totalCost);
    }
    const allDates = new Set([...salesByDate.keys(), ...purchasesByDate.keys()]);
    return Array.from(allDates)
      .sort()
      .map((date) => ({
        date: date.slice(5),
        sales: Math.round((salesByDate.get(date) ?? 0) * 100) / 100,
        purchases: Math.round((purchasesByDate.get(date) ?? 0) * 100) / 100,
      }));
  }, [dailyStats, purchasesForChart.data]);

  // ─── Top products for chart ──────────────────────────────────
  const periodTop = useMemo(() => {
    const metrics = dashboard.data?.periodOverview as Record<string, any> | undefined;
    if (!metrics) return [];
    const periodMetrics = metrics[period] as { topProducts?: Array<{ _id?: string; name: string; count: number; revenue: number }> } | undefined;
    return periodMetrics?.topProducts ?? [];
  }, [dashboard.data, period]);

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
              title={t('admin.systemResetTitle')}
            >
              <Eraser className="h-4 w-4" />
              {t('admin.systemReset')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={salesResetMutation.isPending}
              disabled={salesResetMutation.isPending}
              onClick={() => setConfirmSalesReset(true)}
              title={t('admin.salesResetTitle')}
            >
              <TrendingDown className="h-4 w-4" />
              {t('admin.salesReset')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={purchasesResetMutation.isPending}
              disabled={purchasesResetMutation.isPending}
              onClick={() => setConfirmPurchasesReset(true)}
              title={t('admin.purchasesResetTitle')}
            >
              <ShoppingCart className="h-4 w-4" />
              {t('admin.purchasesReset')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={exportMutation.isPending}
              disabled={exportMutation.isPending}
              onClick={() => setShowExportModal(true)}
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

      {/* ═══ KPI CARDS ═══ */}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* 1. Total Sales */}
          <Card variant="interactive">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <TrendingUp className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}
                </p>
                <p className="mt-0.5 text-xl font-extrabold tracking-tight text-[var(--tw-text)]">
                  {formatPrice(totalSales, lang)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 2. Total Outgoing */}
          <Card variant="interactive">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                <TrendingUp className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'إجمالي المنصرف' : 'Total Outgoing'}
                </p>
                <p className="mt-0.5 text-xl font-extrabold tracking-tight text-red-500">
                  {formatPrice(totalOutgoing, lang)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 3. Total Purchases */}
          <Card variant="interactive">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
                <Package className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'إجمالي المشتريات' : 'Total Purchases'}
                </p>
                <p className="mt-0.5 text-xl font-extrabold tracking-tight text-violet-500">
                  {formatPrice(totalPurchases, lang)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 4. Revenue */}
          <Card variant="interactive">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Banknote className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'الإيرادات' : 'Revenue'}
                </p>
                <p className="mt-0.5 text-xl font-extrabold tracking-tight text-emerald-500">
                  {formatPrice(totalRevenue, lang)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 5. Net Profit */}
          <Card variant="interactive">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-500">
                <Banknote className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'صافي الربح' : 'Net Profit'}
                </p>
                <p className={cn('mt-0.5 text-xl font-extrabold tracking-tight', netProfit >= 0 ? 'text-fresh-400' : 'text-red-400')}>
                  {formatPrice(netProfit, lang)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 6. Order Count */}
          <Card variant="interactive">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ice-500/10 text-ice-500">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'عدد الطلبات' : 'Order Count'}
                </p>
                <p className="mt-0.5 text-xl font-extrabold tracking-tight text-[var(--tw-text)]">
                  {orderCount}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 7. Product Count */}
          <Card variant="interactive">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Package className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'عدد المنتجات' : 'Product Count'}
                </p>
                <p className="mt-0.5 text-xl font-extrabold tracking-tight text-[var(--tw-text)]">
                  {productCount}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 8. Total Customers */}
          <Card variant="interactive">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'عدد العملاء' : 'Total Customers'}
                </p>
                <p className="mt-0.5 text-xl font-extrabold tracking-tight text-sky-500">
                  {customerCount}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 9. Average Order Value */}
          <Card variant="interactive">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <Banknote className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'متوسط قيمة الطلب' : 'Avg Order Value'}
                </p>
                <p className="mt-0.5 text-xl font-extrabold tracking-tight text-indigo-500">
                  {formatPrice(avgOrderValue, lang)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 10. Pending Orders */}
          <Card variant="interactive">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'طلبات قيد الانتظار' : 'Pending Orders'}
                </p>
                <p className="mt-0.5 text-xl font-extrabold tracking-tight text-amber-500">
                  {pendingOrders}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 11. Completed Orders */}
          <Card variant="interactive">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'طلبات مكتملة' : 'Completed Orders'}
                </p>
                <p className="mt-0.5 text-xl font-extrabold tracking-tight text-emerald-500">
                  {completedOrders}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 12. Cancelled Orders */}
          <Card variant="interactive">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'طلبات ملغاة' : 'Cancelled Orders'}
                </p>
                <p className="mt-0.5 text-xl font-extrabold tracking-tight text-red-500">
                  {cancelledOrders}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 13. Total Inventory Value */}
          <Card variant="interactive">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <Package className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'قيمة المخزون' : 'Inventory Value'}
                </p>
                <p className="mt-0.5 text-xl font-extrabold tracking-tight text-brand-500">
                  {formatPrice(inventoryValue.data?.totalValue ?? 0, lang)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ MAIN FINANCIAL CHART ═══ */}
      <div className="mt-6">
        <Card>
          <CardContent className="p-5 sm:p-6">
            {/* Header */}
            <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold tracking-tight text-[var(--tw-text)]">
                  {lang === 'ar' ? 'اتجاه المبيعات' : 'Sales Trend'}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'تحليل المبيعات خلال الفترة المحددة' : 'Sales analysis for the selected period'}
                </p>
              </div>
              {/* Segmented time control */}
              <div className="inline-flex flex-wrap rounded-lg border border-[var(--tw-border)] bg-[var(--tw-surface-alt)] p-0.5">
                {MAIN_CHART_PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px] font-semibold leading-5 transition-all duration-150',
                      period === p
                        ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/20'
                        : 'text-[var(--tw-text-muted)] hover:text-[var(--tw-text)]',
                    )}
                  >
                    {t(PERIOD_KEYS[p])}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom date inputs */}
            {period === 'custom' && (
              <div className="mb-3 mt-3 flex items-center gap-2">
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 w-36 text-xs"
                  max={customEnd || undefined}
                />
                <span className="text-xs text-[var(--tw-text-muted)]">—</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 w-36 text-xs"
                  min={customStart || undefined}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
            )}

            {/* Chart legend */}
            {financialData.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-4">
                {[
                  { key: 'sales', label: lang === 'ar' ? 'المبيعات' : 'Sales', color: '#6366F1' },
                  { key: 'outgoing', label: lang === 'ar' ? 'المنصرف' : 'Outgoing', color: '#EF4444' },
                  { key: 'purchases', label: lang === 'ar' ? 'المشتريات' : 'Purchases', color: '#8B5CF6' },
                  { key: 'revenue', label: lang === 'ar' ? 'الإيرادات' : 'Revenue', color: '#22C55E' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[11px] text-[var(--tw-text-muted)]">{item.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Chart area */}
            {period === 'year' ? (
              yearlyData.length >= 2 ? (
                <FinancialChart data={yearlyData} lang={lang} height={340} />
              ) : (
                <div className="flex h-[340px] items-center justify-center">
                  <p className="text-sm text-[var(--tw-text-muted)]">
                    {lang === 'ar' ? 'لا توجد بيانات كافية' : 'Not enough data'}
                  </p>
                </div>
              )
            ) : financialData.length > 0 ? (
              <FinancialChart data={financialData} lang={lang} height={340} />
            ) : (
              <div className="flex h-[340px] items-center justify-center">
                <EmptyState
                  title={lang === 'ar' ? 'لا توجد بيانات لهذه الفترة' : 'No data for this period'}
                  icon={<TrendingUp className="h-10 w-10" />}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ ADDITIONAL CHARTS ═══ */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Chart 1: Sales by Category — donut */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-bold tracking-tight text-[var(--tw-text)]">
              {lang === 'ar' ? 'المبيعات حسب الفئة' : 'Sales by Category'}
            </h3>
            {categorySales.isLoading ? (
              <Skeleton className="h-56" />
            ) : categorySales.data && categorySales.data.length > 0 ? (
              <CategorySalesChart data={categorySales.data} lang={lang} />
            ) : (
              <EmptyState
                title={lang === 'ar' ? 'لا توجد بيانات لهذه الفترة' : 'No data for this period'}
                icon={<Package className="h-10 w-10" />}
              />
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Top Selling Products — horizontal bar */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-bold tracking-tight text-[var(--tw-text)]">
              {lang === 'ar' ? 'أكثر المنتجات مبيعاً' : 'Top Selling Products'}
            </h3>
            {periodTop.length > 0 ? (
              <TopProductsChart data={periodTop.map((p) => ({ name: p.name, count: p.count, revenue: p.revenue }))} lang={lang} />
            ) : (
              <EmptyState
                title={lang === 'ar' ? 'لا توجد بيانات لهذه الفترة' : 'No data for this period'}
                icon={<ShoppingBag className="h-10 w-10" />}
              />
            )}
          </CardContent>
        </Card>

        {/* Chart 3: Purchases vs Sales — grouped bar */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-bold tracking-tight text-[var(--tw-text)]">
              {lang === 'ar' ? 'المشتريات مقابل المبيعات' : 'Purchases vs Sales'}
            </h3>
            {salesVsPurchasesData.length > 0 ? (
              <SalesVsPurchasesChart data={salesVsPurchasesData} lang={lang} />
            ) : (
              <EmptyState
                title={lang === 'ar' ? 'لا توجد بيانات لهذه الفترة' : 'No data for this period'}
                icon={<TrendingUp className="h-10 w-10" />}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ ORDER STATUS BREAKDOWN ═══ */}
      <div className="mt-6">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <h3 className="mb-4 text-base font-bold tracking-tight text-[var(--tw-text)]">
              {lang === 'ar' ? 'حالة الطلبات' : 'Order Status Breakdown'}
            </h3>
            {dashboard.data?.statusBreakdown && dashboard.data.statusBreakdown.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {dashboard.data.statusBreakdown.map((s) => {
                  const colors: Record<string, { bg: string; text: string; border: string }> = {
                    pending: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
                    confirmed: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
                    preparing: { bg: 'bg-indigo-500/10', text: 'text-indigo-500', border: 'border-indigo-500/20' },
                    ready_for_delivery: { bg: 'bg-cyan-500/10', text: 'text-cyan-500', border: 'border-cyan-500/20' },
                    on_delivery: { bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/20' },
                    completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
                    cancelled: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' },
                    refunded: { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20' },
                  };
                  const c = colors[s.status] ?? { bg: 'bg-gray-500/10', text: 'text-gray-500', border: 'border-gray-500/20' };
                  const statusLabels: Record<string, { ar: string; en: string }> = {
                    pending: { ar: 'قيد الانتظار', en: 'Pending' },
                    confirmed: { ar: 'مؤكد', en: 'Confirmed' },
                    preparing: { ar: 'قيد التحضير', en: 'Preparing' },
                    ready_for_delivery: { ar: 'جاهز للتسليم', en: 'Ready' },
                    on_delivery: { ar: 'في الطريق', en: 'On Delivery' },
                    completed: { ar: 'مكتمل', en: 'Completed' },
                    cancelled: { ar: 'ملغي', en: 'Cancelled' },
                    refunded: { ar: 'مسترجع', en: 'Refunded' },
                  };
                  const label = statusLabels[s.status] ?? { ar: s.status, en: s.status };
                  return (
                    <div key={s.status} className={cn('rounded-xl border p-4 text-center', c.border, c.bg)}>
                      <p className={cn('text-2xl font-extrabold tabular-nums', c.text)}>{s.count}</p>
                      <p className="mt-1 text-xs font-medium text-[var(--tw-text-muted)]">
                        {lang === 'ar' ? label.ar : label.en}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title={lang === 'ar' ? 'لا توجد بيانات حالة الطلبات' : 'No order status data'}
                icon={<ShoppingBag className="h-10 w-10" />}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ INVENTORY VALUE BY CATEGORY ═══ */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-bold tracking-tight text-[var(--tw-text)]">
              {lang === 'ar' ? 'قيمة المخزون حسب الفئة' : 'Inventory Value by Category'}
            </h3>
            {inventoryValueByCategory.isLoading ? (
              <Skeleton className="h-64" />
            ) : inventoryValueByCategory.data && inventoryValueByCategory.data.length > 0 ? (
              <InventoryValueChart data={inventoryValueByCategory.data} lang={lang} height={Math.max(200, inventoryValueByCategory.data.length * 36)} />
            ) : (
              <EmptyState
                title={lang === 'ar' ? 'لا توجد بيانات مخزون' : 'No inventory data'}
                icon={<Package className="h-10 w-10" />}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-bold tracking-tight text-[var(--tw-text)]">
              {lang === 'ar' ? 'ملخص المخزون' : 'Inventory Summary'}
            </h3>
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--tw-border)] bg-[var(--tw-surface-alt)] p-4">
                <p className="text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'إجمالي قيمة المخزون' : 'Total Inventory Value'}</p>
                <p className="mt-1 text-2xl font-extrabold text-brand-500">{formatPrice(inventoryValue.data?.totalValue ?? 0, lang)}</p>
              </div>
              <div className="rounded-xl border border-[var(--tw-border)] bg-[var(--tw-surface-alt)] p-4">
                <p className="text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'إجمالي الوحدات' : 'Total Units'}</p>
                <p className="mt-1 text-2xl font-extrabold text-[var(--tw-text)]">{inventoryValue.data?.totalStock ?? 0}</p>
              </div>
              <div className="rounded-xl border border-[var(--tw-border)] bg-[var(--tw-surface-alt)] p-4">
                <p className="text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'منتجات مُتتبّعة' : 'Tracked Products'}</p>
                <p className="mt-1 text-2xl font-extrabold text-[var(--tw-text)]">{inventoryValue.data?.totalProducts ?? 0}</p>
              </div>
              {inventoryValueByCategory.data && inventoryValueByCategory.data.length > 0 && (
                <div className="rounded-xl border border-[var(--tw-border)] bg-[var(--tw-surface-alt)] p-4">
                  <p className="mb-2 text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'أعلى الفئات قيمة' : 'Top Categories by Value'}</p>
                  {inventoryValueByCategory.data.slice(0, 5).map((cat) => (
                    <div key={cat.categoryId} className="flex items-center justify-between py-1.5">
                      <span className="text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? cat.categoryName : (cat.categoryNameEn || cat.categoryName)}</span>
                      <span className="text-xs font-bold tabular-nums text-[var(--tw-text)]">{formatPrice(cat.totalValue, lang)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ INVENTORY SECTION ═══ */}
      <div className="mt-6">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <h3 className="mb-4 text-base font-bold tracking-tight text-[var(--tw-text)]">
              {lang === 'ar' ? 'المخزون' : 'Inventory'}
            </h3>

            {/* Summary KPIs */}
            {inventoryStats.isLoading ? (
              <Skeleton className="h-16" />
            ) : inventoryStats.data ? (
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                  <p className="text-2xl font-extrabold tabular-nums text-emerald-500">{inventoryStats.data.trackableProducts - inventoryStats.data.lowStockCount - inventoryStats.data.outOfStockCount}</p>
                  <p className="mt-0.5 text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'المخزون المتاح' : 'Available'}</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                  <p className="text-2xl font-extrabold tabular-nums text-amber-500">{inventoryStats.data.lowStockCount}</p>
                  <p className="mt-0.5 text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'مخزون منخفض' : 'Low Stock'}</p>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
                  <p className="text-2xl font-extrabold tabular-nums text-red-500">{inventoryStats.data.outOfStockCount}</p>
                  <p className="mt-0.5 text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'غير متوفر' : 'Out of Stock'}</p>
                </div>
              </div>
            ) : null}

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tw-text-muted)]" />
              <Input
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                placeholder={lang === 'ar' ? 'بحث عن منتج...' : 'Search products...'}
                className="ps-9"
              />
            </div>

            {/* Table */}
            {inventoryStats.isLoading ? (
              <Skeleton className="h-48" />
            ) : inventoryStats.data ? (() => {
              // Merge low-stock + out-of-stock + available into one list
              const lowMap = new Map(inventoryStats.data.lowStockProducts.map(p => [p._id, p]));
              const outMap = new Map(inventoryStats.data.outOfStockProducts.map(p => [p._id, p]));
              
              // Build full list from inventoryStats
              const allProducts: Array<{
                _id: string; name: string; nameEn: string; stockQuantity: number;
                lowStockThreshold: number; category: string; status: 'out' | 'low' | 'ok';
              }> = [];

              // Out of stock
              for (const p of outMap.values()) {
                allProducts.push({
                  _id: p._id, name: p.name, nameEn: p.nameEn,
                  stockQuantity: p.stockQuantity, lowStockThreshold: 0,
                  category: p.category, status: 'out',
                });
              }
              // Low stock
              for (const p of lowMap.values()) {
                if (!outMap.has(p._id)) {
                  allProducts.push({
                    _id: p._id, name: p.name, nameEn: p.nameEn,
                    stockQuantity: p.stockQuantity, lowStockThreshold: p.lowStockThreshold,
                    category: p.category, status: 'low',
                  });
                }
              }

              // Filter by search
              const filtered = inventorySearch.trim()
                ? allProducts.filter(p =>
                    p.name.includes(inventorySearch) ||
                    p.nameEn.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                    p.category.includes(inventorySearch)
                  )
                : allProducts;

              if (filtered.length === 0) {
                return (
                  <EmptyState
                    title={lang === 'ar' ? 'لا توجد منتجات لعرضها' : 'No products to display'}
                    icon={<Package className="h-10 w-10" />}
                  />
                );
              }

              return (
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>{lang === 'ar' ? 'اسم المنتج' : 'Product'}</Th>
                      <Th>{lang === 'ar' ? 'التصنيف' : 'Category'}</Th>
                      <Th>{lang === 'ar' ? 'الكمية المتاحة' : 'Stock'}</Th>
                      <Th>{lang === 'ar' ? 'الحالة' : 'Status'}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p._id} className="transition-colors hover:bg-[var(--tw-hover)]">
                        <Td className="font-bold text-[var(--tw-text)]">{p.name}</Td>
                        <Td className="text-[var(--tw-text-muted)]">{p.category || '—'}</Td>
                        <Td className="tabular-nums">{p.stockQuantity}</Td>
                        <Td>
                          {p.status === 'out' ? (
                            <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-400">
                              {lang === 'ar' ? 'غير متوفر' : 'Out of Stock'}
                            </span>
                          ) : p.status === 'low' ? (
                            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-400">
                              {lang === 'ar' ? 'منخفض' : 'Low'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-400">
                              {lang === 'ar' ? 'متوفر' : 'Available'}
                            </span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              );
            })() : null}
          </CardContent>
        </Card>
      </div>

      {/* ═══ RESET MODAL ═══ */}
      <Modal open={confirmClear} onClose={closeClearModal} title={t('admin.systemResetTitle')} size="sm">
        <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm leading-relaxed text-[var(--tw-text-muted)]">
          <p className="mb-2 font-bold text-red-400">⚠️ {t('admin.systemResetWarning')}</p>
          <p>{t('admin.systemResetConfirm')}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-bold text-red-400">{t('admin.systemResetClearTitle')}</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-[var(--tw-text-muted)]">
                {(t('admin.systemResetClearItems', { returnObjects: true }) as unknown as string[]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold text-emerald-400">{t('admin.systemResetKeepTitle')}</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-[var(--tw-text-muted)]">
                {(t('admin.systemResetKeepItems', { returnObjects: true }) as unknown as string[]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--tw-text-muted)]">
            {t('admin.systemResetTypeHint')}
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
            {t('admin.systemReset')}
          </Button>
        </div>
      </Modal>

      {/* ═══ SALES RESET MODAL ═══ */}
      <Modal open={confirmSalesReset} onClose={closeSalesResetModal} title={t('admin.salesResetTitle')} size="sm">
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-relaxed text-[var(--tw-text-muted)]">
          <p className="mb-2 font-bold text-amber-400">⚠️ {t('admin.salesResetWarning')}</p>
          <p>{t('admin.salesResetConfirm')}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-bold text-amber-400">{t('admin.salesResetClearTitle')}</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-[var(--tw-text-muted)]">
                <li>{lang === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</li>
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold text-emerald-400">{t('admin.salesResetKeepTitle')}</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-[var(--tw-text-muted)]">
                <li>{lang === 'ar' ? 'المنتجات' : 'Products'}</li>
                <li>{lang === 'ar' ? 'العملاء' : 'Customers'}</li>
                <li>{lang === 'ar' ? 'الطلبات' : 'Orders'}</li>
                <li>{lang === 'ar' ? 'المشتريات' : 'Purchases'}</li>
                <li>{lang === 'ar' ? 'الإيرادات' : 'Revenue'}</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--tw-text-muted)]">
            {t('admin.systemResetTypeHint')}
          </label>
          <Input
            value={salesResetTyped}
            onChange={(e) => setSalesResetTyped(e.target.value)}
            placeholder="RESET"
            dir="ltr"
            className="h-10 w-full font-mono text-center tracking-[0.3em]"
            autoComplete="off"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={closeSalesResetModal} disabled={salesResetMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={salesResetMutation.isPending}
            disabled={salesResetTyped.trim().toUpperCase() !== 'RESET'}
            onClick={() => salesResetMutation.mutate()}
          >
            {t('admin.salesReset')}
          </Button>
        </div>
      </Modal>

      <Modal open={confirmPurchasesReset} onClose={closePurchasesResetModal} title={t('admin.purchasesResetTitle')} size="sm">
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-relaxed text-[var(--tw-text-muted)]">
          <p className="mb-2 font-bold text-amber-400">⚠️ {t('admin.purchasesResetWarning')}</p>
          <p>{t('admin.purchasesResetConfirm')}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-bold text-amber-400">{t('admin.purchasesResetClearTitle')}</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-[var(--tw-text-muted)]">
                <li>{lang === 'ar' ? 'إجمالي المشتريات' : 'Total Purchases'}</li>
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold text-emerald-400">{t('admin.purchasesResetKeepTitle')}</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-[var(--tw-text-muted)]">
                <li>{lang === 'ar' ? 'المنتجات' : 'Products'}</li>
                <li>{lang === 'ar' ? 'العملاء' : 'Customers'}</li>
                <li>{lang === 'ar' ? 'الطلبات' : 'Orders'}</li>
                <li>{lang === 'ar' ? 'المبيعات' : 'Sales'}</li>
                <li>{lang === 'ar' ? 'الإيرادات' : 'Revenue'}</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--tw-text-muted)]">
            {t('admin.systemResetTypeHint')}
          </label>
          <Input
            value={purchasesResetTyped}
            onChange={(e) => setPurchasesResetTyped(e.target.value)}
            placeholder="RESET"
            dir="ltr"
            className="h-10 w-full font-mono text-center tracking-[0.3em]"
            autoComplete="off"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={closePurchasesResetModal} disabled={purchasesResetMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={purchasesResetMutation.isPending}
            disabled={purchasesResetTyped.trim().toUpperCase() !== 'RESET'}
            onClick={() => purchasesResetMutation.mutate()}
          >
            {t('admin.purchasesReset')}
          </Button>
        </div>
      </Modal>

      {/* ═══ RECENT ORDERS ═══ */}
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
                <tr key={o._id} className="transition-colors hover:hover:bg-[var(--tw-hover)]">
                  <Td className="font-bold text-[var(--tw-text)]">
                    <Link to="/admin/orders" className="hover:text-brand-400">
                      {o.orderNo}
                    </Link>
                  </Td>
                  <Td>{o.customerName}</Td>
                  <Td>{formatPrice(o.subtotal, lang)}</Td>
                  <Td className="font-bold text-[var(--tw-text)]">{formatPrice(o.total, lang)}</Td>
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

      {/* ═══ EXPORT MODAL ═══ */}
      {showExportModal && (
        <Modal open onClose={() => { setShowExportModal(false); setExportPreview(null); }} size="lg">
          <div className="w-full max-w-3xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[var(--tw-text)]">
              {lang === 'ar' ? 'تصدير تقرير حركة الأصناف' : 'Export Item Movement Report'}
            </h2>
            <p className="text-sm text-[var(--tw-text-muted)]">
              {lang === 'ar' ? 'تقرير مفصل عن كل منتج: المشتريات والمبيعات والمرتجعات والهدايا والفاقد' : 'Detailed report for every product: purchases, sales, returns, gifts, waste'}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setExportType('movement')}
                className={cn(
                  'flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
                  exportType === 'movement'
                    ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                    : 'border-[var(--tw-border-strong)] text-[var(--tw-text-muted)] hover:border-[var(--tw-border-strong)]',
                )}
              >
                {lang === 'ar' ? 'حركة الأصناف' : 'Item Movement'}
              </button>
              <button
                onClick={() => setExportType('summary')}
                className={cn(
                  'flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
                  exportType === 'summary'
                    ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                    : 'border-[var(--tw-border-strong)] text-[var(--tw-text-muted)] hover:border-[var(--tw-border-strong)]',
                )}
              >
                {lang === 'ar' ? 'ملخص المبيعات والمشتريات' : 'Sales & Purchases Summary'}
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--tw-text-muted)]">
                {lang === 'ar' ? 'فترة التقرير' : 'Reporting Period'}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  { key: 'today' as const, label: lang === 'ar' ? 'اليوم' : 'Today' },
                  { key: 'week' as const, label: lang === 'ar' ? 'هذا الأسبوع' : 'This Week' },
                  { key: 'month' as const, label: lang === 'ar' ? 'هذا الشهر' : 'This Month' },
                  { key: 'custom' as const, label: lang === 'ar' ? 'فترة مخصصة' : 'Custom Range' },
                ]).map((p) => (
                  <button
                    key={p.key}
                    onClick={() => { setExportPeriod(p.key); setExportPreview(null); }}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                      exportPeriod === p.key
                        ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                        : 'border-[var(--tw-border-strong)] text-[var(--tw-text-muted)] hover:border-[var(--tw-border-strong)]',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {exportPeriod === 'custom' && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-bold text-[var(--tw-text-muted)]">
                    {lang === 'ar' ? 'من تاريخ' : 'Start Date'}
                  </label>
                  <Input type="date" value={exportCustomStart} onChange={(e) => { setExportCustomStart(e.target.value); setExportPreview(null); }} className="w-full" />
                </div>
                <span className="mt-5 text-[var(--tw-text-muted)]">→</span>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-bold text-[var(--tw-text-muted)]">
                    {lang === 'ar' ? 'إلى تاريخ' : 'End Date'}
                  </label>
                  <Input type="date" value={exportCustomEnd} onChange={(e) => { setExportCustomEnd(e.target.value); setExportPreview(null); }} className="w-full" />
                </div>
              </div>
            )}

            {exportType === 'movement' && (
              <Button
                variant="outline"
                onClick={loadPreview}
                loading={previewLoading}
                disabled={exportPeriod === 'custom' && (!exportCustomStart || !exportCustomEnd)}
                className="w-full"
              >
                {lang === 'ar' ? 'معاينة التقرير' : 'Preview Report'}
              </Button>
            )}

            {exportPreview && (
              <div className="max-h-64 overflow-auto rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)]/50 p-4">
                <p className="mb-2 text-xs font-bold text-[var(--tw-text-muted)]">
                  {lang === 'ar' ? 'ملخص التقرير' : 'Report Summary'}
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-[var(--tw-surface-alt)] p-2">
                    <p className="text-[var(--tw-text-muted)]">{lang === 'ar' ? 'المنتجات' : 'Products'}</p>
                    <p className="text-lg font-bold text-[var(--tw-text)]">{exportPreview.summary.length}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--tw-surface-alt)] p-2">
                    <p className="text-[var(--tw-text-muted)]">{lang === 'ar' ? 'الحركات' : 'Movements'}</p>
                    <p className="text-lg font-bold text-[var(--tw-text)]">{exportPreview.details.length}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--tw-surface-alt)] p-2">
                    <p className="text-[var(--tw-text-muted)]">{lang === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {formatPrice(exportPreview.summary.reduce((a, p) => a + p.totalSalesRevenue, 0), lang)}
                    </p>
                  </div>
                </div>
                {exportPreview.summary.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-bold text-[var(--tw-text-muted)]">
                      {lang === 'ar' ? 'أعلى المنتجات' : 'Top Products'}
                    </p>
                    <div className="space-y-1">
                      {exportPreview.summary.slice(0, 5).map((item) => (
                        <div key={`${item.productId}-${item.productSize}`} className="flex items-center justify-between text-xs">
                          <span className="text-[var(--tw-text-muted)]">
                            {item.productName}
                            {item.productSize ? ` (${item.productSize})` : ''}
                          </span>
                          <span className="text-[var(--tw-text-muted)]">
                            {item.totalSold} {lang === 'ar' ? 'مباع' : 'sold'}
                            {item.totalSalesRevenue > 0 ? ` · ${formatPrice(item.totalSalesRevenue, lang)}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowExportModal(false);
                  setExportPreview(null);
                  exportMutation.mutate();
                }}
                loading={exportMutation.isPending}
                disabled={exportPeriod === 'custom' && (!exportCustomStart || !exportCustomEnd)}
                className="flex-1"
              >
                <Download className="h-4 w-4" />
                {lang === 'ar' ? 'تحميل Excel' : 'Download Excel'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowExportModal(false)}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
