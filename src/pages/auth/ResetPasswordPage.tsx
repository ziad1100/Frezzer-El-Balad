import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Lock, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/logo/Logo';
import { resetPassword } from '@/api/auth';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { FieldError, Label, PasswordInput } from '@/components/ui/Input';
import { OtpInput } from '@/components/ui/OtpInput';

const CODE_LENGTH = 6;
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

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
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          className="w-full max-w-sm"
        >
          <motion.div variants={fadeUp} className="mb-8 text-center">
            <Link to="/" className="inline-flex items-center justify-center">
              <Logo className="h-14 w-14 rounded-2xl" />
            </Link>
            <h1 className="mt-5 text-xl font-extrabold tracking-tight text-[var(--tw-text)]">
              {t('auth.otpHeading')}
            </h1>
            <p className="mt-2 text-sm text-[var(--tw-text-muted)]">{t('auth.otpHint')}</p>
          </motion.div>

          <motion.div variants={fadeUp} className="rounded-3xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] p-6">
            <OtpInput value={code} onChange={setCode} length={CODE_LENGTH} />
            <p className="mt-3 text-center text-xs text-[var(--tw-text-muted)]">{t('auth.otpAutoNext')}</p>
          </motion.div>

          <motion.p variants={fadeUp} className="mt-6 text-center text-sm text-[var(--tw-text-muted)]">
            <Link to="/forgot-password" className="font-bold text-brand-500 hover:text-brand-400">
              {t('auth.sendResetLink')}
            </Link>
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        className="w-full max-w-sm"
      >
        <motion.div variants={fadeUp} className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center justify-center">
            <Logo className="h-14 w-14 rounded-2xl" />
          </Link>
          <h1 className="mt-5 text-xl font-extrabold tracking-tight text-[var(--tw-text)]">
            {t('auth.resetTitle')}
          </h1>
          <p className="mt-2 text-sm text-[var(--tw-text-muted)]">{t('auth.resetSubtitle')}</p>
        </motion.div>

        <motion.div variants={fadeUp} className="rounded-3xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] p-6">
          {done ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="mt-4 text-sm font-bold text-emerald-400">{t('auth.resetSuccess')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
              <div>
                <Label htmlFor="password">
                  <Lock className="h-3.5 w-3.5" />
                  {t('auth.newPassword')}
                </Label>
                <PasswordInput id="password" type="password" {...register('password')} error={Boolean(errors.password)} />
                <FieldError message={errors.password?.message} />
              </div>
              <div>
                <Label htmlFor="confirmPassword">
                  <Lock className="h-3.5 w-3.5" />
                  {t('auth.confirmPassword')}
                </Label>
                <PasswordInput
                  id="confirmPassword"
                  type="password"
                  {...register('confirmPassword')}
                  error={Boolean(errors.confirmPassword)}
                />
                <FieldError message={errors.confirmPassword?.message} />
              </div>
              {serverError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">{serverError}</div>
              ) : null}
              <Button type="submit" loading={mutation.isPending} className="w-full" size="lg">
                {t('auth.resetPasswordBtn')}
              </Button>
            </form>
          )}
        </motion.div>

        <motion.p variants={fadeUp} className="mt-6 text-center text-sm text-[var(--tw-text-muted)]">
          <Link to="/login" className="font-bold text-brand-500 hover:text-brand-400">
            {t('auth.backToLogin')}
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
