import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Boxes,
  ChevronRight,
  FileText,
  Home,
  Image as ImageIcon,
  Images,
  Languages,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Moon,
  Package,
  Percent,
  Settings,
  ShoppingCart,
  Star,
  Sun,
  Tag,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { Logo } from '@/components/logo/Logo';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { changeLanguage, type LanguageCode } from '@/i18n';
import { clearCredentials } from '@/store/slices/authSlice';
import { adminReviewStats } from '@/api/admin';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const navGroups: { label: string; items: { to: string; icon: typeof LayoutDashboard; label: string; end?: boolean }[] }[] = [
  {
    label: 'admin.nav.overview',
    items: [
      { to: '/', icon: Home, label: 'nav.home', end: true },
      { to: '/admin', icon: LayoutDashboard, label: 'admin.nav.dashboard', end: true },
    ],
  },
  {
    label: 'admin.nav.catalog',
    items: [
      { to: '/admin/products', icon: Package, label: 'admin.nav.products' },
      { to: '/admin/categories', icon: Boxes, label: 'admin.nav.categories' },
      { to: '/admin/offers', icon: Tag, label: 'admin.nav.offers' },
      { to: '/admin/coupons', icon: Percent, label: 'admin.nav.coupons' },
      { to: '/admin/banners', icon: ImageIcon, label: 'admin.nav.banners' },
      { to: '/admin/gallery', icon: Images, label: 'admin.nav.gallery' },
    ],
  },
  {
    label: 'admin.nav.commerce',
    items: [
      { to: '/admin/orders', icon: ShoppingCart, label: 'admin.nav.orders' },
      { to: '/admin/reviews', icon: Star, label: 'admin.nav.reviews' },
      { to: '/admin/users', icon: Users, label: 'admin.nav.users' },
    ],
  },
  {
    label: 'admin.nav.content',
    items: [
      { to: '/admin/posts', icon: FileText, label: 'admin.nav.posts' },
      { to: '/admin/branches', icon: MapPin, label: 'admin.nav.branches' },
      { to: '/admin/contacts', icon: Mail, label: 'admin.nav.contacts' },
      { to: '/admin/settings', icon: Settings, label: 'admin.nav.settings' },
      { to: '/admin/account', icon: UserCog, label: 'admin.nav.account' },
    ],
  },
];

export function AdminLayout() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const { theme, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Pending-review count badge on the sidebar Reviews link (review moderation).
  const reviewStats = useQuery({
    queryKey: ['admin', 'review-stats'],
    queryFn: adminReviewStats,
    refetchInterval: 60_000,
  });
  const pendingReviews = reviewStats.data?.pending ?? 0;

  const toggleLanguage = (): void => {
    const next: LanguageCode = i18n.language === 'ar' ? 'en' : 'ar';
    changeLanguage(next);
  };

  const handleLogout = (): void => {
    void api.post('/auth/logout');
    dispatch(clearCredentials());
    navigate('/');
  };

  const sidebarContent = (onNavigate?: () => void) => (
    <>
      <nav className="flex-1 space-y-5 overflow-y-auto pb-8">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-xs font-bold uppercase tracking-wider text-night-500">
              {t(group.label)}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-brand-600/15 text-brand-500'
                        : 'text-night-300 hover:bg-night-800 hover:text-night-50',
                    )
                  }
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span className="flex-1 truncate">{t(label)}</span>
                  {to === '/admin/reviews' && pendingReviews > 0 ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
                      {pendingReviews > 99 ? '99+' : pendingReviews}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-night-800 p-2">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
            {user?.fullName.charAt(0) ?? 'A'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-night-50">{user?.fullName}</p>
            <p className="truncate text-xs capitalize text-night-500">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-400 hover:bg-night-800"
        >
          <LogOut className="h-4 w-4" />
          {t('nav.logout')}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-night-950">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e border-night-800 bg-night-900 p-4 lg:block">
        <Link to="/" className="mb-6 flex items-center gap-2 px-2">
          <Logo className="h-9 w-9 rounded-lg" />
          <span className="text-lg font-extrabold text-night-50">
            فريزر<span className="text-brand-500"> البلد</span>
          </span>
        </Link>
        {sidebarContent()}
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-night-950/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 start-0 flex w-64 flex-col border-e border-night-800 bg-night-900 p-4">
            <div className="mb-6 flex items-center justify-between gap-2 px-2">
              <Link to="/" className="flex items-center gap-2">
                <Logo className="h-9 w-9 rounded-lg" />
                <span className="text-lg font-extrabold text-night-50">
                  ORABI<span className="text-brand-500">Admin</span>
                </span>
              </Link>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label={t('common.close')}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-night-200 transition-colors hover:bg-night-800 hover:text-night-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent(() => setDrawerOpen(false))}
          </aside>
        </div>
      ) : null}

      <div className="flex-1 lg:ms-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-night-800 bg-night-950/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label={t('admin.openMenu')}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-night-200 transition-colors hover:bg-night-800 hover:text-night-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-night-50">{t('admin.title')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLanguage}
              aria-label="language"
              className="flex h-9 items-center gap-1 rounded-xl px-2.5 text-sm font-bold text-night-200 transition-colors hover:bg-night-800 hover:text-night-50"
            >
              <Languages className="h-4 w-4" />
              <span>{t('nav.language')}</span>
            </button>
            <button
              onClick={toggleTheme}
              aria-label="theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-night-200 transition-colors hover:bg-night-800 hover:text-night-50"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/"
              className="hidden items-center gap-1 text-sm font-semibold text-brand-500 hover:text-brand-400 sm:flex"
            >
              {t('nav.home')}
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        </header>
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}