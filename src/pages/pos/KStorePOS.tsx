import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Check,
  X,
  Barcode,
  Package,
  RefreshCw,
  User,
  Printer,
  Calendar,
  Warehouse,
  Users,
  Truck,
  BarChart3,
  Settings,
  HelpCircle,
  Wrench,
  DollarSign,
  UserCog,
  FileText,
  Briefcase,
  Phone,
  ClipboardList,
  Layers,
  LayoutDashboard,
} from 'lucide-react';
import { searchProductByBarcode, type AdminSearchProduct } from '@/api/admin';
import { createOrder } from '@/api/orders';
import { useAppSelector } from '@/hooks';
import { ProductModal } from '@/components/pos/ProductModal';

// ── Seed Data (Barcodes) ──────────────────────────────────────────────────────

const BARCODE_DB: Record<string, { name: string; price: number; category: string }> = {
  '6225000321137': { name: 'موزريلا الحمد 1 ك', price: 140, category: 'منتجات ألبان' },
  '6224001112233': { name: 'جبنة رومي 1/2 كجم', price: 95, category: 'منتجات ألبان' },
  '6221007894561': { name: 'لبن جهينة 1 لتر', price: 44, category: 'منتجات ألبان' },
  '6220012349871': { name: 'شيكاتيتا استربس حار 1 كجم', price: 235, category: 'منتجات فراخ ولحوم مجمدة' },
  '6229004567123': { name: 'جبنة مراعي فيتا 1/2', price: 76, category: 'منتجات ألبان' },
  '6227003219874': { name: 'مرقة دجاج كنور 48 مكعب', price: 42, category: 'بهارات ومرقة' },
  '6223009871234': { name: 'حدوتة كيدة عصافيري برازيلي', price: 78.5, category: 'لحوم مجمدة' },
  '6226005671239': { name: 'كفتة حلال عائلي 1 كجم', price: 79, category: 'لحوم مجمدة' },
  '6228001239876': { name: 'قشطة لامدي 100جم', price: 31, category: 'منتجات ألبان' },
  '6224009873456': { name: 'حدوتة كيده شرائح برازيلي 500 جم', price: 132, category: 'لحوم مجمدة' },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface CartItem {
  barcode: string;
  name: string;
  category: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  pricingType: string;
}

interface Order {
  id: number;
  type: string;
  createdAt: string;
  createdBy: string;
  closedAt: string;
  customer: string;
  deliveryRep: string;
  exitTime: string;
  items: string;
  itemCount: number;
  quantity: number;
  price: number;
  pricingType: string;
  totalValue: number;
  percentage: number;
}

// ── Sample Order Data ─────────────────────────────────────────────────────────

const SAMPLE_ORDERS: Order[] = [
  { id: 154, type: 'استلام', createdAt: '2026/09/01 03:04PM', createdBy: 'محمد المراكبي', closedAt: '', customer: 'عميل نقدي', deliveryRep: '', exitTime: '', items: 'بخيره لبن حليب 1 لتر', itemCount: 1, quantity: 1, price: 44, pricingType: 'قطاعي', totalValue: 44, percentage: 0 },
  { id: 153, type: 'استلام', createdAt: '2026/09/01 02:58PM', createdBy: 'محمد المراكبي', closedAt: '', customer: 'عميل نقدي', deliveryRep: '', exitTime: '', items: 'موزريلا الحمد 1 ك', itemCount: 1, quantity: 1, price: 140, pricingType: 'قطاعي', totalValue: 140, percentage: 0 },
  { id: 152, type: 'استلام', createdAt: '2026/09/01 02:45PM', createdBy: 'محمد المراكبي', closedAt: '', customer: 'عميل نقدي', deliveryRep: '', exitTime: '', items: 'جبنة رومي 1/2 كجم', itemCount: 1, quantity: 2, price: 95, pricingType: 'قطاعي', totalValue: 190, percentage: 0 },
  { id: 151, type: 'استلام', createdAt: '2026/09/01 02:30PM', createdBy: 'محمد المراكبي', closedAt: '', customer: 'عميل نقدي', deliveryRep: '', exitTime: '', items: 'شيكاتيتا استربس حار 1 كجم', itemCount: 1, quantity: 1, price: 235, pricingType: 'قطاعي', totalValue: 235, percentage: 0 },
  { id: 150, type: 'استلام', createdAt: '2026/09/01 02:15PM', createdBy: 'محمد المراكبي', closedAt: '', customer: 'عميل نقدي', deliveryRep: '', exitTime: '', items: 'جبنة مراعي فيتا 1/2', itemCount: 1, quantity: 3, price: 76, pricingType: 'قطاعي', totalValue: 228, percentage: 0 },
  { id: 149, type: 'استلام', createdAt: '2026/09/01 01:58PM', createdBy: 'محمد المراكبي', closedAt: '', customer: 'عميل نقدي', deliveryRep: '', exitTime: '', items: 'مرقة دجاج كنور 48 مكعب', itemCount: 1, quantity: 2, price: 42, pricingType: 'قطاعي', totalValue: 84, percentage: 0 },
  { id: 148, type: 'استلام', createdAt: '2026/09/01 01:42PM', createdBy: 'محمد المراكبي', closedAt: '', customer: 'عميل نقدي', deliveryRep: '', exitTime: '', items: 'حدوتة كيدة عصافيري برازيلي', itemCount: 1, quantity: 1, price: 78.5, pricingType: 'قطاعي', totalValue: 78.5, percentage: 0 },
  { id: 147, type: 'استلام', createdAt: '2026/09/01 01:30PM', createdBy: 'محمد المراكبي', closedAt: '', customer: 'عميل نقدي', deliveryRep: '', exitTime: '', items: 'كفتة حلال عائلي 1 كجم', itemCount: 1, quantity: 1, price: 79, pricingType: 'قطاعي', totalValue: 79, percentage: 0 },
  { id: 146, type: 'استلام', createdAt: '2026/09/01 01:15PM', createdBy: 'محمد المراكبي', closedAt: '', customer: 'عميل نقدي', deliveryRep: '', exitTime: '', items: 'قشطة لامدي 100جم', itemCount: 1, quantity: 4, price: 31, pricingType: 'قطاعي', totalValue: 124, percentage: 0 },
  { id: 145, type: 'استلام', createdAt: '2026/09/01 12:58PM', createdBy: 'محمد المراكبي', closedAt: '', customer: 'عميل نقدي', deliveryRep: '', exitTime: '', items: 'حدوتة كيده شرائح برازيلي 500 جم', itemCount: 1, quantity: 1, price: 132, pricingType: 'قطاعي', totalValue: 132, percentage: 0 },
  { id: 144, type: 'استلام', createdAt: '2026/09/01 12:45PM', createdBy: 'محمد المراكبي', closedAt: '', customer: 'عميل نقدي', deliveryRep: '', exitTime: '', items: 'لبن جهينة 1 لتر', itemCount: 1, quantity: 2, price: 44, pricingType: 'قطاعي', totalValue: 88, percentage: 0 },
  { id: 143, type: 'استلام', createdAt: '2026/09/01 12:30PM', createdBy: 'محمد المراكبي', closedAt: '', customer: 'عميل نقدي', deliveryRep: '', exitTime: '', items: 'موزريلا الحمد 1 ك', itemCount: 1, quantity: 1, price: 140, pricingType: 'قطاعي', totalValue: 140, percentage: 0 },
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

// ── Windows Taskbar Component ────────────────────────────────────────────────

function Taskbar() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex h-10 items-center bg-[#1a1a2e]/90 backdrop-blur-sm border-t border-[#2a2a3e]">
      {/* Start Button */}
      <button className="flex h-full items-center gap-2 px-4 hover:bg-[#2a2a3e] transition-colors">
        <div className="w-5 h-5 grid grid-cols-2 gap-0.5">
          <div className="bg-[#0078d4] rounded-sm"></div>
          <div className="bg-[#0078d4] rounded-sm"></div>
          <div className="bg-[#0078d4] rounded-sm"></div>
          <div className="bg-[#0078d4] rounded-sm"></div>
        </div>
      </button>

      {/* Search */}
      <button className="flex h-full items-center gap-2 px-3 hover:bg-[#2a2a3e] transition-colors">
        <Search className="w-4 h-4 text-gray-400" />
      </button>

      {/* File Explorer */}
      <button className="flex h-full items-center gap-2 px-3 hover:bg-[#2a2a3e] transition-colors">
        <div className="w-5 h-4 bg-[#f1c40f] rounded-sm"></div>
      </button>

      {/* Pinned Apps */}
      <div className="flex h-full items-center gap-1 px-2">
        <button className="flex h-full items-center px-2 hover:bg-[#2a2a3e] transition-colors">
          <div className="w-5 h-5 bg-[#e74c3c] rounded-full"></div>
        </button>
        <button className="flex h-full items-center px-2 hover:bg-[#2a2a3e] transition-colors">
          <div className="w-5 h-5 bg-[#3498db] rounded"></div>
        </button>
        <button className="flex h-full items-center px-2 hover:bg-[#2a2a3e] transition-colors">
          <div className="w-5 h-5 bg-[#2ecc71] rounded"></div>
        </button>
      </div>

      {/* System Tray */}
      <div className="mr-auto flex h-full items-center gap-3 px-4 text-xs text-gray-300">
        <button className="hover:bg-[#2a2a3e] px-1 rounded">^</button>
        <button className="hover:bg-[#2a2a3e] px-1 rounded">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </button>
        <button className="hover:bg-[#2a2a3e] px-1 rounded">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </button>
        <div className="flex items-center gap-2 border-l border-gray-600 pl-2">
          <span>A</span>
          <span>{time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
          <span>{time.toLocaleDateString('ar-EG')}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main KStore POS Component ─────────────────────────────────────────────────

export function KStorePOS() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const queryClient = useQueryClient();
  const user = useAppSelector((state) => state.auth.user);

  // State
  const [activeTab, setActiveTab] = useState<'orders' | 'suspended'>('orders');
  const [orders, setOrders] = useState<Order[]>(SAMPLE_ORDERS);
  const [selectedOrder, setSelectedOrder] = useState<number | null>(154);
  const [nextOrderNumber, setNextOrderNumber] = useState(155);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'orders' | 'entry'>('orders');

  // Handle product save from modal
  const handleProductSave = (product: { name: string; barcode: string; price: number; type: string }) => {
    // Add to local barcode database
    BARCODE_DB[product.barcode] = {
      name: product.name,
      price: product.price,
      category: product.type === 'inventory' ? 'منتجات مخزونة' : 'خدمات',
    };
    toast.success('تم إضافة الصنف بنجاح');
  };

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus barcode input
  useEffect(() => {
    if (currentScreen === 'entry') {
      barcodeInputRef.current?.focus();
    }
  }, [currentScreen]);

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const itemCount = cart.length;

  // Handle barcode scan
  const handleBarcodeScan = useCallback((barcode: string) => {
    const product = BARCODE_DB[barcode];
    if (!product) {
      toast.error('الصنف غير موجود');
      return;
    }

    // Check if already in cart
    const existingIndex = cart.findIndex(item => item.barcode === barcode);
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].qty += 1;
      newCart[existingIndex].lineTotal = newCart[existingIndex].qty * newCart[existingIndex].unitPrice;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          barcode,
          name: product.name,
          category: product.category,
          qty: 1,
          unitPrice: product.price,
          lineTotal: product.price,
          pricingType: 'قطاعي',
        },
      ]);
    }
    setBarcodeInput('');
    barcodeInputRef.current?.focus();
  }, [cart]);

  // Handle barcode input submit
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      handleBarcodeScan(barcodeInput.trim());
    }
  };

  // Update quantity
  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    const newQty = item.qty + delta;
    
    if (newQty <= 0) {
      newCart.splice(index, 1);
    } else {
      item.qty = newQty;
      item.lineTotal = item.unitPrice * newQty;
    }
    
    setCart(newCart);
  };

  // Remove item
  const removeItem = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
  };

  // Confirm order (F12)
  const handleConfirmOrder = () => {
    if (cart.length === 0) {
      toast.error('السلة فارغة');
      return;
    }

    const newOrder: Order = {
      id: nextOrderNumber,
      type: 'استلام',
      createdAt: new Date().toLocaleString('ar-EG'),
      createdBy: user?.fullName || 'محمد المراكبي',
      closedAt: '',
      customer: 'عميل نقدي',
      deliveryRep: '',
      exitTime: '',
      items: cart.map(item => item.name).join(', '),
      itemCount: itemCount,
      quantity: cart.reduce((sum, item) => sum + item.qty, 0),
      price: subtotal,
      pricingType: 'قطاعي',
      totalValue: subtotal,
      percentage: 0,
    };

    setOrders([newOrder, ...orders]);
    setNextOrderNumber(nextOrderNumber + 1);
    setCart([]);
    toast.success('تم تأكيد الطلب');
    barcodeInputRef.current?.focus();
  };

  // Suspend order (F9)
  const handleSuspendOrder = () => {
    if (cart.length === 0) {
      toast.error('السلة فارغة');
      return;
    }
    toast.info('تم تعليق الطلب مؤقتاً');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' && cart.length > 0) {
        e.preventDefault();
        handleConfirmOrder();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        handleSuspendOrder();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, user]);

  // Menu items
  const menuItems = [
    'ملف', 'المبيعات', 'المشتريات', 'مخزن', 'تصنيع', 
    'الموردين والعملاء', 'تقارير العمل', 'مصروفات', 'شئون العاملين', 
    'أدوات', 'الإدارة', 'مساعدة'
  ];

  // Toolbar icons
  const toolbarIcons = [
    { icon: RefreshCw, color: 'text-blue-500', label: 'تحديث' },
    { icon: User, color: 'text-green-500', label: 'بطاقة هوية' },
    { icon: Printer, color: 'text-gray-600', label: 'طابعة' },
    { icon: Calendar, color: 'text-orange-500', label: 'منبه' },
    { icon: Users, color: 'text-purple-500', label: 'مجموعة أشخاص' },
    { icon: Calendar, color: 'text-blue-600', label: 'تقويم' },
    { icon: Package, color: 'text-yellow-600', label: 'صندوق' },
    { icon: RefreshCw, color: 'text-green-600', label: 'مزامنة' },
    { icon: RefreshCw, color: 'text-green-600', label: 'مزامنة' },
    { icon: LayoutDashboard, color: 'text-gray-700', label: 'شاشة' },
    { icon: ClipboardList, color: 'text-gray-600', label: 'قائمة' },
    { icon: Check, color: 'text-green-700', label: 'علامة صح' },
    { icon: Settings, color: 'text-yellow-600', label: 'قفل' },
    { icon: UserCog, color: 'text-purple-600', label: 'أدمن' },
  ];

  // Bottom buttons
  const bottomButtons = [
    { label: 'الطلبات ▾', color: 'bg-[#e6e4dc] text-gray-700' },
    { label: 'المشتريات', color: 'bg-[#e6e4dc] text-gray-700' },
    { label: 'الأصناف ▾', color: 'bg-[#e6e4dc] text-gray-700' },
    { label: 'مرتجع', color: 'bg-[#e6e4dc] text-gray-700' },
    { label: 'المصروفات', color: 'bg-[#e6e4dc] text-gray-700' },
    { label: 'فتح الدرج', color: 'bg-[#e6e4dc] text-gray-700' },
    { label: 'طباعة نسخة', color: 'bg-[#e6e4dc] text-gray-700' },
    { label: 'تعليق الفاتورة (F9)', color: 'bg-yellow-500 text-gray-800' },
    { label: 'تأكيد (F12) ✔', color: 'bg-green-600 text-white' },
    { label: '✕', color: 'bg-red-500 text-white' },
  ];

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-[#2C3E50] to-[#1B2838] text-sm" dir="rtl">
      {/* Windows Desktop Background */}
      <div className="relative h-full w-full p-8">
        {/* Window */}
        <div className="mx-auto h-[calc(100%-60px)] w-[calc(100%-40px)] rounded border border-gray-400 bg-[#D9D6CE] shadow-2xl flex flex-col">
          {/* Title Bar */}
          <div className="flex h-7 items-center justify-between bg-gradient-to-r from-[#F7F5EF] to-[#EDEAE0] border-b border-gray-300 px-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#C0533A] rounded flex items-center justify-center text-white text-[8px] font-bold">K</div>
              <span className="text-xs font-bold text-[#C0533A]">برنامج إدارة الطلبات</span>
            </div>
            <div className="flex items-center gap-1">
              <button className="w-6 h-5 flex items-center justify-center hover:bg-gray-200 text-xs">_</button>
              <button className="w-6 h-5 flex items-center justify-center hover:bg-gray-200 text-xs">□</button>
              <button className="w-6 h-5 flex items-center justify-center hover:bg-red-500 hover:text-white text-xs">✕</button>
            </div>
          </div>

          {/* Menu Bar */}
          <div className="flex h-6 items-center bg-[#F2F0E9] border-b border-gray-300 text-xs">
            {menuItems.map((item, index) => (
              <button
                key={index}
                className="px-3 py-1 hover:bg-gray-200 transition-colors"
              >
                {item}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex h-10 items-center gap-1 bg-[#E4E1D8] border-b border-gray-300 px-2">
            {toolbarIcons.map((item, index) => (
              <button
                key={index}
                className="flex h-8 w-8 items-center justify-center rounded bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
                title={item.label}
              >
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </button>
            ))}
            
            {/* User Info */}
            <div className="mr-auto flex items-center gap-2">
              <div className="flex items-center gap-1 rounded bg-white px-2 py-1 border border-gray-300 text-xs">
                <User className="h-3 w-3" />
                <span>{user?.fullName || 'محمد المراكبي'}</span>
              </div>
            </div>
          </div>

          {/* Session Bar */}
          <div className="flex h-6 items-center justify-between bg-white border-b border-gray-300 px-3 text-[11px] text-gray-600">
            <div className="flex items-center gap-4">
              <span>المستخدم الحالي: {user?.fullName || 'محمد المراكبي'}</span>
              <span>|</span>
              <span>جلسة: {user?.fullName || 'محمد المراكبي'}</span>
              <span>|</span>
              <span>الشيفت: [فاضي]</span>
            </div>
            <div className="flex items-center gap-4">
              <span>{new Date().toLocaleDateString('ar-EG')} - <LiveClock /></span>
            </div>
          </div>

          {/* Logo Section (only on orders screen) */}
          {currentScreen === 'orders' && (
            <div className="flex items-center gap-4 bg-[#EDEFE6] border-b border-gray-300 p-3">
              {/* Logo */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-[#1F5C3F] rounded flex flex-col items-center justify-center text-white">
                  <span className="text-xs font-bold">WELAD</span>
                  <span className="text-[8px]">HALAL</span>
                </div>
                <span className="text-[9px] text-gray-600 mt-1">ولاد حلال</span>
                <span className="text-[8px] text-gray-500">نظام نقاط البيع</span>
              </div>
              
              {/* Title */}
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-[#C0533A]">برنامج إدارة الطلبات</h1>
                <p className="text-xs text-gray-500">إصدار محدّث</p>
                <div className="flex gap-2 mt-1">
                  <div className="w-4 h-4 bg-gray-300 rounded flex items-center justify-center text-[8px]">💻</div>
                  <div className="w-4 h-4 bg-gray-300 rounded flex items-center justify-center text-[8px]">🖨️</div>
                  <div className="w-4 h-4 bg-gray-300 rounded flex items-center justify-center text-[8px]">📱</div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 overflow-hidden bg-[#EDEFE6]">
            {currentScreen === 'orders' ? (
              /* Order Log Screen */
              <div className="flex h-full flex-col">
                {/* Tabs */}
                <div className="flex border-b border-gray-300 bg-[#E8E6DE]">
                  <button
                    onClick={() => setActiveTab('orders')}
                    className={`flex items-center gap-1 px-4 py-2 text-xs font-medium ${
                      activeTab === 'orders' 
                        ? 'bg-[#E8E6DE] border-b-2 border-[#1F5C3F]' 
                        : 'hover:bg-gray-200'
                    }`}
                  >
                    <Calendar className="h-3 w-3" />
                    سجل الطلبات
                  </button>
                  <button
                    onClick={() => setActiveTab('suspended')}
                    className={`flex items-center gap-1 px-4 py-2 text-xs font-medium ${
                      activeTab === 'suspended' 
                        ? 'bg-[#E8E6DE] border-b-2 border-[#1F5C3F]' 
                        : 'hover:bg-gray-200'
                    }`}
                  >
                    <User className="h-3 w-3" />
                    الطلبات المعلقة
                  </button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-2 bg-[#F2F0E9] border-b border-gray-300 p-2">
                  <button className="px-3 py-1 bg-[#e6e4dc] border border-gray-300 text-xs hover:bg-gray-200 rounded">
                    بحث وتفعيل
                  </button>
                  <select className="px-2 py-1 bg-white border border-gray-300 text-xs">
                    <option>كل أنواع الطلب</option>
                    <option>استلام</option>
                  </select>
                  <select className="px-2 py-1 bg-white border border-gray-300 text-xs">
                    <option>كل مندوبين التوصيل</option>
                  </select>
                  <button 
                    onClick={() => setCurrentScreen('entry')}
                    className="px-4 py-1 bg-[#1F5C3F] text-white text-xs font-bold rounded hover:bg-[#174a32] transition-colors"
                  >
                    طلب جديد
                  </button>
                </div>

                {/* Orders Table */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-[#DAD6C8]">
                      <tr className="border-b border-gray-400">
                        <th className="px-2 py-1 text-right font-medium">رقم الطلب</th>
                        <th className="px-2 py-1 text-right font-medium">نوع الطلب</th>
                        <th className="px-2 py-1 text-right font-medium">توقيت الإنشاء</th>
                        <th className="px-2 py-1 text-right font-medium">أنشئ بواسطة</th>
                        <th className="px-2 py-1 text-right font-medium">توقيت الإغلاق</th>
                        <th className="px-2 py-1 text-right font-medium">العميل</th>
                        <th className="px-2 py-1 text-right font-medium">مندوب التوصيل</th>
                        <th className="px-2 py-1 text-right font-medium">وقت الخروج</th>
                        <th className="px-2 py-1 text-right font-medium">لمحة</th>
                        <th className="px-2 py-1 text-right font-medium">عدد الأصناف</th>
                        <th className="px-2 py-1 text-right font-medium">الكمية</th>
                        <th className="px-2 py-1 text-right font-medium">السعر</th>
                        <th className="px-2 py-1 text-right font-medium">التسعير</th>
                        <th className="px-2 py-1 text-right font-medium">القيمة الإجمالية</th>
                        <th className="px-2 py-1 text-right font-medium">النسبة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order, index) => (
                        <tr
                          key={order.id}
                          onClick={() => setSelectedOrder(order.id)}
                          className={`border-b border-gray-200 cursor-pointer ${
                            index % 2 === 0 ? 'bg-[#F3E1EC]' : 'bg-[#EAD3E4]'
                          } ${selectedOrder === order.id ? '!bg-[#1C6FB5] !text-white' : ''} hover:bg-[#1C6FB5] hover:text-white`}
                        >
                          <td className="px-2 py-1">{order.id}</td>
                          <td className="px-2 py-1">{order.type}</td>
                          <td className="px-2 py-1">{order.createdAt}</td>
                          <td className="px-2 py-1">{order.createdBy}</td>
                          <td className="px-2 py-1">{order.closedAt}</td>
                          <td className="px-2 py-1">{order.customer}</td>
                          <td className="px-2 py-1">{order.deliveryRep}</td>
                          <td className="px-2 py-1">{order.exitTime}</td>
                          <td className="px-2 py-1">{order.items}</td>
                          <td className="px-2 py-1">{order.itemCount}</td>
                          <td className="px-2 py-1">{order.quantity}</td>
                          <td className="px-2 py-1">{order.price}</td>
                          <td className="px-2 py-1">{order.pricingType}</td>
                          <td className="px-2 py-1">{order.totalValue}</td>
                          <td className="px-2 py-1">{order.percentage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Order Entry Screen */
              <div className="flex h-full flex-col">
                {/* Green Header */}
                <div className="flex items-center gap-4 bg-[#1F5C3F] p-2 text-white">
                  <select className="px-2 py-1 bg-[#174a32] border border-gray-400 text-xs rounded">
                    <option>نوع الطلب</option>
                    <option>استلام</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">رقم الطلب:</span>
                    <input
                      type="text"
                      value={nextOrderNumber}
                      readOnly
                      className="w-20 px-2 py-1 bg-white text-black text-xs border border-gray-300 rounded"
                    />
                  </div>
                  <button className="mr-auto flex items-center gap-1 px-3 py-1 bg-[#e6e4dc] text-gray-700 text-xs rounded border border-gray-300">
                    <User className="h-3 w-3" />
                    عميل نقدي
                  </button>
                </div>

                {/* Search Bar */}
                <div className="flex items-center gap-2 bg-[#EDEFE6] border-b border-gray-300 p-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <select className="px-2 py-1 bg-white border border-gray-300 text-xs">
                    <option>كل التصنيفات</option>
                    <option>منتجات ألبان</option>
                    <option>لحوم مجمدة</option>
                    <option>بهارات ومرقة</option>
                  </select>
                  <form onSubmit={handleBarcodeSubmit} className="flex-1">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="امسح الباركود أو اكتب الكود..."
                      className="w-full px-3 py-1 bg-white border border-gray-300 text-xs"
                      autoFocus
                    />
                  </form>
                  <button className="p-1 hover:bg-gray-200 rounded">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                  <button className="p-1 hover:bg-gray-200 rounded">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>

                {/* Cart Table */}
                <div className="flex-1 overflow-auto bg-white">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-[#DAD6C8]">
                      <tr className="border-b border-gray-400">
                        <th className="px-2 py-1 text-right font-medium">التصنيف</th>
                        <th className="px-2 py-1 text-right font-medium">الصنف</th>
                        <th className="px-2 py-1 text-right font-medium">باركود</th>
                        <th className="px-2 py-1 text-right font-medium">رصيد</th>
                        <th className="px-2 py-1 text-right font-medium">قطاعي</th>
                        <th className="px-2 py-1 text-right font-medium">الكمية</th>
                        <th className="px-2 py-1 text-right font-medium">السعر</th>
                        <th className="px-2 py-1 text-right font-medium">التسعير</th>
                        <th className="px-2 py-1 text-right font-medium">السعر الكلي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item, index) => (
                        <tr
                          key={item.barcode}
                          className={`border-b border-gray-200 ${
                            index % 2 === 0 ? 'bg-[#FDFBEA]' : 'bg-white'
                          } hover:bg-[#1C6FB5] hover:text-white`}
                        >
                          <td className="px-2 py-1">{item.category}</td>
                          <td className="px-2 py-1 font-medium">{item.name}</td>
                          <td className="px-2 py-1 font-mono">{item.barcode}</td>
                          <td className="px-2 py-1">-</td>
                          <td className="px-2 py-1">{item.unitPrice}</td>
                          <td className="px-2 py-1">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateQuantity(index, -1)}
                                className="w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-xs"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={item.qty}
                                onChange={(e) => {
                                  const newQty = parseInt(e.target.value) || 0;
                                  const newCart = [...cart];
                                  if (newQty <= 0) {
                                    newCart.splice(index, 1);
                                  } else {
                                    newCart[index].qty = newQty;
                                    newCart[index].lineTotal = newCart[index].unitPrice * newQty;
                                  }
                                  setCart(newCart);
                                }}
                                className="w-12 border border-gray-300 text-center text-xs"
                                min="1"
                              />
                              <button
                                onClick={() => updateQuantity(index, 1)}
                                className="w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-xs"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-1">{item.unitPrice}</td>
                          <td className="px-2 py-1">{item.pricingType}</td>
                          <td className="px-2 py-1 font-medium">{item.lineTotal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary Panel */}
                <div className="flex items-center gap-8 bg-[#EDEFE6] border-t border-gray-300 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">عدد الأصناف:</span>
                    <span className="px-3 py-1 bg-white border border-gray-300 font-bold text-sm">{itemCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">إجمالي الفاتورة:</span>
                    <span className="px-4 py-1 bg-[#1F5C3F] text-white font-bold text-lg rounded">{subtotal} ج.م</span>
                  </div>
                </div>

                {/* Bottom Buttons */}
                <div className="flex items-center gap-1 bg-[#E4E1D8] border-t border-gray-300 p-2">
                  {bottomButtons.map((btn, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        if (btn.label === 'تأكيد (F12) ✔') handleConfirmOrder();
                        if (btn.label === 'تعليق الفاتورة (F9)') handleSuspendOrder();
                        if (btn.label === '✕') {
                          clearCart();
                          setCurrentScreen('orders');
                        }
                      }}
                      className={`px-3 py-2 text-xs font-medium rounded border border-gray-300 ${btn.color} hover:opacity-90 transition-opacity`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className="flex h-6 items-center justify-between bg-[#E4E1D8] border-t border-gray-300 px-3 text-[10px] text-gray-600">
            <span>اضغط لمعلومات الاتصال — ولاد حلال ) برنامج إدارة الطلبات ( نظام نقاط البيع ) WELAD HALAL</span>
          </div>
        </div>

        {/* Taskbar */}
        <Taskbar />
      </div>

      {/* Product Modal */}
      <ProductModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        onSave={handleProductSave}
      />
    </div>
  );
}

export default KStorePOS;
