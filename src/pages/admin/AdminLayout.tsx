import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Boxes,
  ChevronRight,
  CreditCard,
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
  Printer,
  Settings,
  ShoppingCart,
  Star,
  Sun,
  Tag,
  UserCog,
  Users,
  X,
  Bell,
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
      { to: '/admin/labels', icon: Tag, label: 'admin.nav.labels' },
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
      { to: '/admin/payments', icon: CreditCard, label: 'admin.nav.payments' },
      { to: '/admin/purchases', icon: Package, label: 'admin.nav.purchases' },
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
      { to: '/admin/printer', icon: Printer, label: 'admin.nav.printer' },
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
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-[var(--tw-text-muted)]">
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
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-brand-500/10 text-brand-500 shadow-sm shadow-brand-500/5'
                        : 'text-[var(--tw-text-muted)] hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]',
                    )
                  }
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1 truncate">{t(label)}</span>
                  {to === '/admin/reviews' && pendingReviews > 0 ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
                      {pendingReviews > 99 ? '99+' : pendingReviews}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User Footer */}
      <div className="border-t border-[var(--tw-border)] px-3 py-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white shadow-sm">
            {user?.fullName.charAt(0) ?? 'A'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--tw-text)]">{user?.fullName}</p>
            <p className="truncate text-xs capitalize text-[var(--tw-text-muted)]">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          {t('nav.logout')}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[var(--tw-bg)]">
      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-[var(--tw-sidebar-border)] bg-[var(--tw-sidebar-bg)] lg:flex">
        {/* Sidebar Header */}
        <div className="flex h-16 items-center gap-3 border-b border-[var(--tw-border)] px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8 rounded-lg" />
            <span className="text-sm font-bold tracking-tight text-[var(--tw-text)]">
              {t('nav.brand')}
            </span>
          </Link>
        </div>
        {sidebarContent()}
      </aside>

      {/* ── Mobile Drawer ───────────────────────────────────────── */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 start-0 flex w-72 flex-col bg-[var(--tw-sidebar-bg)] shadow-2xl">
            {/* Drawer Header */}
            <div className="flex h-16 items-center justify-between border-b border-[var(--tw-border)] px-4">
              <Link to="/" className="flex items-center gap-2.5" onClick={() => setDrawerOpen(false)}>
                <Logo className="h-8 w-8 rounded-lg" />
                <span className="text-sm font-bold tracking-tight text-[var(--tw-text)]">
                  {t('nav.brand')}
                </span>
              </Link>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label={t('common.close')}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent(() => setDrawerOpen(false))}
          </aside>
        </div>
      ) : null}

      {/* ── Main Content ────────────────────────────────────────── */}
      <div className="flex-1 lg:ms-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--tw-border)] bg-[var(--tw-header-bg)] px-4 backdrop-blur-xl md:px-8">
          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label={t('admin.openMenu')}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-bold text-[var(--tw-text)]">{t('admin.title')}</h1>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Language */}
            <button
              onClick={toggleLanguage}
              aria-label="language"
              className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
            >
              <Languages className="h-4 w-4" />
              <span className="hidden sm:inline">{t('nav.language')}</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
            >
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>

            {/* Notifications */}
            {pendingReviews > 0 ? (
              <Link
                to="/admin/reviews"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
              >
                <Bell className="h-[18px] w-[18px]" />
                <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white">
                  {pendingReviews > 9 ? '9+' : pendingReviews}
                </span>
              </Link>
            ) : null}

            {/* Divider */}
            <div className="mx-1 h-6 w-px bg-[var(--tw-border)]" />

            {/* Home Link */}
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-brand-500"
            >
              <span className="hidden sm:inline">{t('nav.home')}</span>
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
