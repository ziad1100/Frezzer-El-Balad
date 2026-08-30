import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Newspaper } from 'lucide-react';
import { getPost } from '@/api/posts';
import { Skeleton } from '@/components/ui/Card';

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export function PostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const { data: post, isLoading } = useQuery({
    queryKey: ['post', slug],
    queryFn: () => getPost(slug ?? ''),
    enabled: Boolean(slug),
  });
  const lang = i18n.language;

  if (isLoading) {
    return (
      <div className="container-px py-16">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-6 h-10 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/3" />
        <div className="mt-10 max-w-3xl space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container-px flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--tw-surface)]">
          <Newspaper className="h-10 w-10 text-[var(--tw-text-subtle)]" />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold text-[var(--tw-text)]">{t('misc.pageNotFound')}</h1>
        <Link to="/blog" className="mt-6">
          <span className="text-sm font-bold text-brand-500 hover:text-brand-400">{t('common.back')}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      {/* ═══ Hero ═══ */}
      <section className="relative bg-gradient-to-b from-brand-900/30 via-[var(--tw-bg)] to-[var(--tw-bg)]">
        <div className="container-px py-14 sm:py-20">
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }} className="mx-auto max-w-3xl">
            <motion.div variants={fadeUp}>
              <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-500 hover:text-brand-400">
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                {t('nav.blog')}
              </Link>
            </motion.div>
            <motion.h1 variants={fadeUp} className="mt-6 text-3xl font-extrabold tracking-tight leading-tight text-[var(--tw-text)] md:text-4xl">
              {lang === 'ar' ? post.title : post.titleEn || post.title}
            </motion.h1>
            <motion.div variants={fadeUp} className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[var(--tw-text-muted)]">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-brand-400" />
                {new Date(post.publishedAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}
              </span>
            </motion.div>
          </motion.div>
        </div>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-500/5 blur-3xl" />
        </div>
      </section>

      {/* ═══ Content ═══ */}
      <motion.article
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        className="container-px pb-16"
      >
        <div className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] p-6 sm:p-10">
          {(lang === 'ar' ? post.content : post.contentEn || post.content).split('\n').map((paragraph, i) => (
            <motion.p key={i} variants={fadeUp} className="text-sm leading-relaxed text-[var(--tw-text-muted)]">
              {paragraph}
            </motion.p>
          ))}
        </div>
      </motion.article>
    </div>
  );
}
