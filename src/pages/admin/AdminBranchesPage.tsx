import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminListBranches, createBranch, deleteBranch, updateBranch } from '@/api/admin';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog, PageHeader, TableWrap, Td, Th, ToggleSwitch } from '@/components/admin/primitives';
import type { Branch } from '@/types';

interface BranchForm {
  name: string;
  nameEn: string;
  address: string;
  addressEn: string;
  phone: string;
  whatsapp: string;
  workHours: string;
  workHoursEn: string;
  lat: string;
  lng: string;
  googleMapsUrl: string;
  isActive: boolean;
}

const blank = (): BranchForm => ({
  name: '',
  nameEn: '',
  address: '',
  addressEn: '',
  phone: '',
  whatsapp: '',
  workHours: '',
  workHoursEn: '',
  lat: '',
  lng: '',
  googleMapsUrl: '',
  isActive: true,
});

export function AdminBranchesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: adminListBranches });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchForm>(blank());
  const [deleting, setDeleting] = useState<Branch | null>(null);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'branches'] });
    void queryClient.invalidateQueries({ queryKey: ['branches'] });
  };

  const openCreate = (): void => {
    setEditing(null);
    setForm(blank());
    setOpen(true);
  };

  const openEdit = (b: Branch): void => {
    setEditing(b);
    setForm({
      name: b.name,
      nameEn: b.nameEn,
      address: b.address,
      addressEn: b.addressEn,
      phone: b.phone,
      whatsapp: b.whatsapp,
      workHours: b.workHours,
      workHoursEn: b.workHoursEn,
      lat: String(b.lat ?? ''),
      lng: String(b.lng ?? ''),
      googleMapsUrl: b.googleMapsUrl,
      isActive: b.isActive,
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const payload: Partial<Branch> = {
        name: form.name.trim(),
        nameEn: form.nameEn.trim(),
        address: form.address.trim(),
        addressEn: form.addressEn.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        workHours: form.workHours.trim(),
        workHoursEn: form.workHoursEn.trim(),
        lat: Number(form.lat) || 0,
        lng: Number(form.lng) || 0,
        googleMapsUrl: form.googleMapsUrl.trim(),
        isActive: form.isActive,
      };
      if (editing) await updateBranch(editing._id, payload);
      else await createBranch(payload);
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
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateBranch(id, { isActive }),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: () => {
      toast.success(t('common.delete'));
      invalidate();
      setDeleting(null);
    },
  });

  return (
    <div>
      <PageHeader
        title={t('admin.nav.branches')}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('common.add')}
          </Button>
        }
      />

      {branches.isLoading ? (
        <Skeleton className="h-96" />
      ) : branches.data && branches.data.length > 0 ? (
        <TableWrap>
          <thead>
            <tr>
              <Th>{t('admin.nameAr')}</Th>
              <Th>{t('admin.addressAr')}</Th>
              <Th>{t('admin.phone')}</Th>
              <Th>{t('admin.available')}</Th>
              <Th className="text-end">{t('admin.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {branches.data.map((b) => (
              <tr key={b._id} className="transition-colors hover:bg-night-800/40">
                <Td>
                  <p className="flex items-center gap-2 font-bold text-night-50">
                    <MapPin className="h-4 w-4 text-brand-500" />
                    {b.name}
                  </p>
                  {b.nameEn ? <p className="text-xs text-night-500">{b.nameEn}</p> : null}
                </Td>
                <Td className="max-w-xs">{b.address}</Td>
                <Td dir="ltr">{b.phone}</Td>
                <Td>
                  <ToggleSwitch
                    checked={b.isActive}
                    disabled={toggleMutation.isPending}
                    onChange={() => toggleMutation.mutate({ id: b._id, isActive: !b.isActive })}
                  />
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t('common.edit') : t('common.add')} size="lg">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="br-name">{t('admin.nameAr')}</Label>
              <Input id="br-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="br-nameen">{t('admin.nameEn')}</Label>
              <Input id="br-nameen" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="br-addr">{t('admin.addressAr')}</Label>
              <Input id="br-addr" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="br-addren">{t('admin.addressEn')}</Label>
              <Input id="br-addren" value={form.addressEn} onChange={(e) => setForm({ ...form, addressEn: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="br-phone">{t('admin.phoneSetting')}</Label>
              <Input id="br-phone" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="br-wa">{t('admin.whatsappSetting')}</Label>
              <Input id="br-wa" dir="ltr" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="br-hours">{t('admin.workHoursAr')}</Label>
              <Input id="br-hours" value={form.workHours} onChange={(e) => setForm({ ...form, workHours: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="br-hoursen">{t('admin.workHoursEn')}</Label>
              <Input id="br-hoursen" value={form.workHoursEn} onChange={(e) => setForm({ ...form, workHoursEn: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="br-lat">Latitude</Label>
              <Input id="br-lat" type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="br-lng">Longitude</Label>
              <Input id="br-lng" type="number" step="any" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="br-map">Google Maps URL</Label>
              <Input id="br-map" dir="ltr" value={form.googleMapsUrl} onChange={(e) => setForm({ ...form, googleMapsUrl: e.target.value })} />
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