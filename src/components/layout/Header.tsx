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
  User as UserIcon,
  X,
  Languages,
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
    <header className="sticky top-0 z-40 border-b border-night-800 bg-night-950/90 backdrop-blur-md">
      <div className="container-px flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2" aria-label="Freezer El Balad">
          <Logo className="h-10 w-10 rounded-xl" />
          <span className="hidden text-xl font-extrabold tracking-tight text-night-50 min-[344px]:inline">
            فريزر<span className="text-brand-500"> البلد</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                  isActive ? 'text-brand-500' : 'text-night-200 hover:text-night-50',
                )
              }
            >
              {i18n.t(`nav.${link.key}`)}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleLanguage}
            className="flex h-10 items-center gap-1 rounded-xl px-2.5 text-sm font-bold text-night-200 transition-colors hover:bg-night-800 hover:text-night-50"
            aria-label="language"
          >
            <Languages className="h-4 w-4" />
            <span>{i18n.t('nav.language')}</span>
          </button>
          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-night-200 transition-colors hover:bg-night-800 hover:text-night-50"
            aria-label="theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <button
            onClick={() => dispatch(setCartOpen(true))}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-night-200 transition-colors hover:bg-night-800 hover:text-night-50"
            aria-label="cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 ? (
              <span className="absolute -top-0.5 -end-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-bold text-white">
                {cartCount}
              </span>
            ) : null}
          </button>

          {token && user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenu((v) => !v)}
                className="flex h-10 items-center gap-2 rounded-xl px-2 transition-colors hover:bg-night-800"
                aria-label="account"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
                  {user.fullName.trim().charAt(0) || 'U'}
                </span>
                {userMenu ? <X className="h-4 w-4 text-night-300" /> : <UserIcon className="h-4 w-4 text-night-300" />}
              </button>
              {userMenu ? (
                <div className="absolute end-0 top-12 w-52 overflow-hidden rounded-xl border border-night-800 bg-night-900 py-1.5 shadow-2xl">
                  <div className="border-b border-night-800 px-4 py-2.5">
                    <p className="truncate text-sm font-bold text-night-50">{user.fullName}</p>
                    <p className="truncate text-xs text-night-400">{user.email}</p>
                  </div>
                  {(user.role === 'admin' || user.role === 'manager') ? (
                    <Link
                      to="/admin"
                      onClick={() => setUserMenu(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-night-200 hover:bg-night-800"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      {i18n.t('nav.admin')}
                    </Link>
                  ) : null}
                  <Link
                    to="/orders"
                    onClick={() => setUserMenu(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-night-200 hover:bg-night-800"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {i18n.t('order.title')}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-night-800"
                  >
                    <LogOut className="h-4 w-4" />
                    {i18n.t('nav.logout')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white transition-colors hover:bg-brand-700 sm:flex"
            >
              {i18n.t('nav.login')}
            </Link>
          )}

          <button
            onClick={() => dispatch(setMobileOpen(!mobileOpen))}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-night-200 hover:bg-night-800 lg:hidden"
            aria-label="menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav className="border-t border-night-800 bg-night-950 px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => dispatch(setMobileOpen(false))}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2.5 text-base font-semibold transition-colors',
                    isActive ? 'bg-night-800 text-brand-500' : 'text-night-200 hover:text-night-50',
                  )
                }
              >
                {i18n.t(`nav.${link.key}`)}
              </NavLink>
            ))}
            {!token ? (
              <Link
                to="/login"
                onClick={() => dispatch(setMobileOpen(false))}
                className="mt-2 flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-base font-bold text-white"
              >
                {i18n.t('nav.login')}
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </header>
  );
}