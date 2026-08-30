import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/logo/Logo';
import { forgotPassword, type DevResetPayload } from '@/api/auth';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { FieldError, Input, Label } from '@/components/ui/Input';

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

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
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        className="w-full max-w-sm"
      >
        {/* Logo + Title */}
        <motion.div variants={fadeUp} className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center justify-center">
            <Logo className="h-14 w-14 rounded-2xl" />
          </Link>
          <h1 className="mt-5 text-xl font-extrabold tracking-tight text-[var(--tw-text)]">
            {t('auth.forgotTitle')}
          </h1>
          <p className="mt-2 text-sm text-[var(--tw-text-muted)]">
            {t('auth.forgotSubtitle')}
          </p>
        </motion.div>

        {/* Card */}
        <motion.div variants={fadeUp} className="rounded-3xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] p-6">
          {sent ? (
            devPayload ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-brand-500/30 bg-brand-500/10 p-4 text-center">
                  <p className="text-sm font-bold text-brand-400">{t('auth.devResetHint')}</p>
                </div>
                <div className="rounded-2xl bg-[var(--tw-surface-alt)] p-4 text-center" dir="ltr">
                  <span className="font-mono text-4xl font-extrabold tracking-[0.5em] text-brand-400">
                    {devPayload.code}
                  </span>
                </div>
                <p className="text-xs text-center text-[var(--tw-text-muted)]">{t('auth.devResetCodeHint')}</p>
                <a
                  href={devPayload.link}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-brand-600"
                >
                  {t('auth.continueReset')}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-brand-500/30 bg-brand-500/10 p-4 text-center text-sm text-brand-400">
                  {t('auth.resetLinkSent')}
                </div>
                <Link
                  to="/reset-password"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-brand-600"
                >
                  {t('auth.enterResetCode')}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </div>
            )
          ) : (
            <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
              <div>
                <Label htmlFor="email">
                  <Mail className="h-3.5 w-3.5" />
                  {t('auth.email')}
                </Label>
                <Input id="email" type="email" dir="ltr" {...register('email')} error={Boolean(errors.email)} />
                <FieldError message={errors.email?.message} />
              </div>
              {serverError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">{serverError}</div>
              ) : null}
              <Button type="submit" loading={mutation.isPending} className="w-full" size="lg">
                {t('auth.sendResetLink')}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-[var(--tw-text-muted)]">
            <Link to="/login" className="font-bold text-brand-500 hover:text-brand-400">
              {t('auth.backToLogin')}
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
