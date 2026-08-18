import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getPost } from '@/api/posts';
import { Skeleton } from '@/components/ui/Card';

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
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-4 h-64" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container-px py-24 text-center">
        <h1 className="text-2xl font-bold text-night-50">{t('misc.pageNotFound')}</h1>
        <Link to="/blog" className="mt-4 inline-block text-brand-500 hover:underline">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  return (
    <article className="container-px py-16">
      <Link to="/blog" className="inline-flex items-center gap-1 text-sm font-bold text-brand-500 hover:text-brand-400">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t('nav.blog')}
      </Link>
      <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight text-night-50 md:text-4xl">
        {lang === 'ar' ? post.title : post.titleEn || post.title}
      </h1>
      <p className="mt-3 text-sm text-night-500">
        {new Date(post.publishedAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}
      </p>
      <div className="mt-8 max-w-3xl space-y-4 leading-relaxed text-night-200">
        {(lang === 'ar' ? post.content : post.contentEn || post.content).split('\n').map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}