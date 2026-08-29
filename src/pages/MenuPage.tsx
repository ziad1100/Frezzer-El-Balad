import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { listCategories, listProducts } from '@/api/products';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductSearch, type SearchableProduct } from '@/components/ProductSearch';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { Category, Product } from '@/types';

const ALL_LIMIT = 300;
const PAGE_SIZE = 12;

interface MenuGroup {
  section: Category;
  items: Product[];
  subs: { sub: Category; items: Product[] }[];
}

export function MenuPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const lang = i18n.language;

  const activeCategory = searchParams.get('category') ?? '';
  const offersOnly = searchParams.get('offers') === '1';

  const categories = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const sections = useMemo(() => (categories.data ?? []).filter((c) => c.type === 'section'), [categories.data]);

  const subsBySection = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of categories.data ?? []) {
      if (c.type === 'sub' && c.parentId) {
        const list = map.get(c.parentId) ?? [];
        list.push(c);
        map.set(c.parentId, list);
      }
    }
    return map;
  }, [categories.data]);

  const products = useQuery({
    queryKey: ['products', { search, offers: offersOnly ? 1 : 0 }],
    queryFn: () => listProducts({ limit: ALL_LIMIT, search: search || undefined, offer: offersOnly || undefined }),
  });

  const setCategory = (id: string): void => {
    setSearchParams(id ? { category: id } : {});
    setPage(1);
  };

  const grouped = useMemo<MenuGroup[]>(() => {
    const data = products.data?.items ?? [];
    const subById = new Map((categories.data ?? []).filter((c) => c.type === 'sub').map((c) => [c._id, c]));
    const groups = new Map<string, MenuGroup>();
    for (const s of sections) groups.set(s._id, { section: s, items: [], subs: [] });

    for (const p of data) {
      const sub = subById.get(p.category);
      if (sub?.parentId) {
        const g = groups.get(sub.parentId);
        if (!g) continue;
        let sg = g.subs.find((x) => x.sub._id === sub._id);
        if (!sg) { sg = { sub, items: [] }; g.subs.push(sg); }
        sg.items.push(p);
      } else if (sections.some((s) => s._id === p.category)) {
        groups.get(p.category)?.items.push(p);
      }
    }

    return sections
      .map((s) => {
        const g = groups.get(s._id) as MenuGroup;
        g.subs.sort((a, b) => a.sub.order - b.sub.order || a.sub._id.localeCompare(b.sub._id));
        g.subs = g.subs.filter((sg) => sg.items.length > 0);
        return g;
      })
      .filter((g) => g.items.length > 0 || g.subs.length > 0);
  }, [products.data, sections, categories.data]);

  const activeSection = useMemo(() => sections.find((s) => s._id === activeCategory), [sections, activeCategory]);

  const activeSub = useMemo(() => {
    if (activeSection || !activeCategory) return undefined;
    for (const s of sections) {
      const sub = (subsBySection.get(s._id) ?? []).find((c) => c._id === activeCategory);
      if (sub) return sub;
    }
    return undefined;
  }, [sections, subsBySection, activeCategory, activeSection]);

  const viewGroups = useMemo(() => {
    let groups = grouped;
    if (activeSub) {
      groups = grouped
        .filter((g) => g.section._id === activeSub.parentId)
        .map((g) => ({ ...g, items: [], subs: g.subs.filter((x) => x.sub._id === activeSub._id) }));
    } else if (activeSection) {
      groups = grouped.filter((g) => g.section._id === activeSection._id);
    }
    return groups.filter((g) => g.items.length > 0 || g.subs.some((sg) => sg.items.length > 0));
  }, [grouped, activeSection, activeSub]);

  const flatItems = useMemo(
    () => viewGroups.flatMap((g) => [
      ...g.items.map((product) => ({ section: g.section, sub: null as Category | null, product })),
      ...g.subs.flatMap((sg) => sg.items.map((product) => ({ section: g.section, sub: sg.sub, product }))),
    ]),
    [viewGroups],
  );

  const totalPages = Math.max(1, Math.ceil(flatItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => flatItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [flatItems, safePage]);

  const pageGroups = useMemo<MenuGroup[]>(() => {
    const groups = new Map<string, MenuGroup>();
    for (const it of pageItems) {
      let g = groups.get(it.section._id);
      if (!g) { g = { section: it.section, items: [], subs: [] }; groups.set(it.section._id, g); }
      if (it.sub) {
        let sg = g.subs.find((x) => x.sub._id === it.sub!._id);
        if (!sg) { sg = { sub: it.sub, items: [] }; g.subs.push(sg); }
        sg.items.push(it.product);
      } else {
        g.items.push(it.product);
      }
    }
    return [...groups.values()];
  }, [pageItems]);

  const sectionsWithProducts = useMemo(() => new Set(grouped.map((g) => g.section._id)), [grouped]);

  const visibleSections = useMemo(() => {
    if (!products.data || sectionsWithProducts.size === 0) return sections;
    return sections.filter((s) => sectionsWithProducts.has(s._id));
  }, [sections, sectionsWithProducts, products.data]);

  const activeSectionSubs = useMemo(() => {
    const subs = subsBySection.get(activeSection?._id ?? '') ?? [];
    if (!products.data || grouped.length === 0) return subs;
    const withProducts = new Set(grouped.find((g) => g.section._id === activeSection?._id)?.subs.map((x) => x.sub._id) ?? []);
    return subs.filter((s) => withProducts.has(s._id));
  }, [subsBySection, activeSection, grouped, products.data]);

  const activeSectionId = activeSection?._id ?? activeSub?.parentId ?? '';
  const categoryName = (c: Category): string => (lang === 'ar' ? c.name : c.nameEn || c.name);

  // Count products per section for tab badges
  const sectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of grouped) {
      const total = g.items.length + g.subs.reduce((sum, sg) => sum + sg.items.length, 0);
      counts.set(g.section._id, total);
    }
    return counts;
  }, [grouped]);

  const totalProducts = useMemo(() => flatItems.length, [flatItems]);

  const searchMenuProducts = useCallback(async (q: string): Promise<SearchableProduct[]> => {
    const res = await listProducts({ limit: 20, search: q || undefined });
    return res.items.map((p) => ({
      _id: p._id, name: p.name, nameEn: p.nameEn, basePrice: p.basePrice,
      images: p.images, isAvailable: p.isAvailable, category: null, sizes: p.sizes,
    }));
  }, []);

  const productGrid = (items: Product[]) => (
    <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {items.map((product) => (
        <div key={product._id} className="w-[min(92%,26rem)] sm:w-full">
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <section className="border-b border-[var(--tw-border)] bg-[var(--tw-surface-alt)] py-10">
        <div className="container-px">
          <h1 className="text-2xl font-extrabold text-[var(--tw-text)] sm:text-3xl">{t('menu.title')}</h1>
          <p className="mt-1 text-sm text-[var(--tw-text-muted)]">{t('menu.subtitle')}</p>
          <div className="mt-6 max-w-md">
            <ProductSearch
              onSelect={(product) => {
                const name = lang === 'ar' ? product.name : product.nameEn || product.name;
                setSearch(name);
                setPage(1);
              }}
              onQueryChange={(q) => { setSearch(q); setPage(1); }}
              searchFn={searchMenuProducts}
              placeholder={t('menu.searchPlaceholder')}
            />
          </div>
        </div>
      </section>

      <section className="container-px py-6">
        {/* Category Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setCategory('')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150',
              !activeCategory
                ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/20'
                : 'border border-[var(--tw-border-strong)] bg-[var(--tw-card-bg)] text-[var(--tw-text-muted)] hover:border-brand-500/40 hover:text-[var(--tw-text)]',
            )}
          >
            {t('common.all')}
            <span className={cn(
              'ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              !activeCategory ? 'bg-white/20' : 'bg-[var(--tw-surface-alt)]',
            )}>
              {totalProducts}
            </span>
          </button>
          {visibleSections.map((section) => {
            const count = sectionCounts.get(section._id) ?? 0;
            const isActive = activeSectionId === section._id;
            return (
              <button
                key={section._id}
                onClick={() => setCategory(section._id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150',
                  isActive
                    ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/20'
                    : 'border border-[var(--tw-border-strong)] bg-[var(--tw-card-bg)] text-[var(--tw-text-muted)] hover:border-brand-500/40 hover:text-[var(--tw-text)]',
                )}
              >
                {categoryName(section)}
                {count > 0 && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    isActive ? 'bg-white/20' : 'bg-[var(--tw-surface-alt)]',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sub-category Tabs */}
        {activeSection && activeSectionSubs.length > 0 ? (
          <div className="mb-6 flex flex-wrap gap-2">
            {activeSectionSubs.map((sub) => (
              <button
                key={sub._id}
                onClick={() => setCategory(sub._id)}
                className={cn(
                  'rounded-xl border px-4 py-2 text-xs font-medium transition-all duration-150',
                  activeCategory === sub._id
                    ? 'border-brand-500 bg-brand-500/10 text-brand-500 shadow-sm shadow-brand-500/5'
                    : 'border-[var(--tw-border-strong)] bg-[var(--tw-card-bg)] text-[var(--tw-text-muted)] hover:border-brand-500/40 hover:text-brand-500',
                )}
              >
                {categoryName(sub)}
              </button>
            ))}
          </div>
        ) : null}

        {/* Product Grid */}
        {products.isLoading ? (
          <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="w-[min(92%,26rem)] sm:w-full">
                <Skeleton className="aspect-[4/5]" />
              </div>
            ))}
          </div>
        ) : products.isError ? (
          <ErrorState title={t('misc.error')} hint={t('misc.loadError')} onRetry={() => products.refetch()} retryLabel={t('misc.retry')} />
        ) : pageGroups.length === 0 ? (
          <EmptyState title={t('menu.noResults')} icon={<Search className="h-14 w-14" />} />
        ) : (
          <>
            <div className="space-y-14">
              {pageGroups.map((group) => (
                <section key={group.section._id}>
                  <h2 className="mb-6 flex items-center gap-3 text-2xl font-extrabold text-[var(--tw-text)]">
                    <span className="h-7 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
                    {categoryName(group.section)}
                  </h2>
                  {group.items.length > 0 ? productGrid(group.items) : null}
                  {group.subs.map((subGroup) => {
                    const showSubTitle = group.subs.length > 1 || group.items.length > 0;
                    return (
                      <div key={subGroup.sub._id} className="mt-9 first:mt-0">
                        {showSubTitle ? (
                          <h3 className="mb-4 text-lg font-bold text-[var(--tw-text)]">
                            {categoryName(subGroup.sub)}
                          </h3>
                        ) : null}
                        {productGrid(subGroup.items)}
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
            {totalPages > 1 ? (
              <div className="mt-10 flex items-center justify-center gap-3">
                <Button variant="outline" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                  {t('common.back')}
                </Button>
                <span className="text-sm font-bold text-[var(--tw-text-muted)]">
                  {safePage} / {totalPages}
                </span>
                <Button variant="outline" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  {t('common.next')}
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
