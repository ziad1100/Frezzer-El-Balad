import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, Percent, Tag } from 'lucide-react';
import { getOffer } from '@/api/offers';
import { ProductCard } from '@/components/product/ProductCard';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState, Skeleton } from '@/components/ui/Card';
import { offerThemeClasses } from '@/components/offer/offerTheme';
import { cn, formatPrice } from '@/lib/utils';

export function OfferDetailPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['offers', 'detail', id],
    queryFn: () => getOffer(id ?? ''),
    enabled: Boolean(id),
    retry: false,
  });

  if (isLoading || !id) {
    return (
      <div className="container-px py-16">
        <Skeleton className="h-64 rounded-3xl" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5]" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container-px py-16">
        <EmptyState
          icon={<Tag className="h-10 w-10" />}
          title={t('offers.notFound')}
          hint={t('offers.notFoundHint')}
          action={
            <Link to="/offers">
              <Button variant="gold">{t('offers.browseMenu')}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const title = lang === 'ar' ? data.title : data.titleEn || data.title;
  const description = lang === 'ar' ? data.description : data.descriptionEn || data.description;
  const discountLabel =
    data.discountType === 'percent'
      ? `-${data.discountValue}%`
      : `-${formatPrice(data.discountValue, lang)}`;
  const endsLabel = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(data.endDate));

  return (
    <div className="container-px py-12">
      <Link
        to="/offers"
        className="inline-flex items-center gap-2 text-sm font-bold text-brand-500 hover:text-brand-400"
      >
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        {t('offers.backToOffers')}
      </Link>

      <section
        className={cn(
          'relative mt-6 overflow-hidden rounded-3xl border bg-gradient-to-br p-8 shadow-xl md:p-12',
          offerThemeClasses(data.theme),
        )}
      >
        <span className="pointer-events-none absolute -start-10 -top-10 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-16 -end-10 h-60 w-60 rounded-full bg-black/20 blur-3xl" />

        <div className="relative flex flex-wrap items-center gap-3">
          <Badge
            tone="gold"
            className={cn('text-base', data.theme === 'gold' && 'border-night-900/50 bg-night-950/60 text-gold-200')}
          >
            <Percent className="h-4 w-4" />
            {discountLabel}
          </Badge>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
            <CalendarClock className="h-4 w-4" />
            {t('offers.endsAt')} {endsLabel}
          </span>
        </div>
        <h1 className="relative mt-6 text-3xl font-extrabold text-white md:text-5xl">{title}</h1>
        {description ? (
          <p className="relative mt-3 max-w-2xl text-lg leading-relaxed text-white/80">{description}</p>
        ) : null}
        <p className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold text-white">
          <Tag className="h-4 w-4" />
          {data.products.length} {t('offers.items')}
        </p>
      </section>

      {data.products.length > 0 ? (
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {data.products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : (
        <div className="mt-10">
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
        </div>
      )}
    </div>
  );
}