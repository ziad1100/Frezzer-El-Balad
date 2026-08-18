import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Logo } from '@/components/logo/Logo';
import { toast } from 'sonner';
import { getSocialProviders, login } from '@/api/auth';
import { getCart } from '@/api/cart';
import { setCredentials } from '@/store/slices/authSlice';
import { addLine } from '@/store/slices/cartSlice';
import { useAppDispatch } from '@/hooks';
import { apiBaseUrl, getErrorMessage } from '@/lib/api';
import { postAuthTarget } from '@/lib/authRedirect';
import { Button } from '@/components/ui/Button';
import { FieldError, Input, Label, PasswordInput } from '@/components/ui/Input';

export function LoginPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const [serverError, setServerError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  // Derived from the URL — no effect needed for the message itself.
  const oauthError = (() => {
    const error = searchParams.get('error');
    if (error === 'deactivated') return t('auth.accountDeactivated');
    if (error === 'google' || error === 'facebook') return t('auth.socialLoginFailed');
    return '';
  })();

  // Only clean the marker from the URL (a navigation, not a state update).
  useEffect(() => {
    if (searchParams.get('error')) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const { data: providers } = useQuery({
    queryKey: ['social-providers'],
    queryFn: getSocialProviders,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => login(values.email, values.password),
    onSuccess: async (data) => {
      dispatch(setCredentials({ token: data.accessToken, user: data.user }));
      try {
        const raw = localStorage.getItem('ph_cart');
        const empty = !raw || (JSON.parse(raw) as { lines: unknown[] }).lines.length === 0;
        if (empty) {
          const cart = await getCart();
          for (const item of cart.items) {
            if (!item.product) continue;
            const p = item.product;
            const size = p.sizes.find((s) => String(s._id) === String(item.size));
            dispatch(
              addLine({
                productId: String(p._id),
                name: p.name,
                nameEn: p.nameEn,
                image: p.images[0] ?? '',
                slug: p.slug,
                size: item.size ? String(item.size) : size?._id ? String(size._id) : null,
                sizeName: item.sizeName || (size ? size.name : ''),
                extras: item.extras.map((e) => ({ name: e.name, nameEn: e.nameEn, price: e.price })),
                qty: item.qty,
                unitPrice: item.unitPrice,
              }),
            );
          }
        }
      } catch {
        // server cart unavailable — local cart stays untouched
      }
      toast.success(t('auth.loginTitle'));
      const from = (location.state as { from?: string } | null)?.from;
      navigate(postAuthTarget(data.user, from), { replace: true });
    },
    onError: (error) => {
      setServerError(getErrorMessage(error));
    },
  });

  return (
    <div className="container-px flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-night-800 bg-night-900 p-8">
        <div className="mb-8 text-center">
          <Logo className="mx-auto h-14 w-14 rounded-2xl" />
          <h1 className="mt-4 text-2xl font-extrabold text-night-50">{t('auth.loginTitle')}</h1>
          <p className="mt-1 text-sm text-night-400">{t('auth.loginSubtitle')}</p>
        </div>

        {oauthError ? (
          <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-400">
            {oauthError}
          </p>
        ) : null}

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
          <div>
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input id="email" type="email" {...register('email')} error={Boolean(errors.email)} />
            <FieldError message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="password">{t('auth.password')}</Label>
            <PasswordInput id="password" type="password" {...register('password')} error={Boolean(errors.password)} />
            <FieldError message={errors.password?.message} />
          </div>
          {serverError ? <p className="text-sm text-red-400">{serverError}</p> : null}
          <Button type="submit" loading={mutation.isPending} className="w-full">
            {t('auth.signIn')}
          </Button>
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="font-semibold text-brand-500 hover:text-brand-400">
              {t('auth.forgotPassword')}
            </Link>
          </p>
        </form>

        {providers?.google || providers?.facebook ? (
          <>
            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-night-500">
              <span className="h-px flex-1 bg-night-800" />
              <span>{t('auth.or')}</span>
              <span className="h-px flex-1 bg-night-800" />
            </div>
            <div className="space-y-3">
              {providers?.google ? (
                <a
                  href={`${apiBaseUrl}/auth/google`}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-night-700 text-sm font-semibold text-night-100 transition-colors hover:border-brand-500 hover:text-brand-400"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z" />
                  </svg>
                  {t('auth.google')}
                </a>
              ) : null}
              {providers?.facebook ? (
                <a
                  href={`${apiBaseUrl}/auth/facebook`}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-night-700 text-sm font-semibold text-night-100 transition-colors hover:border-brand-500 hover:text-brand-400"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                    <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.95.92-1.95 1.87V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12Z" />
                  </svg>
                  {t('auth.facebook')}
                </a>
              ) : null}
            </div>
          </>
        ) : null}

        <p className="mt-6 text-center text-sm text-night-400">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-bold text-brand-500 hover:text-brand-400">
            {t('auth.register')}
          </Link>
        </p>
      </div>
    </div>
  );
}