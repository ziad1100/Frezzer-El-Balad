import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Logo } from '@/components/logo/Logo';
import { verifyEmail } from '@/api/auth';

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
    <div className="container-px flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] p-6 text-center">
        <Logo className="mx-auto h-12 w-12 rounded-xl" />
        <h1 className="mt-3 text-xl font-extrabold text-[var(--tw-text)]">{t('auth.verifyTitle')}</h1>

        {isPending ? (
          <>
            <div className="mx-auto mt-8 h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <p className="mt-6 text-sm text-[var(--tw-text-muted)]">{t('auth.verifyingEmail')}</p>
          </>
        ) : isError || !token ? (
          <>
            <XCircle className="mx-auto mt-8 h-10 w-10 text-red-400" />
            <p className="mt-6 text-sm text-[var(--tw-text-muted)]">{t('auth.verifyFailed')}</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto mt-8 h-10 w-10 text-emerald-400" />
            <p className="mt-6 text-sm text-[var(--tw-text-muted)]">{t('auth.verifySuccess')}</p>
          </>
        )}

        <p className="mt-8 text-sm text-[var(--tw-text-muted)]">
          <Link to="/login" className="font-bold text-brand-500 hover:text-brand-400">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
