import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Logo } from '@/components/logo/Logo';
import { verifyEmail } from '@/api/auth';

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const { isPending, isError } = useQuery({
    queryKey: ['verify-email', token],
    queryFn: () => verifyEmail(token),
    enabled: Boolean(token),
    retry: false,
  });

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        className="w-full max-w-sm text-center"
      >
        <motion.div variants={fadeUp} className="mb-8">
          <Link to="/" className="inline-flex items-center justify-center">
            <Logo className="h-14 w-14 rounded-2xl" />
          </Link>
          <h1 className="mt-5 text-xl font-extrabold tracking-tight text-[var(--tw-text)]">{t('auth.verifyTitle')}</h1>
        </motion.div>

        <motion.div variants={fadeUp} className="rounded-3xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] p-8">
          {isPending ? (
            <div className="py-6">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-[3px] border-brand-500 border-t-transparent" />
              <p className="mt-6 text-sm text-[var(--tw-text-muted)]">{t('auth.verifyingEmail')}</p>
            </div>
          ) : isError || !token ? (
            <div className="py-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
              <p className="mt-5 text-sm font-bold text-red-400">{t('auth.verifyFailed')}</p>
            </div>
          ) : (
            <div className="py-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="mt-5 text-sm font-bold text-emerald-400">{t('auth.verifySuccess')}</p>
            </div>
          )}
        </motion.div>

        <motion.p variants={fadeUp} className="mt-6 text-sm text-[var(--tw-text-muted)]">
          <Link to="/login" className="font-bold text-brand-500 hover:text-brand-400">
            {t('auth.backToLogin')}
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
