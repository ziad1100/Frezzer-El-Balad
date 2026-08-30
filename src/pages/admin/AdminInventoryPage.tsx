import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, Package } from 'lucide-react';
import { getInventoryStats, adminListProducts } from '@/api/admin';
import { Card, CardContent, EmptyState, ErrorState, Skeleton } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PageHeader, StatusBadge, TableWrap, Td, Th } from '@/components/admin/primitives';
import { formatPrice } from '@/lib/utils';
import type { Product } from '@/types';

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

export function AdminInventoryPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');

  const stats = useQuery({ queryKey: ['admin', 'inventory'], queryFn: getInventoryStats });
  const products = useQuery({
    queryKey: ['admin', 'products', { page: 1, limit: 200 }],
    queryFn: () => adminListProducts({ page: 1, limit: 200 }),
  });

  type ItemStatus = 'active' | 'inactive';

  const items = (products.data?.items ?? []).map((p) => {
    const sizes = (p as Product & { sizes?: Array<{ name: string; nameEn?: string; price: number }> }).sizes ?? [];
    const status: ItemStatus = p.isAvailable ? 'active' : 'inactive';
    return { ...p, sizes, status };
  });

  const filtered = items.filter((p) => {
    const nameMatch = !search || p.name.includes(search) || (p.nameEn?.toLowerCase().includes(search.toLowerCase()));
    if (!nameMatch) return false;
    if (filter === 'in_stock') return p.status === 'active';
    if (filter === 'out_of_stock') return p.status === 'inactive';
    return true;
  });

  return (
    <div>
      <PageHeader title={lang === 'ar' ? 'المخزون' : 'Inventory'} />

      {/* Summary KPIs */}
      {stats.isLoading ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : stats.data ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card variant="interactive">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-[var(--tw-text)]">{stats.data.trackableProducts}</p>
              <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'إجمالي المنتجات' : 'Total Products'}</p>
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
                  <Th>{lang === 'ar' ? 'الحجم' : 'Size'}</Th>
                  <Th>{lang === 'ar' ? 'الفئة' : 'Category'}</Th>
                  <Th>{lang === 'ar' ? 'الحالة' : 'Status'}</Th>
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
                            <span key={i} className="inline-flex items-center rounded-lg border border-[var(--tw-border)] bg-[var(--tw-surface)] px-2 py-1 text-xs font-medium text-[var(--tw-text-muted)]">
                              {lang === 'ar' ? s.name : (s.nameEn || s.name)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--tw-text-muted)]">—</span>
                      )}
                    </Td>
                    <Td className="text-[var(--tw-text-muted)]">
                      {typeof p.category === 'object' && p.category !== null
                        ? (lang === 'ar' ? (p.category as { name: string }).name : ((p.category as { nameEn?: string }).nameEn || (p.category as { name: string }).name))
                        : '—'}
                    </Td>
                    <Td>
                      <StatusBadge status={p.isAvailable ? 'active' : 'inactive'} />
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
