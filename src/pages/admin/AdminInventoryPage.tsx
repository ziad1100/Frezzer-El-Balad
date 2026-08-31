import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Package, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { getInventoryStats, adminListProducts, toggleProduct, getSalesStats } from '@/api/admin';
import { Card, CardContent, EmptyState, ErrorState, Skeleton } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PageHeader, StatusBadge, TableWrap, Td, Th, ToggleSwitch } from '@/components/admin/primitives';
import { formatPrice } from '@/lib/utils';
import type { Product } from '@/types';

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

export function AdminInventoryPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');

  const queryClient = useQueryClient();
  const stats = useQuery({ queryKey: ['admin', 'inventory'], queryFn: getInventoryStats });
  const salesStats = useQuery({ queryKey: ['admin', 'inventory-sales'], queryFn: () => getSalesStats() });
  const products = useQuery({
    queryKey: ['admin', 'products', { page: 1, limit: 200 }],
    queryFn: () => adminListProducts({ page: 1, limit: 200 }),
  });

  const toggleMutation = useMutation({
    mutationFn: toggleProduct,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      toast.success(lang === 'ar' ? 'تم تحديث الحالة' : 'Status updated');
    },
    onError: () => toast.error(lang === 'ar' ? 'فشل تحديث الحالة' : 'Failed to update status'),
  });

  type ItemStatus = 'active' | 'inactive';

  // Build a lookup of sales data by product name for quick access
  const salesByProduct = new Map<string, { totalQuantity: number; totalRevenue: number }>();
  for (const sp of salesStats.data?.byProduct ?? []) {
    const existing = salesByProduct.get(sp.productId) ?? { totalQuantity: 0, totalRevenue: 0 };
    existing.totalQuantity += sp.totalQuantity;
    existing.totalRevenue += sp.totalRevenue;
    salesByProduct.set(sp.productId, existing);
  }

  const items = (products.data?.items ?? []).map((p) => {
    const sizes = (p as Product & { sizes?: Array<{ name: string; nameEn?: string; price: number; stockQuantity?: number }> }).sizes ?? [];
    const status: ItemStatus = p.isAvailable ? 'active' : 'inactive';
    const stockQty = (p as Product).stockQuantity ?? 0;
    const hasSizes = sizes.length > 0;
    // Calculate effective stock: if product has sizes, sum size stocks; otherwise use product-level stock
    const effectiveStock = hasSizes
      ? sizes.reduce((sum, s) => sum + (s.stockQuantity ?? 0), 0)
      : stockQty;
    // Inventory value = current stock × unit price
    const unitPrice = p.basePrice;
    const inventoryValue = effectiveStock * unitPrice;
    const sales = salesByProduct.get(p._id) ?? { totalQuantity: 0, totalRevenue: 0 };
    return { ...p, sizes, status, effectiveStock, unitPrice, inventoryValue, salesQuantity: sales.totalQuantity, salesRevenue: sales.totalRevenue, hasSizes };
  });

  const filtered = items.filter((p) => {
    const nameMatch = !search || p.name.includes(search) || (p.nameEn?.toLowerCase().includes(search.toLowerCase()));
    if (!nameMatch) return false;
    if (filter === 'in_stock') return p.status === 'active' && p.effectiveStock > 0;
    if (filter === 'out_of_stock') return p.effectiveStock <= 0;
    if (filter === 'low_stock') {
      // Low stock: active product with stock > 0 and ≤ lowStockThreshold
      const threshold = (p as Product).lowStockThreshold ?? 10;
      return p.status === 'active' && p.effectiveStock > 0 && p.effectiveStock <= threshold;
    }
    return true;
  });

  return (
    <div>
      <PageHeader title={lang === 'ar' ? 'المخزون' : 'Inventory'} />

      {/* Summary KPIs */}
      {stats.isLoading ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : stats.data ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Card variant="interactive">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-[var(--tw-text)]">{stats.data.trackableProducts}</p>
              <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'إجمالي المنتجات' : 'Total Products'}</p>
            </CardContent>
          </Card>
          <Card variant="interactive">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-[var(--tw-text)]">{stats.data.totalStockQuantity}</p>
              <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'إجمالي المخزون' : 'Total Stock'}</p>
            </CardContent>
          </Card>
          <Card variant="interactive">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-emerald-500">
                {stats.data.trackableProducts - stats.data.lowStockCount - stats.data.outOfStockCount}
              </p>
              <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'المخزون المتاح' : 'In Stock'}</p>
            </CardContent>
          </Card>
          <Card variant="interactive">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-amber-500">{stats.data.lowStockCount}</p>
              <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'مخزون منخفض' : 'Low Stock'}</p>
            </CardContent>
          </Card>
          <Card variant="interactive">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-red-500">{stats.data.outOfStockCount}</p>
              <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'غير متوفر' : 'Out of Stock'}</p>
            </CardContent>
          </Card>
          <Card variant="interactive">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-brand-500">
                {formatPrice(salesStats.data?.salesValue ?? 0, lang)}
              </p>
              <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</p>
            </CardContent>
          </Card>
          <Card variant="interactive">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-[var(--tw-text)]">
                {salesStats.data?.salesQuantity ?? 0}
              </p>
              <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'الكمية المباعة' : 'Units Sold'}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tw-text-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث عن منتج...' : 'Search products...'}
            className="ps-9"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'in_stock', 'low_stock', 'out_of_stock'] as StockFilter[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === 'all' && (lang === 'ar' ? 'الكل' : 'All')}
              {f === 'in_stock' && (lang === 'ar' ? 'متوفر' : 'In Stock')}
              {f === 'low_stock' && (lang === 'ar' ? 'منخفض' : 'Low')}
              {f === 'out_of_stock' && (lang === 'ar' ? 'غير متوفر' : 'Out')}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {products.isLoading ? (
        <Skeleton className="h-64" />
      ) : products.isError ? (
        <ErrorState title={lang === 'ar' ? 'خطأ في التحميل' : 'Load error'} onRetry={() => products.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title={lang === 'ar' ? 'لا توجد منتجات' : 'No products found'}
        />
      ) : (
        <Card>
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--tw-border)] text-start text-xs font-semibold uppercase tracking-wider text-[var(--tw-text-muted)]">
                  <Th>{lang === 'ar' ? 'المنتج' : 'Product'}</Th>
                  <Th>{lang === 'ar' ? 'السعر' : 'Price'}</Th>
                  <Th>{lang === 'ar' ? 'الحجم / المخزون' : 'Size / Stock'}</Th>
                  <Th>{lang === 'ar' ? 'المخزون' : 'Stock'}</Th>
                  <Th>{lang === 'ar' ? 'قيمة المخزون' : 'Inventory Value'}</Th>
                  <Th>{lang === 'ar' ? 'المبيعات' : 'Sales'}</Th>
                  <Th>{lang === 'ar' ? 'الفئة' : 'Category'}</Th>
                  <Th>{lang === 'ar' ? 'الحالة' : 'Status'}</Th>
                  <Th>{lang === 'ar' ? 'تفعيل' : 'Toggle'}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--tw-border)]">
                {filtered.map((p) => (
                  <tr key={p._id} className="hover:bg-[var(--tw-surface-alt)] transition-colors">
                    <Td>
                      <div className="flex items-center gap-3">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--tw-surface)]">
                            <Package className="h-4 w-4 text-[var(--tw-text-subtle)]" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-[var(--tw-text)]">{lang === 'ar' ? p.name : (p.nameEn || p.name)}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="font-bold text-[var(--tw-text)]">{formatPrice(p.basePrice, lang)}</Td>
                    <Td>
                      {p.sizes.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {p.sizes.map((s, i) => (
                            <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-[var(--tw-border)] bg-[var(--tw-surface)] px-2 py-1 text-xs font-medium text-[var(--tw-text-muted)]">
                              {lang === 'ar' ? s.name : (s.nameEn || s.name)}
                              <span className="text-[var(--tw-text-subtle)]">({s.stockQuantity ?? 0})</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--tw-text-muted)]">—</span>
                      )}
                    </Td>
                    <Td>
                      <span className={`font-bold tabular-nums ${
                        p.effectiveStock <= 0 ? 'text-red-500' : p.effectiveStock <= ((p as Product).lowStockThreshold ?? 10) ? 'text-amber-500' : 'text-emerald-500'
                      }`}>{p.effectiveStock}</span>
                    </Td>
                    <Td className="font-bold tabular-nums text-[var(--tw-text)]">{formatPrice(p.inventoryValue, lang)}</Td>
                    <Td>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold tabular-nums text-[var(--tw-text)]">
                          <ShoppingCart className="inline h-3 w-3 me-1 opacity-50" />{p.salesQuantity}
                        </span>
                        <span className="text-xs text-[var(--tw-text-muted)]">{formatPrice(p.salesRevenue, lang)}</span>
                      </div>
                    </Td>
                    <Td className="text-[var(--tw-text-muted)]">
                      {typeof p.category === 'object' && p.category !== null
                        ? (lang === 'ar' ? (p.category as { name: string }).name : ((p.category as { nameEn?: string }).nameEn || (p.category as { name: string }).name))
                        : '—'}
                    </Td>
                    <Td>
                      <StatusBadge status={p.isAvailable ? 'active' : 'inactive'} />
                    </Td>
                    <Td>
                      <ToggleSwitch
                        checked={p.isAvailable}
                        onChange={() => toggleMutation.mutate(p._id)}
                        disabled={toggleMutation.isPending}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}
    </div>
  );
}
