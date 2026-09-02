import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  Warehouse,
  BarChart3,
  Users,
  Truck,
  Settings,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { adminListProducts, getDashboard, getOrderStats, getInventoryStats } from '@/api/admin';
import { Card, CardContent } from '@/components/ui/Card';
import { cn, formatPrice } from '@/lib/utils';

export function DashboardPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';
  const navigate = useNavigate();

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: getDashboard,
  });

  // Fetch order stats
  const { data: orderStats, isLoading: orderStatsLoading } = useQuery({
    queryKey: ['admin', 'order-stats'],
    queryFn: getOrderStats,
  });

  // Fetch inventory stats
  const { data: inventoryStats, isLoading: inventoryLoading } = useQuery({
    queryKey: ['admin', 'inventory-stats'],
    queryFn: getInventoryStats,
  });

  // Fetch products for count and inventory value calculation
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['admin', 'products', { page: 1, limit: 100 }],
    queryFn: () => adminListProducts({ page: 1, limit: 100 }),
  });

  // Calculate inventory value (stock × purchase cost)
  const calculateInventoryValue = () => {
    if (!productsData?.items) return 0;
    return productsData.items.reduce((total, product) => {
      const stock = product.stockQuantity || 0;
      const cost = product.purchaseCost || 0;
      return total + (stock * cost);
    }, 0);
  };

  // Quick actions
  const quickActions = [
    { icon: Package, label: 'إضافة صنف', path: '/pos/products', color: 'bg-blue-500' },
    { icon: TrendingUp, label: 'إضافة مشتريات', path: '/pos/purchases', color: 'bg-green-500' },
    { icon: Warehouse, label: 'تعديل المخزون', path: '/pos/inventory', color: 'bg-purple-500' },
    { icon: ShoppingCart, label: 'مراجعة الطلبات', path: '/pos/orders', color: 'bg-orange-500' },
    { icon: DollarSign, label: 'إدارة الأسعار', path: '/pos/products', color: 'bg-yellow-500' },
    { icon: Truck, label: 'إدارة الموردين', path: '/pos/suppliers', color: 'bg-teal-500' },
    { icon: Users, label: 'إدارة العملاء', path: '/pos/customers', color: 'bg-pink-500' },
  ];

  // Status cards
  const statusCards = [
    {
      label: 'منتجات نشطة',
      value: productsData?.items?.filter(p => p.isAvailable).length || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'منتجات غير نشطة',
      value: productsData?.items?.filter(p => !p.isAvailable).length || 0,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      label: 'منتجات منخفضة المخزون',
      value: inventoryStats?.lowStockCount || 0,
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
  ];

  // Main stat cards
  const mainStats = [
    {
      label: 'إجمالي المبيعات',
      value: formatPrice(orderStats?.revenue || 0, lang),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      loading: orderStatsLoading,
    },
    {
      label: 'عدد الطلبات',
      value: orderStats?.totalOrders || 0,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      loading: orderStatsLoading,
    },
    {
      label: 'إجمالي المشتريات',
      value: formatPrice(inventoryStats?.totalStockQuantity || 0, lang),
      suffix: 'وحدة',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      loading: inventoryLoading,
    },
    {
      label: 'قيمة المخزون',
      value: formatPrice(calculateInventoryValue(), lang),
      icon: Warehouse,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      loading: productsLoading,
    },
    {
      label: 'عدد المنتجات',
      value: productsData?.total || 0,
      icon: Package,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      loading: productsLoading,
    },
  ];

  const isLoading = dashboardLoading || orderStatsLoading || inventoryLoading || productsLoading;

  return (
    <div className="h-full bg-white text-gray-800">
      <div className="border-b border-gray-300 bg-[#e8e8e0] px-4 py-3">
        <h1 className="text-sm font-bold text-gray-800">
          {isAr ? 'لوحة التحكم' : 'Dashboard'}
        </h1>
      </div>

      <div className="p-4">
        {/* Loading State */}
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-green-600" />
            <p className="mt-3 text-xs text-gray-500">جاري تحميل البيانات...</p>
          </div>
        ) : (
          <>
            {/* Main Stats Grid */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {mainStats.map((stat) => (
                <div
                  key={stat.label}
                  className={cn(
                    "rounded border border-gray-300 p-3",
                    stat.bgColor
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded", stat.bgColor)}>
                      <stat.icon className={cn("h-4 w-4", stat.color)} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-600">{stat.label}</p>
                      <p className={cn("text-lg font-bold", stat.color)}>
                        {stat.value}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Status Cards */}
            <div className="mb-6 grid grid-cols-3 gap-3">
              {statusCards.map((stat) => (
                <div
                  key={stat.label}
                  className={cn(
                    "rounded border border-gray-300 p-3",
                    stat.bgColor
                  )}
                >
                  <div className="flex items-center gap-2">
                    <stat.icon className={cn("h-5 w-5", stat.color)} />
                    <div>
                      <p className="text-[10px] text-gray-600">{stat.label}</p>
                      <p className={cn("text-xl font-bold", stat.color)}>
                        {stat.value}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="mb-6">
              <h2 className="mb-3 text-xs font-bold text-gray-700">
                {isAr ? 'إجراءات سريعة' : 'Quick Actions'}
              </h2>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.path)}
                    className="flex flex-col items-center gap-1 rounded border border-gray-300 bg-white p-2 hover:bg-gray-50"
                  >
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded", action.color)}>
                      <action.icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-[10px] text-gray-700">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Orders Summary */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Order Status Breakdown */}
              <div className="rounded border border-gray-300 bg-[#f5f5f0] p-4">
                <h3 className="mb-3 text-xs font-bold text-gray-700">
                  {isAr ? 'ملخص الطلبات' : 'Order Summary'}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">طلبات مكتملة</span>
                    <span className="font-bold text-green-600">{orderStats?.completedOrders || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">طلبات قيد الانتظار</span>
                    <span className="font-bold text-yellow-600">{orderStats?.pendingOrders || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">طلبات ملغاة</span>
                    <span className="font-bold text-red-600">{orderStats?.cancelledOrders || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">طلبات مستردة</span>
                    <span className="font-bold text-gray-600">{orderStats?.refundedOrders || 0}</span>
                  </div>
                </div>
              </div>

              {/* Inventory Summary */}
              <div className="rounded border border-gray-300 bg-[#f5f5f0] p-4">
                <h3 className="mb-3 text-xs font-bold text-gray-700">
                  {isAr ? 'ملخص المخزون' : 'Inventory Summary'}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">إجمالي المنتجات</span>
                    <span className="font-bold text-blue-600">{inventoryStats?.totalProducts || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">منتجات متعقبة</span>
                    <span className="font-bold text-purple-600">{inventoryStats?.trackableProducts || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">إجمالي المخزون</span>
                    <span className="font-bold text-green-600">{inventoryStats?.totalStockQuantity || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">مخزون منخفض</span>
                    <span className="font-bold text-yellow-600">{inventoryStats?.lowStockCount || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">نفذ من المخزون</span>
                    <span className="font-bold text-red-600">{inventoryStats?.outOfStockCount || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
