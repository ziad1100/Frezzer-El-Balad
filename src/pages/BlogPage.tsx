import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Newspaper, Snowflake, User } from 'lucide-react';
import { listPosts } from '@/api/posts';
import { EmptyState, Skeleton } from '@/components/ui/Card';

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

export function BlogPage() {
  const { t, i18n } = useTranslation();
  const { data: posts, isLoading } = useQuery({ queryKey: ['posts'], queryFn: listPosts });
  const lang = i18n.language;
  const items = posts?.items ?? [];

  return (
    <div className="overflow-hidden">
      {/* ═══ Hero ═══ */}
      <section className="relative bg-gradient-to-b from-brand-900/30 via-[var(--tw-bg)] to-[var(--tw-bg)]">
        <div className="container-px py-14 sm:py-20">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="mx-auto max-w-2xl text-center">
            <motion.div variants={fadeUp} className="mb-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-brand-400 uppercase">
                <Snowflake className="h-3.5 w-3.5" />
                {lang === 'ar' ? 'المدونة' : 'Blog'}
              </span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-3xl font-extrabold tracking-tight text-[var(--tw-text)] sm:text-4xl">
              {t('nav.blog')}
            </motion.h1>
          </motion.div>
        </div>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-500/5 blur-3xl" />
        </div>
      </section>

      {/* ═══ Blog Grid ═══ */}
      <section className="container-px pb-16">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-3xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="h-10 w-10" />}
            title={t('blog.emptyTitle')}
          />
        ) : (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((post) => (
              <motion.div key={post._id} variants={fadeUp} whileHover={{ y: -4 }}>
                <Link to={`/blog/${post.slug}`} className="group block h-full">
                  <div className="flex h-full flex-col rounded-3xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] p-6 transition-all duration-300 group-hover:border-brand-500/30 group-hover:shadow-lg group-hover:shadow-brand-500/5">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10">
                        <User className="h-4 w-4 text-brand-400" />
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--tw-text-muted)]">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(post.publishedAt).toLocaleDateString(
                          lang === 'ar' ? 'ar-EG' : 'en-GB',
                        )}
                      </div>
                    </div>
                    <h3 className="line-clamp-2 text-lg font-bold tracking-tight text-[var(--tw-text)] group-hover:text-brand-500">
                      {lang === 'ar' ? post.title : post.titleEn || post.title}
                    </h3>
                    <p className="mt-2.5 line-clamp-3 flex-1 text-sm leading-relaxed text-[var(--tw-text-muted)]">
                      {lang === 'ar' ? post.excerpt : post.excerptEn || post.excerpt}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand-500 transition-colors group-hover:text-brand-400">
                      {lang === 'ar' ? 'اقرأ المزيد' : 'Read More'}
                      <ArrowLeft className="h-4 w-4 rtl:rotate-180 transition-transform group-hover:-translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}
