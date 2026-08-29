import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Clock, MapPin, Phone } from 'lucide-react';
import { Logo } from '@/components/logo/Logo';

const FACEBOOK_PATH =
  'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z';

const socials = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/share/1Bj37phnYw/',
    path: FACEBOOK_PATH,
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
                  className="text-sm text-[var(--tw-text-muted)] transition-colors hover:text-brand-500"
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
              <span dir="ltr">+20 1XX XXX XXXX</span>
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
