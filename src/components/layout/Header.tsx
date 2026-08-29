import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Moon,
  ShoppingCart,
  Sun,
  X,
  Languages,
  ChevronDown,
  Package,
} from 'lucide-react';
import { Logo } from '@/components/logo/Logo';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { changeLanguage, type LanguageCode } from '@/i18n';
import { clearCredentials } from '@/store/slices/authSlice';
import { selectCartCount } from '@/store/slices/cartSlice';
import { setCartOpen, setMobileOpen } from '@/store/slices/uiSlice';
import { cn } from '@/lib/utils';

const navLinks = [
  { to: '/', key: 'home' },
  { to: '/menu', key: 'menu' },
  { to: '/offers', key: 'offers' },
  { to: '/about', key: 'about' },
  { to: '/contact', key: 'contact' },
];

export function Header() {
  const { i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const user = useAppSelector((state) => state.auth.user);
  const token = useAppSelector((state) => state.auth.token);
  const cartCount = useAppSelector(selectCartCount);
  const mobileOpen = useAppSelector((state) => state.ui.mobileOpen);
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenu(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggleLanguage = (): void => {
    const next: LanguageCode = i18n.language === 'ar' ? 'en' : 'ar';
    changeLanguage(next);
  };

  const handleLogout = (): void => {
    dispatch(clearCredentials());
    setUserMenu(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--tw-border)] bg-[var(--tw-header-bg)] backdrop-blur-xl">
      <div className="container-px flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex shrink-0 items-center gap-3" aria-label={i18n.t('nav.brand')}>
          <Logo className="h-10 w-10 rounded-xl" />
          <div className="hidden min-[344px]:block">
            <span className="block text-lg font-extrabold tracking-tight text-[var(--tw-text)]">
              {i18n.language === 'ar' ? 'فريزر البلد' : i18n.t('nav.brand')}
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-widest text-[var(--tw-text-subtle)]">
              {i18n.language === 'ar' ? 'منتجات مجمدة طازجة' : 'Fresh Frozen Products'}
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-brand-500/10 text-brand-500'
                    : 'text-[var(--tw-text-muted)] hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]',
                )
              }
            >
              {i18n.t(`nav.${link.key}`)}
            </NavLink>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {/* Language */}
          <button
            onClick={toggleLanguage}
            className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
            aria-label="language"
          >
            <Languages className="h-4 w-4" />
            <span>{i18n.t('nav.language')}</span>
          </button>

          {/* Theme */}
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
            aria-label="theme"
          >
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>

          {/* Cart */}
          <button
            onClick={() => dispatch(setCartOpen(true))}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
            aria-label="cart"
          >
            <ShoppingCart className="h-[18px] w-[18px]" />
            {cartCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white shadow-sm shadow-brand-500/30">
                {cartCount}
              </span>
            )}
          </button>

          {/* User / Login */}
          {token && user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenu((v) => !v)}
                className="flex h-10 items-center gap-2.5 rounded-xl px-2 transition-colors hover:bg-[var(--tw-hover)]"
                aria-label="account"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm shadow-brand-500/30">
                  {user.fullName.trim().charAt(0) || 'U'}
                </span>
                <ChevronDown className={cn('h-3.5 w-3.5 text-[var(--tw-text-subtle)] transition-transform', userMenu && 'rotate-180')} />
              </button>
              {userMenu && (
                <div className="absolute end-0 top-12 w-60 overflow-hidden rounded-2xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] py-1.5 shadow-2xl shadow-black/10">
                  <div className="border-b border-[var(--tw-border)] px-4 py-3">
                    <p className="truncate text-sm font-bold text-[var(--tw-text)]">{user.fullName}</p>
                    <p className="truncate text-xs text-[var(--tw-text-muted)]">{user.email}</p>
                  </div>
                  {(user.role === 'admin' || user.role === 'manager') && (
                    <Link
                      to="/admin"
                      onClick={() => setUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-[var(--tw-text)] transition-colors hover:bg-[var(--tw-hover)]"
                    >
                      <LayoutDashboard className="h-4 w-4 text-brand-500" />
                      {i18n.t('nav.admin')}
                    </Link>
                  )}
                  <Link
                    to="/orders"
                    onClick={() => setUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-[var(--tw-text)] transition-colors hover:bg-[var(--tw-hover)]"
                  >
                    <Package className="h-4 w-4 text-[var(--tw-text-muted)]" />
                    {i18n.t('order.title')}
                  </Link>
                  <div className="my-1 border-t border-[var(--tw-border)]" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    {i18n.t('nav.logout')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white transition-all hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/20 sm:flex"
            >
              {i18n.t('nav.login')}
            </Link>
          )}

          {/* Mobile Menu */}
          <button
            onClick={() => dispatch(setMobileOpen(!mobileOpen))}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--tw-text)] transition-colors hover:bg-[var(--tw-hover)] lg:hidden"
            aria-label="menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav className="border-t border-[var(--tw-border)] bg-[var(--tw-bg)] px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => dispatch(setMobileOpen(false))}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-4 py-3 text-base font-semibold transition-colors',
                    isActive
                      ? 'bg-brand-500/10 text-brand-500'
                      : 'text-[var(--tw-text)] hover:bg-[var(--tw-hover)]',
                  )
                }
              >
                {i18n.t(`nav.${link.key}`)}
              </NavLink>
            ))}
            {!token && (
              <Link
                to="/login"
                onClick={() => dispatch(setMobileOpen(false))}
                className="mt-3 flex items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-brand-700"
              >
                {i18n.t('nav.login')}
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
