import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { Logo } from '@/components/logo/Logo';

// Official brand glyphs (viewBox 0 0 24 24, fill=currentColor).
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
  const { t } = useTranslation();

  const nav = [
    { to: '/menu', key: 'menu' },
    { to: '/about', key: 'about' },
    { to: '/branches', key: 'branches' },
    { to: '/blog', key: 'blog' },
    { to: '/gallery', key: 'gallery' },
    { to: '/contact', key: 'contact' },
  ];

  return (
    <footer className="border-t border-night-800 bg-night-950">
      <div className="container-px grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-10 w-10 rounded-xl" />
            <span className="text-xl font-extrabold text-night-50">
              ولاد<span className="text-brand-500"> حلال</span>
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-night-400">{t('footer.tagline')}</p>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-night-300">
            {t('footer.quickLinks')}
          </h3>
          <ul className="space-y-2.5">
            {nav.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="text-sm text-night-400 transition-colors hover:text-brand-500"
                >
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-night-300">
            {t('footer.contact')}
          </h3>
          <ul className="space-y-3 text-sm text-night-400">
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-500" />
              <span>{t('footer.hoursValue')}</span>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-night-300">Social</h3>
          <div className="flex gap-2">
            {socials.map(({ label, href, path }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-night-800 text-night-300 transition-colors hover:border-brand-500 hover:text-brand-500"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d={path} />
                </svg>
              </a>
            ))}
          </div>
          <p className="mt-4 text-sm text-night-500">
            © {new Date().getFullYear()} {t('nav.brand')}. {t('footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  );
}