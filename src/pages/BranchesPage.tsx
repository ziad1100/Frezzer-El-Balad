import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Clock, MapPin, Phone } from 'lucide-react';
import { listBranches } from '@/api/posts';
import { Card, CardContent, Skeleton } from '@/components/ui/Card';

export function BranchesPage() {
  const { t, i18n } = useTranslation();
  const { data: branches, isLoading } = useQuery({ queryKey: ['branches'], queryFn: listBranches });
  const lang = i18n.language;

  return (
    <div className="container-px py-16">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-night-50">{t('nav.branches')}</h1>
        <p className="mt-2 text-night-400">{t('branches.subtitle')}</p>
      </div>
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {branches?.map((branch) => (
            <Card key={branch._id} className="transition-colors hover:border-night-600">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-bold text-night-50">
                    {lang === 'ar' ? branch.name : branch.nameEn || branch.name}
                  </h3>
                  {branch.address ? <MapPin className="h-5 w-5 shrink-0 text-brand-500" /> : null}
                </div>
                {branch.address ? (
                  <p className="mt-2 text-sm text-night-400">
                    {lang === 'ar' ? branch.address : branch.addressEn || branch.address}
                  </p>
                ) : null}
                <div className="mt-4 space-y-2 text-sm text-night-300">
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gold-500" />
                    <span dir="ltr">{branch.phone}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gold-500" />
                    {lang === 'ar' ? branch.workHours : branch.workHoursEn || branch.workHours}
                  </p>
                </div>
                {branch.googleMapsUrl ? (
                  <a
                    href={branch.googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-brand-500 hover:text-brand-400"
                  >
                    Google Maps
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}