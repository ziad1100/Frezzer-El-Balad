import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-night-900 text-brand-500">
        <Compass className="h-12 w-12" />
      </div>
      <h1 className="mt-6 text-6xl font-extrabold text-night-50">404</h1>
      <p className="mt-3 text-lg text-night-300">{t('misc.pageNotFound')}</p>
      <p className="mt-1 text-night-500">{t('misc.pageNotFoundHint')}</p>
      <Link to="/" className="mt-8">
        <Button variant="gold" size="lg">
          {t('misc.goHome')}
        </Button>
      </Link>
    </div>
  );
}