import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Logo } from '@/components/logo/Logo';
import { resetPassword } from '@/api/auth';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { FieldError, Label, PasswordInput } from '@/components/ui/Input';
import { OtpInput } from '@/components/ui/OtpInput';

const CODE_LENGTH = 6;

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token') ?? '';
  const [code, setCode] = useState('');

  const schema = z
    .object({
      password: z.string().min(6),
      confirmPassword: z.string(),
    })
    .refine((values) => values.password === values.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);

  const token = urlToken || code;
  const codeComplete = !urlToken && code.length === CODE_LENGTH;

  const mutation = useMutation({
    mutationFn: (values: FormValues) => resetPassword(token, values.password),
    onSuccess: () => {
      setDone(true);
      reset();
    },
    onError: (error) => setServerError(getErrorMessage(error)),
  });

  if (!urlToken && !codeComplete) {
    return (
      <div className="container-px flex min-h-[70vh] items-center justify-center py-16">
        <div className="w-full max-w-md rounded-3xl border border-night-800 bg-night-900 p-8">
          <div className="mb-8 text-center">
            <Logo className="mx-auto h-14 w-14 rounded-2xl" />
            <h1 className="mt-4 text-2xl font-extrabold text-night-50">{t('auth.otpHeading')}</h1>
            <p className="mt-1 text-sm text-night-400">{t('auth.otpHint')}</p>
          </div>
          <OtpInput value={code} onChange={setCode} length={CODE_LENGTH} />
          <p className="mt-3 text-center text-xs text-night-500">{t('auth.otpAutoNext')}</p>
          <p className="mt-6 text-center text-sm text-night-400">
            <Link to="/forgot-password" className="font-bold text-brand-500 hover:text-brand-400">
              {t('auth.sendResetLink')}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-px flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-night-800 bg-night-900 p-8">
        <div className="mb-8 text-center">
          <Logo className="mx-auto h-14 w-14 rounded-2xl" />
          <h1 className="mt-4 text-2xl font-extrabold text-night-50">{t('auth.resetTitle')}</h1>
          <p className="mt-1 text-sm text-night-400">{t('auth.resetSubtitle')}</p>
        </div>

        {done ? (
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-4 text-sm text-brand-400">
            {t('auth.resetSuccess')}
          </div>
        ) : (
          <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            <div>
              <Label htmlFor="password">{t('auth.newPassword')}</Label>
              <PasswordInput id="password" type="password" {...register('password')} error={Boolean(errors.password)} />
              <FieldError message={errors.password?.message} />
            </div>
            <div>
              <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
              <PasswordInput
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
                error={Boolean(errors.confirmPassword)}
              />
              <FieldError message={errors.confirmPassword?.message} />
            </div>
            {serverError ? <p className="text-sm text-red-400">{serverError}</p> : null}
            <Button type="submit" loading={mutation.isPending} className="w-full">
              {t('auth.resetPasswordBtn')}
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