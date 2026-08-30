import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Camera } from 'lucide-react';
import { listGalleryImages } from '@/api/gallery';
import { Skeleton } from '@/components/ui/Card';
import { galleryItems, type GalleryItem } from '@/lib/gallery';
import type { GalleryImage } from '@/types';

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

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

  const dbItems = gallery.data ?? [];
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
    <div className="overflow-hidden">
      {/* ═══ Hero ═══ */}
      <section className="relative bg-gradient-to-b from-brand-900/30 via-[var(--tw-bg)] to-[var(--tw-bg)]">
        <div className="container-px py-14 sm:py-20">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="mx-auto max-w-2xl text-center">
            <motion.div variants={fadeUp} className="mb-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-brand-400 uppercase">
                <Camera className="h-3.5 w-3.5" />
                {i18n.language === 'ar' ? 'معرض الصور' : 'Photo Gallery'}
              </span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-3xl font-extrabold tracking-tight text-[var(--tw-text)] sm:text-4xl">
              {t('gallery.title')}
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-4 text-base text-[var(--tw-text-muted)] sm:text-lg">
              {t('gallery.subtitle')}
            </motion.p>
          </motion.div>
        </div>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-500/5 blur-3xl" />
        </div>
      </section>

      {/* ═══ Gallery Grid ═══ */}
      <section className="container-px pb-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        >
          {gallery.isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <motion.div key={i} variants={fadeUp}>
                  <Skeleton className="aspect-square rounded-2xl" />
                </motion.div>
              ))
            : items.map((item) => (
                <motion.div key={item.key} variants={fadeUp} whileHover={{ y: -4 }}>
                  <div className="group relative aspect-square overflow-hidden rounded-2xl border border-[var(--tw-border)] bg-[var(--tw-surface)]">
                    <img
                      src={item.src}
                      alt={item.caption}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--tw-bg)]/90 via-[var(--tw-bg)]/40 to-transparent px-3 pb-3 pt-10">
                      <span className="text-sm font-bold text-[var(--tw-text)] drop-shadow-sm">{item.caption}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
        </motion.div>
      </section>
    </div>
  );
}
