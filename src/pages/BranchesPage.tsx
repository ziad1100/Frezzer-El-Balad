import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowUpRight, Clock, MapPin, Phone } from 'lucide-react';
import { listBranches } from '@/api/posts';
import { EmptyState, Skeleton } from '@/components/ui/Card';

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

export function BranchesPage() {
  const { t, i18n } = useTranslation();
  const { data: branches, isLoading } = useQuery({ queryKey: ['branches'], queryFn: listBranches });
  const lang = i18n.language;

  return (
    <div className="overflow-hidden">
      {/* ═══ Hero ═══ */}
      <section className="relative bg-gradient-to-b from-brand-900/30 via-[var(--tw-bg)] to-[var(--tw-bg)]">
        <div className="container-px py-14 sm:py-20">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="mx-auto max-w-2xl text-center">
            <motion.div variants={fadeUp} className="mb-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-brand-400 uppercase">
                <MapPin className="h-3.5 w-3.5" />
                {lang === 'ar' ? 'فروعنا' : 'Our Branches'}
              </span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-3xl font-extrabold tracking-tight text-[var(--tw-text)] sm:text-4xl">
              {t('nav.branches')}
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-4 text-base text-[var(--tw-text-muted)] sm:text-lg">
              {t('branches.subtitle')}
            </motion.p>
          </motion.div>
        </div>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-500/5 blur-3xl" />
        </div>
      </section>

      {/* ═══ Branches Grid ═══ */}
      <section className="container-px pb-16">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-3xl" />
            ))}
          </div>
        ) : !branches || branches.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-10 w-10" />}
            title={lang === 'ar' ? 'لا توجد فروع حالياً' : 'No branches available'}
          />
        ) : (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {branches.map((branch) => (
              <motion.div key={branch._id} variants={fadeUp} whileHover={{ y: -4 }}>
                <div className="group h-full rounded-3xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] p-6 transition-all duration-300 hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5">
                  <div className="mb-4 flex items-start justify-between">
                    <h3 className="text-lg font-bold tracking-tight text-[var(--tw-text)]">
                      {lang === 'ar' ? branch.name : branch.nameEn || branch.name}
                    </h3>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10">
                      <MapPin className="h-5 w-5 text-brand-400" />
                    </div>
                  </div>

                  {branch.address ? (
                    <p className="text-sm leading-relaxed text-[var(--tw-text-muted)]">
                      {lang === 'ar' ? branch.address : branch.addressEn || branch.address}
                    </p>
                  ) : null}

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center gap-3 rounded-xl bg-[var(--tw-surface-alt)] px-3 py-2.5">
                      <Phone className="h-4 w-4 shrink-0 text-gold-400" />
                      <span className="text-sm font-bold text-[var(--tw-text)]" dir="ltr">{branch.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl bg-[var(--tw-surface-alt)] px-3 py-2.5">
                      <Clock className="h-4 w-4 shrink-0 text-gold-400" />
                      <span className="text-sm text-[var(--tw-text-muted)]">
                        {lang === 'ar' ? branch.workHours : branch.workHoursEn || branch.workHours}
                      </span>
                    </div>
                  </div>

                  {branch.googleMapsUrl ? (
                    <a
                      href={branch.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand-500 transition-colors hover:text-brand-400"
                    >
                      <MapPin className="h-4 w-4" />
                      Google Maps
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                  ) : null}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}
