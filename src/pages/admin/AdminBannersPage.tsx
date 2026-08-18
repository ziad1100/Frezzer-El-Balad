import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminListBanners, createBanner, deleteBanner, toggleBanner, updateBanner } from '@/api/admin';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog, ImageUpload, PageHeader, TableWrap, Td, Th, ToggleSwitch } from '@/components/admin/primitives';
import type { Banner } from '@/types';

interface BannerForm {
  title: string;
  subtitle: string;
  image: string;
  buttonText: string;
  buttonLink: string;
  position: 'hero' | 'home' | 'deals';
  order: string;
  isActive: boolean;
}

const blank = (): BannerForm => ({
  title: '',
  subtitle: '',
  image: '',
  buttonText: '',
  buttonLink: '',
  position: 'home',
  order: '0',
  isActive: true,
});

export function AdminBannersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const banners = useQuery({ queryKey: ['admin', 'banners'], queryFn: adminListBanners });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerForm>(blank());
  const [deleting, setDeleting] = useState<Banner | null>(null);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
  };

  const openCreate = (): void => {
    setEditing(null);
    setForm(blank());
    setOpen(true);
  };

  const openEdit = (b: Banner): void => {
    setEditing(b);
    setForm({
      title: b.title,
      subtitle: b.subtitle,
      image: b.image,
      buttonText: b.buttonText,
      buttonLink: b.buttonLink,
      position: b.position,
      order: String(b.order ?? 0),
      isActive: b.isActive,
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const payload: Partial<Banner> = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        image: form.image,
        buttonText: form.buttonText.trim(),
        buttonLink: form.buttonLink.trim(),
        position: form.position,
        order: Number(form.order) || 0,
        isActive: form.isActive,
      };
      if (editing) await updateBanner(editing._id, payload);
      else await createBanner(payload);
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
    mutationFn: (id: string) => toggleBanner(id),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBanner(id),
    onSuccess: () => {
      toast.success(t('common.delete'));
      invalidate();
      setDeleting(null);
    },
  });

  return (
    <div>
      <PageHeader
        title={t('admin.nav.banners')}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('common.add')}
          </Button>
        }
      />

      {banners.isLoading ? (
        <Skeleton className="h-96" />
      ) : banners.data && banners.data.length > 0 ? (
        <TableWrap>
          <thead>
            <tr>
              <Th>{t('admin.titleAr')}</Th>
              <Th>{t('admin.image')}</Th>
              <Th>{t('admin.position')}</Th>
              <Th>{t('admin.order')}</Th>
              <Th>{t('admin.available')}</Th>
              <Th className="text-end">{t('admin.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {(banners.data ?? []).map((b) => (
              <tr key={b._id} className="transition-colors hover:bg-night-800/40">
                <Td>
                  <p className="flex items-center gap-2 font-bold text-night-50">
                    <ImageIcon className="h-4 w-4 text-brand-500" />
                    {b.title}
                  </p>
                </Td>
                <Td>
                  {b.image ? (
                    <img src={b.image} alt="" className="h-10 w-16 rounded-lg border border-night-700 object-cover" />
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>{b.position}</Td>
                <Td>{b.order}</Td>
                <Td>
                  <ToggleSwitch checked={b.isActive} disabled={toggleMutation.isPending} onChange={() => toggleMutation.mutate(b._id)} />
                </Td>
                <Td className="text-end">
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)} aria-label={t('common.edit')}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => setDeleting(b)}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
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
            <Label htmlFor="bn-title">{t('admin.titleAr')}</Label>
            <Input id="bn-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="bn-sub">{t('admin.subtitle')}</Label>
            <Input id="bn-sub" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
          </div>

          <ImageUpload value={form.image} label={t('admin.image')} onChange={(url) => setForm({ ...form, image: url })} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bn-btn">{t('admin.buttonText')}</Label>
              <Input id="bn-btn" value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="bn-link">{t('admin.buttonLink')}</Label>
              <Input id="bn-link" dir="ltr" value={form.buttonLink} onChange={(e) => setForm({ ...form, buttonLink: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bn-pos">{t('admin.position')}</Label>
              <Select id="bn-pos" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value as BannerForm['position'] })}>
                <option value="hero">Hero</option>
                <option value="home">Home</option>
                <option value="deals">Deals</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="bn-order">{t('admin.order')}</Label>
              <Input id="bn-order" type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
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