import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getMe } from '@/api/auth';
import { setStoredToken } from '@/lib/api';
import { setCredentials } from '@/store/slices/authSlice';
import { useAppDispatch } from '@/hooks';
import { postAuthTarget } from '@/lib/authRedirect';

export function AuthCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      toast.error(t('auth.socialLoginFailed'));
      navigate('/login', { replace: true });
      return;
    }

    let token = searchParams.get('accessToken');
    if (!token) {
      const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
      token = hash.get('accessToken') ?? '';
    }
    if (!token) {
      toast.error(t('auth.socialLoginFailed'));
      navigate('/login', { replace: true });
      return;
    }

    setStoredToken(token);
    getMe()
      .then((user) => {
        dispatch(setCredentials({ token, user }));
        navigate(postAuthTarget(user), { replace: true });
      })
      .catch(() => {
        toast.error(t('auth.socialLoginFailed'));
        navigate('/login', { replace: true });
      });
  }, [location.hash, searchParams, navigate, dispatch, t]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  );
}