import { useState, useEffect, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  Users,
  Truck,
  FileText,
  Settings,
  Printer,
  Calendar,
  BarChart3,
  Phone,
  RefreshCw,
  LogOut,
  User,
  Clock,
  ChevronDown,
  Menu,
  X,
  Receipt,
  ClipboardList,
  Layers,
  DollarSign,
  HelpCircle,
  Wrench,
  UserCog,
  Briefcase,
  Store,
} from 'lucide-react';
import { Logo } from '@/components/logo/Logo';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { clearCredentials } from '@/store/slices/authSlice';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Menu Items ──────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  path?: string;
  onClick?: () => void;
}

const topMenuItems: MenuItem[] = [
  { id: 'file', label: 'ملف', icon: FileText },
  { id: 'sales', label: 'المبيعات', icon: ShoppingCart, path: '/pos/orders' },
  { id: 'purchases', label: 'المشتريات', icon: Package, path: '/pos/purchases' },
  { id: 'inventory', label: 'مخزن', icon: Warehouse, path: '/pos/inventory' },
  { id: 'manufacturing', label: 'تصنيع', icon: Wrench },
  { id: 'suppliers', label: 'الموردين والعملاء', icon: Users, path: '/pos/customers' },
  { id: 'reports', label: 'تقارير العمل', icon: BarChart3, path: '/pos/reports' },
  { id: 'expenses', label: 'مصروفات', icon: DollarSign },
  { id: 'hr', label: 'شئون العاملين', icon: UserCog },
  { id: 'tools', label: 'أدوات', icon: Wrench },
  { id: 'admin', label: 'الإدارة', icon: Settings, path: '/admin' },
  { id: 'help', label: 'مساعدة', icon: HelpCircle },
];

const toolbarItems: MenuItem[] = [
  { id: 'refresh', label: 'تحديث', icon: RefreshCw },
  { id: 'customers', label: 'العملاء', icon: Users, path: '/pos/customers' },
  { id: 'printer', label: 'الطابعة', icon: Printer },
  { id: 'employees', label: 'الموظفين', icon: UserCog },
  { id: 'calendar', label: 'التقويم', icon: Calendar },
  { id: 'inventory', label: 'المخزون', icon: Warehouse, path: '/pos/inventory' },
  { id: 'purchases', label: 'المشتريات', icon: Package, path: '/pos/purchases' },
  { id: 'reports', label: 'التقارير', icon: BarChart3, path: '/pos/reports' },
  { id: 'settings', label: 'الإعدادات', icon: Settings, path: '/admin/settings' },
  { id: 'admin', label: 'لوحة التحكم', icon: LayoutDashboard, path: '/admin' },
];

const navigationItems: MenuItem[] = [
  { id: 'orders', label: 'سجل الطلبات', icon: ClipboardList, path: '/pos/orders' },
  { id: 'pos', label: 'طلب جديد', icon: ShoppingCart, path: '/pos' },
  { id: 'purchases', label: 'المشتريات', icon: Package, path: '/pos/purchases' },
  { id: 'inventory', label: 'المخزون', icon: Warehouse, path: '/pos/inventory' },
  { id: 'products', label: 'الأصناف', icon: Layers, path: '/pos/products' },
  { id: 'categories', label: 'التصنيفات', icon: LayoutDashboard, path: '/pos/categories' },
  { id: 'customers', label: 'العملاء', icon: Users, path: '/pos/customers' },
  { id: 'suppliers', label: 'الموردين', icon: Truck, path: '/pos/suppliers' },
  { id: 'expenses', label: 'المصروفات', icon: DollarSign },
  { id: 'reports', label: 'التقارير', icon: BarChart3, path: '/pos/reports' },
  { id: 'settings', label: 'الإعدادات', icon: Settings, path: '/admin/settings' },
  { id: 'contact', label: 'اتصل بنا', icon: Phone, path: '/contact' },
];

// ── Live Clock Component ────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="tabular-nums">
      {time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

// ── POS Shell Component ─────────────────────────────────────────────────────

interface POSShellProps {
  children?: ReactNode;
}

export function POSShell({ children }: POSShellProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const isAr = i18n.language === 'ar';

  const [activeTopMenu, setActiveTopMenu] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Get current page title
  const currentPage = navigationItems.find((item) => item.path && location.pathname === item.path);

  const handleLogout = () => {
    void api.post('/auth/logout');
    dispatch(clearCredentials());
    navigate('/');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/pos') return location.pathname === '/pos';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen flex-col bg-[#f5f5f0] text-gray-800" dir="rtl">
      {/* ═══ Top Menu Bar ═══ */}
      <header className="flex h-8 items-center border-b border-gray-300 bg-[#e8e8e0] text-xs">
        <div className="flex items-center gap-1 px-2">
          <Logo className="h-5 w-5" />
          <span className="font-bold text-gray-700">
            {isAr ? 'فريزر البلد' : 'Freezer El Balad'}
          </span>
        </div>

        <nav className="flex items-center">
          {topMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.path) handleNavigation(item.path);
                setActiveTopMenu(activeTopMenu === item.id ? null : item.id);
              }}
              className={cn(
                'flex items-center gap-1 px-3 py-1 text-xs transition-colors',
                activeTopMenu === item.id
                  ? 'bg-green-600 text-white'
                  : 'hover:bg-gray-200'
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mr-auto flex items-center gap-3 px-3 text-xs text-gray-600">
          <span>رقم الصلاحية: 1</span>
          <span>|</span>
          <span>النسخة: 1.0</span>
        </div>
      </header>

      {/* ═══ Toolbar ═══ */}
      <div className="flex h-10 items-center gap-1 border-b border-gray-300 bg-[#d4d4c8] px-2">
        {toolbarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => item.path && handleNavigation(item.path)}
            className={cn(
              'flex h-8 items-center gap-1 rounded px-2 text-xs transition-colors',
              isActive(item.path)
                ? 'bg-green-600 text-white'
                : 'bg-white hover:bg-gray-100 border border-gray-300'
            )}
            title={item.label}
          >
            <item.icon className="h-4 w-4" />
            <span className="hidden lg:inline">{item.label}</span>
          </button>
        ))}

        {/* User Info */}
        <div className="mr-auto flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1 rounded bg-white px-2 py-1 border border-gray-300 text-xs"
            >
              <User className="h-3 w-3" />
              <span>{user?.fullName || 'مدير'}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {showUserMenu && (
              <div className="absolute left-0 top-full z-50 mt-1 w-40 bg-white border border-gray-300 shadow-lg">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-gray-100 text-red-600"
                >
                  <LogOut className="h-3 w-3" />
                  خروج
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Session Bar ═══ */}
      <div className="flex h-7 items-center justify-between border-b border-gray-300 bg-[#e0e0d8] px-3 text-xs text-gray-600">
        <div className="flex items-center gap-4">
          <span>
            <User className="inline h-3 w-3 ml-1" />
            المستخدم الحالي: {user?.fullName || 'مدير'}
          </span>
          <span>
            <ClipboardList className="inline h-3 w-3 ml-1" />
            الجلسة: 1
          </span>
          <span>
            <Briefcase className="inline h-3 w-3 ml-1" />
            الشيفت: نهاري
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            <Calendar className="inline h-3 w-3 ml-1" />
            {new Date().toLocaleDateString('ar-EG')}
          </span>
          <span>
            <Clock className="inline h-3 w-3 ml-1" />
            <LiveClock />
          </span>
        </div>
      </div>

      {/* ═══ Main Content Area ═══ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar Navigation ── */}
        <aside
          className={cn(
            'flex flex-col border-l border-gray-300 bg-[#d0d0c4] transition-all duration-200',
            sidebarOpen ? 'w-48' : 'w-12'
          )}
        >
          <div className="flex items-center justify-between border-b border-gray-300 px-2 py-2">
            {sidebarOpen && (
              <span className="text-xs font-bold text-gray-700">القائمة الرئيسية</span>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-200"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => item.path && handleNavigation(item.path)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors',
                  isActive(item.path)
                    ? 'bg-green-600 text-white font-bold'
                    : 'hover:bg-gray-200 text-gray-700'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* Quick Actions */}
          {sidebarOpen && (
            <div className="border-t border-gray-300 p-2">
              <button
                onClick={() => handleNavigation('/pos')}
                className="w-full rounded bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700"
              >
                <ShoppingCart className="inline h-4 w-4 ml-1" />
                نقطة البيع
              </button>
            </div>
          )}
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-auto bg-white">
          {children || <Outlet />}
        </main>
      </div>

      {/* ═══ Status Bar ═══ */}
      <footer className="flex h-6 items-center justify-between border-t border-gray-300 bg-[#d4d4c8] px-3 text-xs text-gray-600">
        <div className="flex items-center gap-4">
          <span>جاهز</span>
          <span>|</span>
          <span>فريزر البلد - نظام نقاط البيع</span>
        </div>
        <div className="flex items-center gap-4">
          <span>قاعدة البيانات: متصلة</span>
          <span>|</span>
          <span>v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}

export default POSShell;
