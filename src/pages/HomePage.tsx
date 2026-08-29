import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, Leaf, Phone, Star, Tag, Truck, ChevronLeft } from 'lucide-react';
import { getBestSellers, listProducts } from '@/api/products';
import { getActiveOffers } from '@/api/offers';
import { getRestaurantStats } from '@/api/reviews';
import { ProductCard } from '@/components/product/ProductCard';
import { OfferCard } from '@/components/offer/OfferCard';
import { ReviewPrompt } from '@/components/review/ReviewPrompt';
import { StarRating } from '@/components/review/StarRating';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export function HomePage() {
  const { t } = useTranslation();

  const bestSellers = useQuery({ queryKey: ['products', 'best-sellers'], queryFn: getBestSellers });
  const offers = useQuery({ queryKey: ['offers', 'active'], queryFn: getActiveOffers });
  const restaurantRating = useQuery({ queryKey: ['reviews', 'restaurant'], queryFn: getRestaurantStats });
  const productsCount = useQuery({
    queryKey: ['products', 'count'],
    queryFn: () => listProducts({ limit: 1 }).then((p) => p.total),
  });

  const features = [
    { icon: Leaf, title: t('home.whyDough'), desc: t('home.whyDoughDesc') },
    { icon: Leaf, title: t('home.whyIngredients'), desc: t('home.whyIngredientsDesc') },
    { icon: Truck, title: t('home.whyDelivery'), desc: t('home.whyDeliveryDesc') },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[var(--tw-bg)] via-[var(--tw-surface)] to-[var(--tw-bg)]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 20% 0%, rgba(99,102,241,0.12), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(34,197,94,0.08), transparent 50%)',
          }}
        />
        <div className="container-px relative grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div className="animate-slide-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-sm font-semibold text-brand-500">
              <Leaf className="h-4 w-4" />
              {t('hero.badge')}
            </span>
            <h1 className="mt-5 text-3xl font-extrabold leading-tight text-[var(--tw-text)] sm:text-4xl lg:text-5xl">
              {t('hero.title')}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--tw-text-muted)]">{t('hero.subtitle')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/menu">
                <Button variant="fresh" size="lg">
                  {t('hero.ctaMenu')}
                  <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
                </Button>
              </Link>
              <Link to="/offers">
                <Button variant="outline" size="lg">
                  {t('hero.ctaOffers')}
                </Button>
              </Link>
            </div>
            <div className="mt-10 grid max-w-md grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-extrabold text-fresh-500">
                  {productsCount.isLoading ? (
                    <Skeleton className="mx-auto inline-block h-9 w-12 align-middle" />
                  ) : (
                    productsCount.data ?? 0
                  )}
                </div>
                <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{t('hero.statItems')}</p>
              </div>
              <div className="text-center">
                <p className="flex items-center justify-center gap-1 text-2xl font-extrabold text-fresh-500">
                  <Clock className="h-5 w-5" />30
                </p>
                <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{t('hero.statDelivery')}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-extrabold text-fresh-500">
                  <Star className="h-5 w-5 fill-current" />
                  {restaurantRating.isLoading ? (
                    <Skeleton className="inline-block h-9 w-12 align-middle" />
                  ) : (
                    (restaurantRating.data?.average ?? 0).toFixed(1)
                  )}
                </div>
                <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{t('hero.statRating')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ReviewPrompt />

      {/* Rating Bar */}
      <section className="border-y border-[var(--tw-border)] bg-[var(--tw-surface-alt)]">
        <div className="container-px flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-[var(--tw-text)]">
            <span className="flex text-fresh-500">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-4 w-4',
                    i < Math.round(restaurantRating.data?.average ?? 0) ? 'fill-current' : 'text-[var(--tw-border-strong)]',
                  )}
                />
              ))}
            </span>
            {t('review.restaurantRating')}
          </span>
          <span className="hidden text-[var(--tw-border-strong)] sm:block">|</span>
          <span className="text-sm text-[var(--tw-text-muted)]">
            {restaurantRating.data && restaurantRating.data.total > 0
              ? t('review.basedOn', { count: restaurantRating.data.total })
              : t('review.noReviews')}
          </span>
          {restaurantRating.data && restaurantRating.data.total > 0 ? (
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--tw-text)]">
              <StarRating value={Math.round(restaurantRating.data.average)} readOnly size="sm" ariaLabel={t('review.restaurantRating')} />
              <span dir="ltr">{restaurantRating.data.average.toFixed(1)}</span>
            </span>
          ) : null}
        </div>
      </section>

      {/* Offers */}
      <section className="container-px py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-[var(--tw-text)] sm:text-3xl">{t('home.deals')}</h2>
            <p className="mt-1 text-sm text-[var(--tw-text-muted)]">{t('offers.subtitle')}</p>
          </div>
          <Link to="/offers" className="hidden items-center gap-1 text-sm font-bold text-brand-500 hover:text-brand-400 sm:flex">
            {t('common.viewAll')}
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>
        {offers.isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        ) : offers.isError ? (
          <ErrorState title={t('misc.error')} hint={t('misc.loadError')} onRetry={() => offers.refetch()} retryLabel={t('misc.retry')} />
        ) : !offers.data || offers.data.length === 0 ? (
          <EmptyState
            icon={<Tag className="h-10 w-10" />}
            title={t('offers.empty')}
            hint={t('offers.emptyHint')}
            action={
              <Link to="/menu">
                <Button variant="fresh">{t('offers.browseMenu')}</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {offers.data.map((offer) => (
              <OfferCard key={offer._id} offer={offer} />
            ))}
          </div>
        )}
      </section>

      {/* Best Sellers */}
      <section className="bg-[var(--tw-surface-alt)] py-16">
        <div className="container-px">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-[var(--tw-text)] sm:text-3xl">{t('home.bestSellers')}</h2>
          </div>
          {bestSellers.isLoading ? (
            <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-[min(92%,26rem)] sm:w-full">
                  <Skeleton className="aspect-4/5" />
                </div>
              ))}
            </div>
          ) : bestSellers.isError ? (
            <ErrorState title={t('misc.error')} hint={t('misc.loadError')} onRetry={() => bestSellers.refetch()} retryLabel={t('misc.retry')} />
          ) : (
            <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {bestSellers.data?.map((product) => (
                <div key={product._id} className="w-[min(92%,26rem)] sm:w-full">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="container-px grid gap-6 py-16 md:grid-cols-3">
        {features.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-2xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] p-7 text-center transition-all duration-200 hover:border-brand-500/40 hover:shadow-lg hover:shadow-black/5"
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
              <Icon className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-base font-bold text-[var(--tw-text)]">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--tw-text-muted)]">{desc}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="container-px pb-16">
        <div className="relative overflow-hidden rounded-3xl border border-brand-700/30 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-10 text-center md:p-16">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl md:text-4xl">{t('home.ctaTitle')}</h2>
          <p className="mt-3 text-base text-white/70">{t('home.ctaSubtitle')}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link to="/menu">
              <Button variant="fresh" size="lg">
                {t('home.ctaOrder')}
              </Button>
            </Link>
            <Link to="/branches">
              <Button variant="ghost" size="lg" className="border border-white/30 text-white hover:bg-white/10">
                <Phone className="h-5 w-5" />
                {t('common.contactUs')}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
