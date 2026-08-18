import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { FieldError, Input, Label, Textarea } from '@/components/ui/Input';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(8),
  message: z.string().min(10),
});
type FormValues = z.infer<typeof schema>;

export function ContactPage() {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.post('/contacts', values),
    onSuccess: () => {
      toast.success(t('checkout.orderSuccess'));
      reset();
    },
    onError: () => toast.error(t('misc.error')),
  });

  return (
    <div className="container-px py-16">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-night-50">{t('nav.contact')}</h1>
      </div>
      <div className="mx-auto max-w-xl">
        <Card>
          <CardContent className="p-7">
            <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t('auth.fullName')}</Label>
                  <Input {...register('name')} error={Boolean(errors.name)} />
                  <FieldError message={errors.name?.message} />
                </div>
                <div>
                  <Label>{t('auth.email')}</Label>
                  <Input type="email" dir="ltr" {...register('email')} error={Boolean(errors.email)} />
                  <FieldError message={errors.email?.message} />
                </div>
              </div>
              <div>
                <Label>{t('auth.phone')}</Label>
                <Input dir="ltr" {...register('phone')} />
                <FieldError message={errors.phone?.message} />
              </div>
              <div>
                <Label>{t('checkout.notes')}</Label>
                <Textarea rows={5} {...register('message')} error={Boolean(errors.message)} />
                <FieldError message={errors.message?.message} />
              </div>
              <Button type="submit" className="w-full" loading={mutation.isPending}>
                <Send className="h-5 w-5" />
                {t('common.contactUs')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}