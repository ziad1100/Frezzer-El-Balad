import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, Leaf, Phone, Star, Tag, Truck } from 'lucide-react';
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
      <section className="relative overflow-hidden bg-gradient-to-br from-night-950 via-night-900 to-night-950">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 20% 0%, rgba(37,99,235,0.12), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(34,197,94,0.08), transparent 50%)',
          }}
        />
        <div className="container-px relative grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div className="animate-slide-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-sm font-semibold text-brand-400">
              <Leaf className="h-4 w-4" />
              {t('hero.badge')}
            </span>
            <h1 className="mt-5 text-3xl font-extrabold leading-tight text-night-50 sm:text-4xl lg:text-5xl">
              {t('hero.title')}
            </h1>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-night-300">{t('hero.subtitle')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/menu">
                <Button variant="gold" size="lg">
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
            <div className="mt-10 grid max-w-md grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-extrabold text-gold-500">
                  {productsCount.isLoading ? (
                    <Skeleton className="mx-auto inline-block h-9 w-12 align-middle" />
                  ) : (
                    productsCount.data ?? 0
                  )}
                </div>
                <p className="mt-1 text-xs text-night-400">{t('hero.statItems')}</p>
              </div>
              <div className="text-center">
                <p className="flex items-center justify-center gap-1 text-2xl font-extrabold text-gold-500">
                  <Clock className="h-5 w-5" />30
                </p>
                <p className="mt-1 text-xs text-night-400">{t('hero.statDelivery')}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-extrabold text-gold-500">
                  <Star className="h-5 w-5 fill-current" />
                  {restaurantRating.isLoading ? (
                    <Skeleton className="inline-block h-9 w-12 align-middle" />
                  ) : (
                    (restaurantRating.data?.average ?? 0).toFixed(1)
                  )}
                </div>
                <p className="mt-1 text-xs text-night-400">{t('hero.statRating')}</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      <ReviewPrompt />

      <section className="border-y border-night-800/60 bg-night-900/40">
        <div className="container-px flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-night-200">
            <span className="flex text-gold-500">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-4 w-4',
                    i < Math.round(restaurantRating.data?.average ?? 0) ? 'fill-current' : 'text-night-600',
                  )}
                />
              ))}
            </span>
            {t('review.restaurantRating')}
          </span>
          <span className="hidden text-night-600 sm:block">|</span>
          <span className="text-sm text-night-400">
            {restaurantRating.data && restaurantRating.data.total > 0
              ? t('review.basedOn', { count: restaurantRating.data.total })
              : t('review.noReviews')}
          </span>
          {restaurantRating.data && restaurantRating.data.total > 0 ? (
            <span className="flex items-center gap-2 text-sm font-semibold text-night-200">
              <StarRating value={Math.round(restaurantRating.data.average)} readOnly size="sm" ariaLabel={t('review.restaurantRating')} />
              <span dir="ltr">{restaurantRating.data.average.toFixed(1)}</span>
            </span>
          ) : null}
        </div>
      </section>

      <section className="container-px py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-night-50 sm:text-3xl">{t('home.deals')}</h2>
            <p className="mt-1 text-sm text-night-400">{t('offers.subtitle')}</p>
          </div>
          <Link to="/offers" className="hidden text-sm font-bold text-brand-500 hover:text-brand-400 sm:block">
            {t('common.viewAll')}
          </Link>
        </div>
        {offers.isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        ) : offers.isError ? (
          <ErrorState
            title={t('misc.error')}
            hint={t('misc.loadError')}
            onRetry={() => offers.refetch()}
            retryLabel={t('misc.retry')}
          />
        ) : !offers.data || offers.data.length === 0 ? (
          <EmptyState
            icon={<Tag className="h-10 w-10" />}
            title={t('offers.empty')}
            hint={t('offers.emptyHint')}
            action={
              <Link to="/menu">
                <Button variant="gold">{t('offers.browseMenu')}</Button>
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

      <section className="bg-night-900/50 py-14">
        <div className="container-px">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-extrabold text-night-50 sm:text-3xl">{t('home.bestSellers')}</h2>
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
            <ErrorState
              title={t('misc.error')}
              hint={t('misc.loadError')}
              onRetry={() => bestSellers.refetch()}
              retryLabel={t('misc.retry')}
            />
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

      <section className="container-px grid gap-6 py-14 md:grid-cols-3">
        {features.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-xl border border-night-800/60 bg-night-900/60 p-6 text-center transition-colors hover:border-brand-600/40"
          >
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/15 text-brand-400">
              <Icon className="h-6 w-6" />
            </span>
            <h3 className="mt-3 text-base font-bold text-night-50">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-night-400">{desc}</p>
          </div>
        ))}
      </section>

      <section className="container-px pb-16">
        <div className="relative overflow-hidden rounded-2xl border border-brand-700/30 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-8 text-center md:p-14">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl md:text-4xl">{t('home.ctaTitle')}</h2>
          <p className="mt-2 text-base text-white/70">{t('home.ctaSubtitle')}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/menu">
              <Button variant="gold" size="lg">
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