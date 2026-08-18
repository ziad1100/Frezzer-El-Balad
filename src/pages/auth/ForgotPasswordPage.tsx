import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Logo } from '@/components/logo/Logo';
import { forgotPassword, type DevResetPayload } from '@/api/auth';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { FieldError, Input, Label } from '@/components/ui/Input';

export function ForgotPasswordPage() {
  const { t } = useTranslation();

  const schema = z.object({ email: z.string().email() });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const [serverError, setServerError] = useState('');
  const [sent, setSent] = useState(false);
  const [devPayload, setDevPayload] = useState<DevResetPayload | null>(null);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => forgotPassword(values.email),
    onSuccess: (payload) => {
      setDevPayload(payload);
      setSent(true);
    },
    onError: (error) => setServerError(getErrorMessage(error)),
  });

  return (
    <div className="container-px flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-night-800 bg-night-900 p-8">
        <div className="mb-8 text-center">
          <Logo className="mx-auto h-14 w-14 rounded-2xl" />
          <h1 className="mt-4 text-2xl font-extrabold text-night-50">{t('auth.forgotTitle')}</h1>
          <p className="mt-1 text-sm text-night-400">{t('auth.forgotSubtitle')}</p>
        </div>

        {sent ? (
          devPayload ? (
            <div className="space-y-4 rounded-xl border border-night-700 bg-night-800 p-4 text-sm">
              <p className="font-bold text-brand-400">{t('auth.devResetHint')}</p>
              <div className="rounded-lg bg-night-900 p-3 text-center" dir="ltr">
                <span className="font-mono text-4xl font-extrabold tracking-[0.5em] text-brand-400">
                  {devPayload.code}
                </span>
              </div>
              <p className="text-night-400">{t('auth.devResetCodeHint')}</p>
              <a
                href={devPayload.link}
                className="block rounded-lg bg-brand-500 py-2.5 text-center font-bold text-night-950 hover:bg-brand-400"
              >
                {t('auth.continueReset')}
              </a>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-brand-500/30 bg-brand-500/10 p-4 text-sm text-brand-400">
              <p>{t('auth.resetLinkSent')}</p>
              <Link
                to="/reset-password"
                className="block rounded-lg bg-brand-500 py-2.5 text-center font-bold text-night-950 hover:bg-brand-400"
              >
                {t('auth.enterResetCode')}
              </Link>
            </div>
          )
        ) : (
          <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" dir="ltr" {...register('email')} error={Boolean(errors.email)} />
              <FieldError message={errors.email?.message} />
            </div>
            {serverError ? <p className="text-sm text-red-400">{serverError}</p> : null}
            <Button type="submit" loading={mutation.isPending} className="w-full">
              {t('auth.sendResetLink')}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-night-400">
          <Link to="/login" className="font-bold text-brand-500 hover:text-brand-400">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}