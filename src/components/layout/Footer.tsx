import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Clock, MapPin, Phone } from 'lucide-react';
import { Logo } from '@/components/logo/Logo';

const WHATSAPP_PATH =
  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z';

const socials = [
  {
    label: 'WhatsApp',
    href: 'https://chat.whatsapp.com/Fs2uK3ZTKsCFKrPTNzjJkD?s=sw&p=a&mlu=0&ilr=0',
    path: WHATSAPP_PATH,
  },
];

export function Footer() {
  const { t, i18n } = useTranslation();

  const nav = [
    { to: '/menu', key: 'menu' },
    { to: '/about', key: 'about' },
    { to: '/branches', key: 'branches' },
    { to: '/blog', key: 'blog' },
    { to: '/gallery', key: 'gallery' },
    { to: '/contact', key: 'contact' },
  ];

  return (
    <footer className="border-t border-[var(--tw-border)] bg-[var(--tw-surface)]">
      <div className="container-px grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div className="lg:col-span-1">
          <Link to="/" className="flex items-center gap-3">
            <Logo className="h-10 w-10 rounded-xl" />
            <div>
              <span className="block text-lg font-extrabold text-brand-500">
                {i18n.language === 'ar' ? 'فريزر البلد' : t('nav.brand')}
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-widest text-[var(--tw-text-subtle)]">
                {i18n.language === 'ar' ? 'منتجات مجمدة طازجة' : 'Fresh Frozen Products'}
              </span>
            </div>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--tw-text-muted)]">{t('footer.tagline')}</p>
          <div className="mt-5 flex gap-2">
            {socials.map(({ label, href, path }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--tw-border)] text-[var(--tw-text-muted)] transition-all hover:border-brand-500/60 hover:bg-brand-500/10 hover:text-brand-500"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d={path} />
                </svg>
              </a>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--tw-text)]">
            {t('footer.quickLinks')}
          </h3>
          <ul className="space-y-2.5">
            {nav.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="py-1.5 text-sm text-[var(--tw-text-muted)] transition-colors hover:text-brand-500"
                >
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--tw-text)]">
            {t('footer.contact')}
          </h3>
          <ul className="space-y-3 text-sm text-[var(--tw-text-muted)]">
            <li className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 shrink-0 text-brand-500" />
              <span>{t('footer.hoursValue')}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-brand-500" />
              <span>{i18n.language === 'ar' ? 'مصر' : 'Egypt'}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 shrink-0 text-brand-500" />
              <a href="tel:01204019307" dir="ltr" className="transition-colors hover:text-brand-500">01204019307</a>
            </li>
          </ul>
        </div>

        {/* Newsletter / Info */}
        <div>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--tw-text)]">
            {i18n.language === 'ar' ? 'معلومات' : 'Info'}
          </h3>
          <ul className="space-y-2.5 text-sm text-[var(--tw-text-muted)]">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-fresh-500" />
              <span>{i18n.language === 'ar' ? 'منتجات طازجة من المجمّع' : 'Fresh products from the market'}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-fresh-500" />
              <span>{i18n.language === 'ar' ? 'جودة عالية وأسعار مناسبة' : 'High quality at affordable prices'}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-fresh-500" />
              <span>{i18n.language === 'ar' ? 'توصيل سريع وآمن' : 'Fast and safe delivery'}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-[var(--tw-border)] bg-[var(--tw-surface-alt)]">
        <div className="container-px flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-xs text-[var(--tw-text-muted)]">
            © {new Date().getFullYear()} {i18n.language === 'ar' ? 'فريزر البلد' : t('nav.brand')}. {t('footer.rights')}
          </p>
          <p className="text-xs text-[var(--tw-text-subtle)]">
            {i18n.language === 'ar' ? 'تصميم احترافي' : 'Professional Design'}
          </p>
        </div>
      </div>
    </footer>
  );
}
