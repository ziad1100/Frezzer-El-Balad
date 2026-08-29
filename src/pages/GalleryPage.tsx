import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listGalleryImages } from '@/api/gallery';
import { Skeleton } from '@/components/ui/Card';
import { galleryItems, type GalleryItem } from '@/lib/gallery';
import type { GalleryImage } from '@/types';

interface RenderedGalleryItem {
  key: string;
  src: string;
  caption: string;
}

export function GalleryPage() {
  const { t, i18n } = useTranslation();

  const gallery = useQuery({
    queryKey: ['gallery', 'public'],
    queryFn: listGalleryImages,
    staleTime: 5 * 60 * 1000,
  });

  // DB-backed items when the API responds (even if empty — an admin may hide
  // every image); fall back to the curated static list only on error so the
  // page keeps working when the API is unreachable.
  const dbItems = gallery.data ?? [];
  // Use DB items when the API responds with data; fall back to static list
  // on error or when the API returns empty (e.g. freshly deployed without
  // gallery images seeded yet).
  const useDb = !gallery.isLoading && !gallery.isError && dbItems.length > 0;

  const renderDb = (item: GalleryImage): RenderedGalleryItem => ({
    key: item._id,
    src: item.image,
    caption: i18n.language === 'ar' ? (item.title || item.titleEn) : (item.titleEn || item.title),
  });

  const renderStatic = (item: GalleryItem): RenderedGalleryItem => ({
    key: item.src,
    src: item.src,
    caption: t(`gallery.items.${item.label}`),
  });

  const items: RenderedGalleryItem[] = useDb ? dbItems.map(renderDb) : galleryItems.map(renderStatic);

  return (
    <div className="container-px py-16">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-[var(--tw-text)]">{t('gallery.title')}</h1>
        <p className="mt-2 text-[var(--tw-text-muted)]">{t('gallery.subtitle')}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {gallery.isLoading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)
          : items.map((item) => (
              <div
                key={item.key}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-[var(--tw-border)] bg-[var(--tw-surface)]"
              >
                <img
                  src={item.src}
                  alt={item.caption}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--tw-bg)]/90 to-transparent px-3 pb-2 pt-8">
                  <span className="text-sm font-bold text-[var(--tw-text)]">{item.caption}</span>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
