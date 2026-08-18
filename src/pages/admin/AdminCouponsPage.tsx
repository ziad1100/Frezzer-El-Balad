import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Percent, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createCoupon, deleteCoupon, listCoupons, updateCoupon } from '@/api/admin';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog, PageHeader, TableWrap, Td, Th } from '@/components/admin/primitives';
import type { Coupon } from '@/types';

interface CouponForm {
  code: string;
  type: 'percent' | 'fixed';
  value: string;
  minOrder: string;
  maxDiscount: string;
  maxUses: string;
  perUserLimit: string;
  endDate: string;
  isActive: boolean;
}

const blank = (): CouponForm => ({
  code: '',
  type: 'percent',
  value: '',
  minOrder: '0',
  maxDiscount: '0',
  maxUses: '0',
  perUserLimit: '1',
  endDate: '',
  isActive: true,
});

export function AdminCouponsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const coupons = useQuery({ queryKey: ['admin', 'coupons'], queryFn: listCoupons });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponForm>(blank());
  const [deleting, setDeleting] = useState<Coupon | null>(null);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
  };

  const openCreate = (): void => {
    setEditing(null);
    setForm(blank());
    setOpen(true);
  };

  const openEdit = (c: Coupon): void => {
    setEditing(c);
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      minOrder: String(c.minOrder ?? 0),
      maxDiscount: String(c.maxDiscount ?? 0),
      maxUses: String(c.maxUses ?? 0),
      perUserLimit: String(c.perUserLimit ?? 1),
      endDate: (c.endDate ?? '').slice(0, 10),
      isActive: c.isActive,
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const payload: Partial<Coupon> = {
        code: form.code.toUpperCase().trim(),
        type: form.type,
        value: Number(form.value),
        minOrder: Number(form.minOrder),
        maxDiscount: Number(form.maxDiscount),
        maxUses: Number(form.maxUses),
        perUserLimit: Number(form.perUserLimit) || 1,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        isActive: form.isActive,
      };
      if (editing) await updateCoupon(editing._id, payload);
      else await createCoupon(payload);
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
    mutationFn: (id: string) => deleteCoupon(id),
    onSuccess: () => {
      toast.success(t('common.delete'));
      invalidate();
      setDeleting(null);
    },
  });

  return (
    <div>
      <PageHeader
        title={t('admin.nav.coupons')}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('common.add')}
          </Button>
        }
      />

      {coupons.isLoading ? (
        <Skeleton className="h-96" />
      ) : coupons.data && coupons.data.length > 0 ? (
        <TableWrap>
          <thead>
            <tr>
              <Th>{t('admin.code')}</Th>
              <Th>{t('admin.type')}</Th>
              <Th>{t('admin.value')}</Th>
              <Th>{t('admin.minOrder')}</Th>
              <Th>{t('admin.statusChange')}</Th>
              <Th className="text-end">{t('admin.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {(coupons.data ?? []).map((c) => (
              <tr key={c._id} className="transition-colors hover:bg-night-800/40">
                <Td className="font-bold text-night-50">
                  <span className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-brand-500" />
                    {c.code}
                  </span>
                </Td>
                <Td>{c.type === 'percent' ? t('admin.percent') : t('admin.fixed')}</Td>
                <Td>{c.type === 'percent' ? `${c.value}%` : `${c.value} EGP`}</Td>
                <Td>{c.minOrder || 0}</Td>
                <Td>{c.isActive ? t('admin.enabled') : t('admin.disabled')}</Td>
                <Td className="text-end">
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label={t('common.edit')}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => setDeleting(c)}
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
            <Label htmlFor="coup-code">{t('admin.code')}</Label>
            <Input id="coup-code" dir="ltr" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="coup-type">{t('admin.type')}</Label>
              <Select id="coup-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CouponForm['type'] })}>
                <option value="percent">{t('admin.percent')}</option>
                <option value="fixed">{t('admin.fixed')}</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="coup-value">{t('admin.value')}</Label>
              <Input id="coup-value" type="number" min={0} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="coup-min">{t('admin.minOrder')}</Label>
              <Input id="coup-min" type="number" min={0} value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="coup-max">{t('admin.maxDiscount')}</Label>
              <Input id="coup-max" type="number" min={0} value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="coup-uses">{t('admin.maxUses')}</Label>
              <Input id="coup-uses" type="number" min={0} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="coup-per">{t('admin.perUserLimit')}</Label>
              <Input id="coup-per" type="number" min={1} value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="coup-end">{t('admin.endDate')}</Label>
              <Input id="coup-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 px-1 pb-3 text-sm font-semibold text-night-200">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 accent-brand-600"
                />
                {t('admin.enabled')}
              </label>
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