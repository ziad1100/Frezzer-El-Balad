import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminListLabels, createLabel, deleteLabel, updateLabel } from '@/api/admin';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog, PageHeader, TableWrap, Td, Th, ToggleSwitch } from '@/components/admin/primitives';
import type { Label as LabelType } from '@/types';

interface LabelForm {
  name: string;
  nameEn: string;
  color: string;
  icon: string;
}

const blank = (): LabelForm => ({ name: '', nameEn: '', color: '#38BDF8', icon: '' });

export function AdminLabelsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();

  const labels = useQuery({ queryKey: ['admin', 'labels'], queryFn: adminListLabels });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LabelType | null>(null);
  const [form, setForm] = useState<LabelForm>(blank());
  const [deleting, setDeleting] = useState<LabelType | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setForm(blank());
    setOpen(true);
  };

  const openEdit = (l: LabelType): void => {
    setEditing(l);
    setForm({ name: l.name, nameEn: l.nameEn, color: l.color || '#38BDF8', icon: l.icon || '' });
    setOpen(true);
  };

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'labels'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
  };

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!form.name.trim()) throw new Error(lang === 'ar' ? 'اسم البطاقة مطلوب' : 'Label name is required');
      if (editing) {
        await updateLabel(editing._id, {
          name: form.name.trim(),
          nameEn: form.nameEn.trim(),
          color: form.color,
          icon: form.icon.trim(),
        });
      } else {
        await createLabel({
          name: form.name.trim(),
          nameEn: form.nameEn.trim(),
          color: form.color,
        });
      }
    },
    onSuccess: () => {
      toast.success(t('admin.saved'));
      invalidate();
      setOpen(false);
      setEditing(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('admin.saveFailed')),
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const label = labels.data?.find((l) => l._id === id);
      if (!label) return;
      await updateLabel(id, { isActive: !label.isActive });
    },
    onSuccess: () => {
      toast.success(t('admin.saved'));
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLabel(id),
    onSuccess: () => {
      toast.success(t('common.delete'));
      invalidate();
      setDeleting(null);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : t('admin.saveFailed');
      toast.error(msg);
    },
  });

  return (
    <div>
      <PageHeader
        title={lang === 'ar' ? 'البطاقات / التسميات' : 'Labels'}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {lang === 'ar' ? 'إضافة بطاقة' : 'Add Label'}
          </Button>
        }
      />

      {labels.isLoading ? (
        <Skeleton className="h-96" />
      ) : labels.data && labels.data.length > 0 ? (
        <TableWrap>
          <thead>
            <tr>
              <Th>{lang === 'ar' ? 'البطاقة' : 'Label'}</Th>
              <Th>{lang === 'ar' ? 'المنتجات' : 'Products'}</Th>
              <Th>{t('admin.available')}</Th>
              <Th className="text-end">{t('admin.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {labels.data.map((l) => (
              <tr key={l._id} className="group transition-colors hover:bg-[var(--tw-hover)]">
                <Td>
                  <div className="flex items-center gap-3">
                    <span
                      className="h-8 w-8 shrink-0 rounded-full ring-2 ring-inset ring-white/10 shadow-sm"
                      style={{ backgroundColor: l.color }}
                    />
                    <div>
                      <p className="font-bold tracking-tight text-[var(--tw-text)]">{l.name}</p>
                      {l.nameEn && <p className="text-xs text-[var(--tw-text-muted)]">{l.nameEn}</p>}
                    </div>
                  </div>
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-bold text-brand-400">
                    {l.productCount ?? 0} {lang === 'ar' ? 'منتج' : 'products'}
                  </span>
                </Td>
                <Td>
                  <ToggleSwitch checked={l.isActive} onChange={() => toggleMutation.mutate(l._id)} disabled={toggleMutation.isPending} />
                </Td>
                <Td className="text-end">
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(l)} aria-label={t('common.edit')}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => setDeleting(l)}
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
            <EmptyState
              title={lang === 'ar' ? 'لا توجد بطاقات' : 'No labels yet'}
              hint={lang === 'ar' ? 'أنشئ بطاقات لتصنيف المنتجات' : 'Create labels to classify products'}
            />
          </CardContent>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t('common.edit') : t('common.add')} size="md">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="l-name">{lang === 'ar' ? 'الاسم بالعربي' : 'Name (Arabic)'}</Label>
              <Input id="l-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={lang === 'ar' ? 'مثال: مميز' : 'e.g. Premium'} />
            </div>
            <div>
              <Label htmlFor="l-nameen">{lang === 'ar' ? 'الاسم بالإنجليزي' : 'Name (English)'}</Label>
              <Input id="l-nameen" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="e.g. Premium" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="l-color">{lang === 'ar' ? 'اللون' : 'Color'}</Label>
              <div className="flex items-center gap-3">
                <input
                  id="l-color"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-10 w-14 rounded border border-[var(--tw-border-strong)] bg-[var(--tw-surface-alt)] cursor-pointer"
                />
                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1" dir="ltr" />
              </div>
            </div>
            <div>
              <Label htmlFor="l-icon">{lang === 'ar' ? 'الأيقونة (اختياري)' : 'Icon (optional)'}</Label>
              <Input id="l-icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="🔥" />
            </div>
          </div>

          {/* Preview */}
          {form.name.trim() && (
            <div>
              <Label>{lang === 'ar' ? 'معاينة' : 'Preview'}</Label>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{ borderColor: form.color, backgroundColor: `${form.color}20`, color: form.color }}
                >
                  {form.icon ? `${form.icon} ` : ''}{form.name}
                  {form.nameEn ? ` (${form.nameEn})` : ''}
                </span>
              </div>
            </div>
          )}

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
        message={
          deleting?.productCount
            ? (lang === 'ar'
              ? `هذه البطاقة مستخدمة من ${deleting.productCount} منتج. هل أنت متأكد من الحذف؟`
              : `This label is used by ${deleting.productCount} products. Are you sure you want to delete it?`)
            : t('admin.confirmDelete')
        }
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
