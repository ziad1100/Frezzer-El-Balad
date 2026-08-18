import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { Mail, ShieldCheck, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { changeEmail, changePassword, verifyEmailChange } from '@/api/auth';
import { useAppSelector } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { FieldError, Input, Label, PasswordInput } from '@/components/ui/Input';
import { PageHeader } from '@/components/admin/primitives';
import { getErrorMessage } from '@/lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function useVerifyEmailToken() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const token = params.get('verify-email');

  const verifyMutation = useMutation({
    mutationFn: (tok: string) => verifyEmailChange(tok),
    onSuccess: (res) => {
      toast.success(t('admin.account.emailVerified', { email: res.email }));
      setParams({}, { replace: true });
    },
    onError: (err) => {
      toast.error(t('admin.account.emailVerifyFailed') + ` (${getErrorMessage(err)})`);
      setParams({}, { replace: true });
    },
  });

  useEffect(() => {
    if (token) {
      verifyMutation.mutate(token);
      navigate('/admin/account', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return verifyMutation.isPending;
}

function EmailForm({ currentEmail }: { currentEmail: string }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; confirmEmail?: string; currentPassword?: string }>({});

  const mutation = useMutation({
    mutationFn: changeEmail,
    onSuccess: (res) => {
      if (res.pending) {
        toast.success(t('admin.account.emailChangePending'));
      } else {
        toast.success(t('admin.account.emailChanged', { email: res.email }));
      }
      setEmail('');
      setConfirmEmail('');
      setCurrentPassword('');
      setErrors({});
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const submit = (): void => {
    const next: typeof errors = {};
    const normalized = email.trim();
    if (!normalized || !EMAIL_RE.test(normalized)) next.email = t('admin.account.emailInvalid');
    if (normalized !== confirmEmail.trim()) next.confirmEmail = t('admin.account.emailMismatch');
    if (!currentPassword) next.currentPassword = t('admin.account.currentPasswordRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    mutation.mutate({ email: normalized, confirmEmail: normalized, currentPassword });
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-night-300">
          <Mail className="h-4 w-4" />
          {t('admin.account.emailTitle')}
        </h3>
        <p className="mb-4 text-sm text-night-500">
          {t('admin.account.emailHint')} — {t('admin.account.currentIs', { email: currentEmail })}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="acc-email">{t('admin.account.newEmail')}</Label>
            <Input id="acc-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} error={Boolean(errors.email)} />
            <FieldError message={errors.email} />
          </div>
          <div>
            <Label htmlFor="acc-email-confirm">{t('admin.account.confirmNewEmail')}</Label>
            <Input id="acc-email-confirm" type="email" dir="ltr" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} error={Boolean(errors.confirmEmail)} />
            <FieldError message={errors.confirmEmail} />
          </div>
        </div>
        <div className="mt-4 max-w-sm">
          <Label htmlFor="acc-email-pass">{t('admin.account.currentPassword')}</Label>
          <PasswordInput id="acc-email-pass" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} error={Boolean(errors.currentPassword)} />
          <FieldError message={errors.currentPassword} />
        </div>
        <div className="mt-5 flex justify-end">
          <Button loading={mutation.isPending} onClick={submit}>
            {t('admin.account.changeEmail')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PasswordForm() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [errors, setErrors] = useState<{ currentPassword?: string; newPassword?: string; confirmNew?: string }>({});

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      toast.success(t('admin.account.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNew('');
      setErrors({});
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const submit = (): void => {
    const next: typeof errors = {};
    if (!currentPassword) next.currentPassword = t('admin.account.currentPasswordRequired');
    if (!newPassword || newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      next.newPassword = t('admin.account.weakPassword');
    }
    if (newPassword !== confirmNew) next.confirmNew = t('admin.account.passwordMismatch');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    mutation.mutate({ currentPassword, newPassword, newPasswordConfirm: confirmNew });
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-night-300">
          <KeyRound className="h-4 w-4" />
          {t('admin.account.passwordTitle')}
        </h3>
        <p className="mb-4 text-sm text-night-500">{t('admin.account.passwordHint')}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="acc-pass-current">{t('admin.account.currentPassword')}</Label>
            <PasswordInput id="acc-pass-current" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} error={Boolean(errors.currentPassword)} />
            <FieldError message={errors.currentPassword} />
          </div>
          <div>
            <Label htmlFor="acc-pass-new">{t('admin.account.newPassword')}</Label>
            <PasswordInput id="acc-pass-new" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} error={Boolean(errors.newPassword)} />
            <FieldError message={errors.newPassword} />
          </div>
          <div>
            <Label htmlFor="acc-pass-confirm">{t('admin.account.confirmNewPassword')}</Label>
            <PasswordInput id="acc-pass-confirm" value={confirmNew} onChange={(e) => setConfirmNew(e.target.value)} error={Boolean(errors.confirmNew)} />
            <FieldError message={errors.confirmNew} />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="gold" loading={mutation.isPending} onClick={submit}>
            {t('admin.account.changePassword')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminAccountPage() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const verifying = useVerifyEmailToken();
  const currentEmail = useMemo(() => user?.email ?? '', [user?.email]);

  if (!user || user.role !== 'admin') {
    return (
      <div>
        <PageHeader title={t('admin.account.title')} />
        <Card>
          <CardContent className="p-6">
            <p className="flex items-center gap-2 text-sm text-night-300">
              <ShieldCheck className="h-4 w-4 text-brand-500" />
              {t('admin.account.noAccess')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.account.title')} subtitle={t('admin.account.subtitle')} />
      {verifying ? <p className="text-sm text-night-400">{t('common.loading')}</p> : null}
      <EmailForm currentEmail={currentEmail} />
      <PasswordForm />
    </div>
  );
}
