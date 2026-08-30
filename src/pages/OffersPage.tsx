import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Tag, Sparkles } from 'lucide-react';
import { getActiveOffers } from '@/api/offers';
import { OfferCard } from '@/components/offer/OfferCard';
import { Button } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Card';

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

export function OffersPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['offers', 'active'],
    queryFn: getActiveOffers,
  });

  const empty = isError || !data || data.length === 0;

  return (
    <div className="overflow-hidden">
      {/* ═══ Hero ═══ */}
      <section className="relative bg-gradient-to-b from-gold-900/30 via-[var(--tw-bg)] to-[var(--tw-bg)]">
        <div className="container-px py-14 sm:py-20">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="mx-auto max-w-2xl text-center">
            <motion.div variants={fadeUp} className="mb-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-gold-400 uppercase">
                <Sparkles className="h-3.5 w-3.5" />
                {isAr ? 'عروض حصرية' : 'Exclusive Deals'}
              </span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-3xl font-extrabold tracking-tight text-[var(--tw-text)] sm:text-4xl">
              {t('offers.title')}
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-4 text-base text-[var(--tw-text-muted)] sm:text-lg">
              {t('offers.subtitle')}
            </motion.p>
          </motion.div>
        </div>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gold-500/5 blur-3xl" />
        </div>
      </section>

      {/* ═══ Offers Grid ═══ */}
      <section className="container-px pb-16">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-3xl" />
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
      </section>
    </div>
  );
}
