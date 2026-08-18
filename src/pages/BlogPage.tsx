import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Newspaper } from 'lucide-react';
import { listPosts } from '@/api/posts';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';

export function BlogPage() {
  const { t, i18n } = useTranslation();
  const { data: posts, isLoading } = useQuery({ queryKey: ['posts'], queryFn: listPosts });
  const lang = i18n.language;
  const items = posts?.items ?? [];

  return (
    <div className="container-px py-16">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-night-50">{t('nav.blog')}</h1>
      </div>
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Newspaper className="h-14 w-14" />} title={t('blog.emptyTitle')} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((post) => (
            <Link key={post._id} to={`/blog/${post.slug}`} className="group">
              <Card className="h-full transition-all duration-300 group-hover:-translate-y-1 group-hover:border-night-600">
                <CardContent className="flex h-full flex-col p-6">
                  <div className="mb-3 flex items-center gap-2 text-xs text-night-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(post.publishedAt).toLocaleDateString(
                      lang === 'ar' ? 'ar-EG' : 'en-GB',
                    )}
                  </div>
                  <h3 className="line-clamp-2 text-lg font-bold text-night-50 group-hover:text-brand-500">
                    {lang === 'ar' ? post.title : post.titleEn || post.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-night-400">
                    {lang === 'ar' ? post.excerpt : post.excerptEn || post.excerpt}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-500">
                    {t('common.viewAll')}
                    <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}