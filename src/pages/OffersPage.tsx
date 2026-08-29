import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Tag } from 'lucide-react';
import { getActiveOffers } from '@/api/offers';
import { OfferCard } from '@/components/offer/OfferCard';
import { Button } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Card';

export function OffersPage() {
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['offers', 'active'],
    queryFn: getActiveOffers,
  });

  const empty = isError || !data || data.length === 0;

  return (
    <div className="container-px py-12">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold text-[var(--tw-text)] sm:text-3xl">{t('offers.title')}</h1>
        <p className="mt-1 text-sm text-[var(--tw-text-muted)]">{t('offers.subtitle')}</p>
      </header>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : empty ? (
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
          {data.map((offer) => (
            <OfferCard key={offer._id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}