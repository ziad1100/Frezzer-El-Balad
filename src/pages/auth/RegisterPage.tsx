import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck, UserRound } from 'lucide-react';
import { Logo } from '@/components/logo/Logo';
import { toast } from 'sonner';
import { register as registerUser } from '@/api/auth';
import { setCredentials } from '@/store/slices/authSlice';
import { useAppDispatch } from '@/hooks';
import { getErrorMessage } from '@/lib/api';
import { postAuthTarget } from '@/lib/authRedirect';
import { EGYPTIAN_MOBILE_REGEX } from '@/lib/validation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { FieldError, Input, Label, PasswordInput } from '@/components/ui/Input';

export function RegisterPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const schema = z
    .object({
      fullName: z.string().min(2),
      phone: z.string().trim().regex(EGYPTIAN_MOBILE_REGEX, t('common.phoneInvalid')),
      email: z.string().email(),
      password: z.string().min(6),
      confirmPassword: z.string(),
      role: z.enum(['customer', 'admin']),
      adminCode: z.string(),
    })
    .refine((values) => values.password === values.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    })
    .refine((values) => values.role !== 'admin' || values.adminCode.trim().length > 0, {
      path: ['adminCode'],
      message: t('auth.adminCodeRequired'),
    });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { role: 'customer', adminCode: '' },
  });

  const role = useWatch({ control, name: 'role' });
  const [serverError, setServerError] = useState('');

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      registerUser({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
        role: values.role,
        adminCode: values.role === 'admin' ? values.adminCode : undefined,
      }),
    onSuccess: (data) => {
      dispatch(setCredentials({ token: data.accessToken, user: data.user }));
      toast.success(t('auth.registerTitle'));
      navigate(postAuthTarget(data.user), { replace: true });
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
          <h1 className="mt-4 text-2xl font-extrabold text-night-50">{t('auth.registerTitle')}</h1>
          <p className="mt-1 text-sm text-night-400">{t('auth.registerSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
          <div>
            <Label htmlFor="fullName">{t('auth.fullName')}</Label>
            <Input id="fullName" {...register('fullName')} error={Boolean(errors.fullName)} />
            <FieldError message={errors.fullName?.message} />
          </div>
          <div>
            <Label htmlFor="phone">{t('auth.phone')}</Label>
            <Input id="phone" dir="ltr" inputMode="numeric" maxLength={11} {...register('phone')} error={Boolean(errors.phone)} />
            <FieldError message={errors.phone?.message} />
          </div>
          <div>
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input id="email" type="email" dir="ltr" {...register('email')} error={Boolean(errors.email)} />
            <FieldError message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="password">{t('auth.password')}</Label>
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

          <div>
            <Label htmlFor="role">{t('auth.accountType')}</Label>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t('auth.accountType')}>
              <button
                type="button"
                role="radio"
                aria-checked={role === 'customer'}
                onClick={() => setValue('role', 'customer', { shouldValidate: true })}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors',
                  role === 'customer'
                    ? 'border-brand-500 bg-brand-600/15 text-brand-500'
                    : 'border-night-800 bg-night-900 text-night-300 hover:bg-night-800',
                )}
              >
                <UserRound className="h-4 w-4" />
                {t('auth.accountTypeCustomer')}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={role === 'admin'}
                onClick={() => setValue('role', 'admin', { shouldValidate: true })}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors',
                  role === 'admin'
                    ? 'border-brand-500 bg-brand-600/15 text-brand-500'
                    : 'border-night-800 bg-night-900 text-night-300 hover:bg-night-800',
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                {t('auth.accountTypeAdmin')}
              </button>
            </div>
            {role === 'admin' ? (
              <div className="mt-4">
                <Label htmlFor="adminCode">{t('auth.adminCode')}</Label>
                <Input
                  id="adminCode"
                  dir="ltr"
                  {...register('adminCode')}
                  error={Boolean(errors.adminCode)}
                />
                <FieldError message={errors.adminCode?.message} />
              </div>
            ) : null}
          </div>

          {serverError ? <p className="text-sm text-red-400">{serverError}</p> : null}
          <Button type="submit" loading={mutation.isPending} className="w-full">
            {t('auth.create')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-night-400">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-bold text-brand-500 hover:text-brand-400">
            {t('auth.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}