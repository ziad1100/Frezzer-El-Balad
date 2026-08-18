import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { getAdminSettings, updateSettings } from '@/api/admin';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, Skeleton } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Input';
import { PageHeader } from '@/components/admin/primitives';
import type { SettingsMap } from '@/types';

interface SettingsForm {
  deliveryFee: string;
  minimumOrder: string;
  freeDeliveryOver: string;
  phone: string;
  whatsapp: string;
  facebook: string;
  instagram: string;
  workingHoursAr: string;
  workingHoursEn: string;
  taglineAr: string;
  taglineEn: string;
}

const toForm = (s: SettingsMap | undefined): SettingsForm => {
  const wh = (s?.workingHours as { ar?: string; en?: string } | undefined) ?? {};
  const tagline = (s?.tagline as { ar?: string; en?: string } | undefined) ?? {};
  return {
    deliveryFee: String(s?.deliveryFee ?? 25),
    minimumOrder: String(s?.minimumOrder ?? 100),
    freeDeliveryOver: String(s?.freeDeliveryOver ?? 0),
    phone: String(s?.phone ?? ''),
    whatsapp: String(s?.whatsapp ?? ''),
    facebook: String(s?.facebook ?? ''),
    instagram: String(s?.instagram ?? ''),
    workingHoursAr: String(wh.ar ?? ''),
    workingHoursEn: String(wh.en ?? ''),
    taglineAr: String(tagline.ar ?? ''),
    taglineEn: String(tagline.en ?? ''),
  };
};

export function AdminSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const settings = useQuery({ queryKey: ['admin', 'settings'], queryFn: getAdminSettings });

  if (settings.isLoading) return <Skeleton className="h-96" />;

  const settingsKey = settings.data ? JSON.stringify(settings.data) : '';

  return (
    <div>
      <PageHeader title={t('admin.nav.settings')} />
      <SettingsFormView key={settingsKey} settings={settings.data} queryClient={queryClient} t={t} />
    </div>
  );
}

function SettingsFormView({
  settings,
  queryClient,
  t,
}: {
  settings: SettingsMap | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const [form, setForm] = useState<SettingsForm>(() => toForm(settings));

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await updateSettings({
        deliveryFee: Number(form.deliveryFee) || 0,
        minimumOrder: Number(form.minimumOrder) || 0,
        freeDeliveryOver: Number(form.freeDeliveryOver) || 0,
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        facebook: form.facebook.trim(),
        instagram: form.instagram.trim(),
        workingHours: { ar: form.workingHoursAr.trim(), en: form.workingHoursEn.trim() },
        tagline: { ar: form.taglineAr.trim(), en: form.taglineEn.trim() },
      });
    },
    onSuccess: () => {
      toast.success(t('admin.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: () => toast.error(t('admin.saveFailed')),
  });

  return (
    <Card>
      <CardContent className="p-6">
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-bold text-night-300">{t('admin.nav.commerce')}</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="s-fee">{t('admin.deliveryFeeSetting')}</Label>
                  <Input id="s-fee" type="number" min={0} value={form.deliveryFee} onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="s-min">{t('admin.minimumOrderSetting')}</Label>
                  <Input id="s-min" type="number" min={0} value={form.minimumOrder} onChange={(e) => setForm({ ...form, minimumOrder: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="s-free">{t('admin.freeDeliverySetting')}</Label>
                  <Input id="s-free" type="number" min={0} value={form.freeDeliveryOver} onChange={(e) => setForm({ ...form, freeDeliveryOver: e.target.value })} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-bold text-night-300">{t('admin.nav.contacts')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="s-phone">{t('admin.phoneSetting')}</Label>
                  <Input id="s-phone" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="s-wa">{t('admin.whatsappSetting')}</Label>
                  <Input id="s-wa" dir="ltr" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="s-fb">{t('admin.facebookSetting')}</Label>
                  <Input id="s-fb" dir="ltr" value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="s-ig">{t('admin.instagramSetting')}</Label>
                  <Input id="s-ig" dir="ltr" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-bold text-night-300">{t('admin.nav.content')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="s-hours">{t('admin.workingHoursSetting')}</Label>
                  <Input id="s-hours" value={form.workingHoursAr} onChange={(e) => setForm({ ...form, workingHoursAr: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="s-hoursen">{t('admin.workingHoursEnSetting')}</Label>
                  <Input id="s-hoursen" value={form.workingHoursEn} onChange={(e) => setForm({ ...form, workingHoursEn: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="s-tag">{t('footer.tagline')}</Label>
                  <Input id="s-tag" value={form.taglineAr} onChange={(e) => setForm({ ...form, taglineAr: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="s-tagen">{t('admin.taglineEn')}</Label>
                  <Input id="s-tagen" value={form.taglineEn} onChange={(e) => setForm({ ...form, taglineEn: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                <Save className="h-4 w-4" />
                {t('common.save')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
  );
}