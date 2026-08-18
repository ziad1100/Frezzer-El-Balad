import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  adminListGallery,
  createGalleryImage,
  deleteGalleryImage,
  toggleGalleryImage,
  updateGalleryImage,
} from '@/api/admin';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog, ImageUpload, PageHeader, ToggleSwitch } from '@/components/admin/primitives';
import type { GalleryImage } from '@/types';

interface GalleryForm {
  title: string;
  titleEn: string;
  image: string;
  order: string;
  isVisible: boolean;
}

const blank = (nextOrder: number): GalleryForm => ({
  title: '',
  titleEn: '',
  image: '',
  order: String(nextOrder),
  isVisible: true,
});

export function AdminGalleryPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const gallery = useQuery({ queryKey: ['admin', 'gallery'], queryFn: adminListGallery });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GalleryImage | null>(null);
  const [form, setForm] = useState<GalleryForm>(blank(0));
  const [deleting, setDeleting] = useState<GalleryImage | null>(null);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'gallery'] });
    void queryClient.invalidateQueries({ queryKey: ['gallery'] });
  };

  const openCreate = (): void => {
    setEditing(null);
    setForm(blank((gallery.data?.length ?? 0) + 1));
    setOpen(true);
  };

  const openEdit = (g: GalleryImage): void => {
    setEditing(g);
    setForm({
      title: g.title,
      titleEn: g.titleEn,
      image: g.image,
      order: String(g.order ?? 0),
      isVisible: g.isVisible,
    });
    setOpen(true);
  };

  const moveMutation = useMutation({
    mutationFn: async ({ a, b }: { a: GalleryImage; b: GalleryImage }): Promise<void> => {
      await Promise.all([
        updateGalleryImage(a._id, { order: b.order }),
        updateGalleryImage(b._id, { order: a.order }),
      ]);
    },
    onSuccess: () => {
      invalidate();
    },
    onError: () => toast.error(t('admin.saveFailed')),
  });

  const move = (index: number, dir: -1 | 1): void => {
    const items = gallery.data ?? [];
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    moveMutation.mutate({ a: items[index], b: items[target] });
  };

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const payload: Partial<GalleryImage> = {
        title: form.title.trim(),
        titleEn: form.titleEn.trim(),
        image: form.image,
        order: Number(form.order) || 0,
        isVisible: form.isVisible,
      };
      if (editing) await updateGalleryImage(editing._id, payload);
      else await createGalleryImage(payload);
    },
    onSuccess: () => {
      toast.success(t('admin.saved'));
      invalidate();
      setOpen(false);
      setEditing(null);
    },
    onError: () => toast.error(t('admin.saveFailed')),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleGalleryImage(id),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGalleryImage(id),
    onSuccess: () => {
      toast.success(t('common.delete'));
      invalidate();
      setDeleting(null);
    },
  });

  return (
    <div>
      <PageHeader
        title={t('admin.nav.gallery')}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('common.add')}
          </Button>
        }
      />

      {gallery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : gallery.data && gallery.data.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {(gallery.data ?? []).map((g, i) => (
            <div
              key={g._id}
              className="group relative overflow-hidden rounded-2xl border border-night-800 bg-night-900 transition-colors hover:border-night-700"
            >
              <div className="relative aspect-square">
                <img
                  src={g.image}
                  alt={g.title}
                  loading="lazy"
                  className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${g.isVisible ? '' : 'opacity-40 grayscale'}`}
                />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-night-950/90 to-transparent p-2">
                  <span className="rounded-full bg-night-950/80 px-2 py-0.5 text-xs font-bold text-night-200">
                    {t('admin.order')}: {g.order}
                  </span>
                  <ToggleSwitch
                    checked={g.isVisible}
                    disabled={toggleMutation.isPending}
                    onChange={() => toggleMutation.mutate(g._id)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-night-50">{g.title}</p>
                  <p className="truncate text-xs text-night-500">{g.titleEn || '—'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, -1)} aria-label={t('common.moveUp')}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, 1)} aria-label={t('common.moveDown')}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(g)} aria-label={t('common.edit')}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => setDeleting(g)}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-14">
            <EmptyState title={t('admin.emptyList')} hint={t('admin.emptyListHint')} />
          </CardContent>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t('common.edit') : t('common.add')} size="md">
        <div className="space-y-5">
          <div>
            <Label htmlFor="gl-title">{t('admin.titleAr')}</Label>
            <Input id="gl-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="gl-title-en">{t('admin.titleEn')}</Label>
            <Input id="gl-title-en" value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} />
          </div>

          <ImageUpload value={form.image} label={t('admin.image')} onChange={(url) => setForm({ ...form, image: url })} />

          <div className="flex items-end justify-between gap-4">
            <div className="w-40">
              <Label htmlFor="gl-order">{t('admin.order')}</Label>
              <Input id="gl-order" type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <ToggleSwitch checked={form.isVisible} onChange={() => setForm({ ...form, isVisible: !form.isVisible })} />
              <span className="text-sm font-semibold text-night-300">{t('admin.available')}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button loading={saveMutation.isPending} disabled={!form.image || !form.title.trim()} onClick={() => saveMutation.mutate()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting._id)}
        title={t('admin.confirmDeleteTitle')}
        message={t('admin.confirmDelete')}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
