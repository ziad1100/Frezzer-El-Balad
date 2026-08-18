import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgePercent, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminListOffers, adminListProducts, createOffer, deleteOffer, updateOffer } from '@/api/admin';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog, ImageUpload, PageHeader, TableWrap, Td, Th } from '@/components/admin/primitives';
import type { Offer } from '@/types';

interface OfferForm {
  title: string;
  titleEn: string;
  description: string;
  discountType: 'percent' | 'fixed';
  discountValue: string;
  theme: 'dark' | 'red' | 'gold';
  startDate: string;
  endDate: string;
  banner: string;
  products: string[];
  isActive: boolean;
}

const blank = (): OfferForm => ({
  title: '',
  titleEn: '',
  description: '',
  discountType: 'percent',
  discountValue: '',
  theme: 'dark',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  banner: '',
  products: [],
  isActive: true,
});

export function AdminOffersPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();

  const offers = useQuery({ queryKey: ['admin', 'offers'], queryFn: adminListOffers });
  const products = useQuery({
    queryKey: ['admin', 'offers', 'products'],
    queryFn: () => adminListProducts({ page: 1, limit: 50 }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [form, setForm] = useState<OfferForm>(blank());
  const [deleting, setDeleting] = useState<Offer | null>(null);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'offers'] });
    void queryClient.invalidateQueries({ queryKey: ['products', 'offers'] });
  };

  const openCreate = (): void => {
    setEditing(null);
    setForm(blank());
    setOpen(true);
  };

  const openEdit = (o: Offer): void => {
    setEditing(o);
    setForm({
      title: o.title,
      titleEn: o.titleEn,
      description: o.description,
      discountType: o.discountType,
      discountValue: String(o.discountValue),
      theme: o.theme,
      startDate: o.startDate.slice(0, 10),
      endDate: o.endDate.slice(0, 10),
      banner: o.banner,
      products: o.products ?? [],
      isActive: o.isActive,
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const payload: Partial<Offer> = {
        title: form.title.trim(),
        titleEn: form.titleEn.trim(),
        description: form.description.trim(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        theme: form.theme,
        startDate: new Date(form.startDate).toISOString(),
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        banner: form.banner,
        products: form.products,
        isActive: form.isActive,
      };
      if (editing) await updateOffer(editing._id, payload);
      else await createOffer(payload);
    },
    onSuccess: () => {
      toast.success(t('admin.saved'));
      invalidate();
      setOpen(false);
      setEditing(null);
    },
    onError: () => toast.error(t('admin.saveFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOffer(id),
    onSuccess: () => {
      toast.success(t('common.delete'));
      invalidate();
      setDeleting(null);
    },
  });

  const toggleProduct = (id: string): void => {
    setForm((f) => ({
      ...f,
      products: f.products.includes(id) ? f.products.filter((p) => p !== id) : [...f.products, id],
    }));
  };

  return (
    <div>
      <PageHeader
        title={t('admin.nav.offers')}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('common.add')}
          </Button>
        }
      />

      {offers.isLoading ? (
        <Skeleton className="h-96" />
      ) : offers.data && offers.data.length > 0 ? (
        <TableWrap>
          <thead>
            <tr>
              <Th>{t('admin.dealTitle')}</Th>
              <Th>{t('admin.type')}</Th>
              <Th>{t('admin.value')}</Th>
              <Th>{t('admin.startDate')}</Th>
              <Th>{t('admin.endDate')}</Th>
              <Th>{t('admin.statusChange')}</Th>
              <Th className="text-end">{t('admin.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {(offers.data ?? []).map((o) => (
              <tr key={o._id} className="transition-colors hover:bg-night-800/40">
                <Td>
                  <p className="flex items-center gap-2 font-bold text-night-50">
                    <BadgePercent className="h-4 w-4 text-brand-500" />
                    {o.title}
                  </p>
                </Td>
                <Td>{o.discountType === 'percent' ? t('admin.percent') : t('admin.fixed')}</Td>
                <Td>{o.discountType === 'percent' ? `${o.discountValue}%` : `${o.discountValue} EGP`}</Td>
                <Td>{o.startDate.slice(0, 10)}</Td>
                <Td>{o.endDate.slice(0, 10)}</Td>
                <Td>{o.isActive ? t('admin.enabled') : t('admin.disabled')}</Td>
                <Td className="text-end">
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(o)} aria-label={t('common.edit')}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => setDeleting(o)}
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t('common.edit') : t('common.add')} size="lg">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="of-title">{t('admin.titleAr')}</Label>
              <Input id="of-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="of-titleen">{t('admin.titleEn')}</Label>
              <Input id="of-titleen" value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} />
            </div>
          </div>

          <div>
            <Label htmlFor="of-desc">{t('admin.descriptionAr')}</Label>
            <Input id="of-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <ImageUpload value={form.banner} label={t('admin.image')} onChange={(url) => setForm({ ...form, banner: url })} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="of-type">{t('admin.type')}</Label>
              <Select id="of-type" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as OfferForm['discountType'] })}>
                <option value="percent">{t('admin.percent')}</option>
                <option value="fixed">{t('admin.fixed')}</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="of-value">{t('admin.value')}</Label>
              <Input id="of-value" type="number" min={0} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="of-theme">{t('admin.theme')}</Label>
              <Select id="of-theme" value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value as OfferForm['theme'] })}>
                <option value="dark">Dark</option>
                <option value="red">Red</option>
                <option value="gold">Gold</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="of-start">{t('admin.startDate')}</Label>
              <Input id="of-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="of-end">{t('admin.endDate')}</Label>
              <Input id="of-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>{t('admin.nav.products')}</Label>
            <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-night-800 p-3">
              {products.data && products.data.items.length > 0 ? (
                (products.data.items as Array<{ _id: string; name: string; nameEn: string }>).map((p) => (
                  <label key={p._id} className="flex cursor-pointer items-center gap-2 text-sm text-night-200">
                    <input
                      type="checkbox"
                      checked={form.products.includes(p._id)}
                      onChange={() => toggleProduct(p._id)}
                      className="h-4 w-4 accent-brand-600"
                    />
                    {lang === 'ar' ? p.name : p.nameEn || p.name}
                  </label>
                ))
              ) : (
                <p className="text-sm text-night-500">{t('admin.emptyList')}</p>
              )}
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