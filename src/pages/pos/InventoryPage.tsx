import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Package,
  Search,
  Edit,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  adminListProducts,
  updateProduct,
  getInventoryStats,
} from '@/api/admin';
import { Card, CardContent } from '@/components/ui/Card';
import { PageHeader, Pagination, TableWrap, Td, Th } from '@/components/admin/primitives';
import { cn, formatPrice } from '@/lib/utils';
import type { Product } from '@/types';

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

export function InventoryPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';
  const queryClient = useQueryClient();

  // State
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [page, setPage] = useState(1);
  const [showAdjustModal, setShowAdjustModal] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'increase' | 'decrease'>('increase');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['admin', 'products', { page, limit: 20, q: search }],
    queryFn: () => adminListProducts({ page, limit: 20, q: search }),
  });

  // Fetch inventory stats
  const { data: inventoryStats } = useQuery({
    queryKey: ['admin', 'inventory-stats'],
    queryFn: getInventoryStats,
  });

  // Update product mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { stockQuantity: number } }) => updateProduct(id, data),
    onSuccess: () => {
      toast.success(isAr ? 'تم تحديث المخزون' : 'Stock updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'inventory-stats'] });
      setShowAdjustModal(null);
      setAdjustQty('');
      setAdjustReason('');
    },
    onError: (error: Error) => {
      toast.error(error.message || (isAr ? 'فشل تحديث المخزون' : 'Failed to update stock'));
    },
  });

  // Filter products by stock status
  const getFilteredProducts = () => {
    if (!productsData?.items) return [];
    
    return productsData.items.filter((product) => {
      const stock = product.stockQuantity || 0;
      const threshold = product.lowStockThreshold || 10;
      
      switch (filter) {
        case 'in_stock':
          return stock > threshold;
        case 'low_stock':
          return stock > 0 && stock <= threshold;
        case 'out_of_stock':
          return stock <= 0;
        default:
          return true;
      }
    });
  };

  const filteredProducts = getFilteredProducts();

  // Handle stock adjustment
  const handleAdjustStock = () => {
    if (!showAdjustModal) return;
    const qty = Number(adjustQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error(isAr ? 'أدخل كمية صحيحة' : 'Enter a valid quantity');
      return;
    }

    const currentStock = showAdjustModal.stockQuantity || 0;
    const newStock = adjustType === 'increase' ? currentStock + qty : currentStock - qty;

    if (newStock < 0) {
      toast.error(isAr ? 'الكمية لا يمكن أن تكون سالبة' : 'Stock cannot be negative');
      return;
    }

    updateMutation.mutate({
      id: showAdjustModal._id,
      data: { stockQuantity: newStock },
    });
  };

  // Get stock status
  const getStockStatus = (stock: number, threshold: number) => {
    if (stock <= 0) return { text: 'نفذ', className: 'bg-red-100 text-red-700' };
    if (stock <= threshold) return { text: 'منخفض', className: 'bg-yellow-100 text-yellow-700' };
    return { text: 'متوفر', className: 'bg-green-100 text-green-700' };
  };

  // Get status display
  const getStatusDisplay = (isAvailable: boolean) => {
    return isAvailable
      ? { text: 'نشط', className: 'bg-green-100 text-green-700 border-green-300' }
      : { text: 'غير نشط', className: 'bg-red-100 text-red-700 border-red-300' };
  };

  return (
    <div className="h-full bg-white text-gray-800">
      <PageHeader title={isAr ? 'المخزون' : 'Inventory'} />

      {/* Inventory Stats */}
      {inventoryStats && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded border border-gray-300 bg-blue-50 p-3">
            <p className="text-[10px] text-gray-600">إجمالي المنتجات</p>
            <p className="text-lg font-bold text-blue-600">{inventoryStats.totalProducts}</p>
          </div>
          <div className="rounded border border-gray-300 bg-green-50 p-3">
            <p className="text-[10px] text-gray-600">المنتجات المتعقبة</p>
            <p className="text-lg font-bold text-green-600">{inventoryStats.trackableProducts}</p>
          </div>
          <div className="rounded border border-gray-300 bg-purple-50 p-3">
            <p className="text-[10px] text-gray-600">إجمالي المخزون</p>
            <p className="text-lg font-bold text-purple-600">{inventoryStats.totalStockQuantity}</p>
          </div>
          <div className="rounded border border-gray-300 bg-yellow-50 p-3">
            <p className="text-[10px] text-gray-600">مخزون منخفض</p>
            <p className="text-lg font-bold text-yellow-600">{inventoryStats.lowStockCount}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={isAr ? 'بحث بالاسم أو الباركود...' : 'Search by name or barcode...'}
            className="w-full border border-gray-400 bg-white pl-8 pr-2 py-1.5 text-xs"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'in_stock', 'low_stock', 'out_of_stock'] as StockFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded border px-3 py-1.5 text-[10px] font-bold",
                filter === f
                  ? "border-green-300 bg-green-100 text-green-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              {f === 'all' && 'الكل'}
              {f === 'in_stock' && 'متوفر'}
              {f === 'low_stock' && 'منخفض'}
              {f === 'out_of_stock' && 'نفذ'}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-green-600" />
        </div>
      ) : !filteredProducts.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">
              {isAr ? 'لا توجد منتجات' : 'No products found'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <TableWrap>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-300 bg-[#d4d4c8] text-right">
                  <Th>{isAr ? 'الصنف' : 'Product'}</Th>
                  <Th>{isAr ? 'الباركود' : 'Barcode'}</Th>
                  <Th>{isAr ? 'التصنيف' : 'Category'}</Th>
                  <Th>{isAr ? 'الوحدة' : 'Unit'}</Th>
                  <Th>{isAr ? 'سعر الشراء' : 'Cost'}</Th>
                  <Th>{isAr ? 'سعر البيع' : 'Price'}</Th>
                  <Th>{isAr ? 'الرصيد' : 'Stock'}</Th>
                  <Th>{isAr ? 'الحالة' : 'Status'}</Th>
                  <Th>{isAr ? 'الإجراءات' : 'Actions'}</Th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, index) => {
                  const stock = product.stockQuantity || 0;
                  const threshold = product.lowStockThreshold || 10;
                  const stockStatus = getStockStatus(stock, threshold);
                  const status = getStatusDisplay(product.isAvailable);
                  const category = typeof product.category === 'object' ? product.category : null;
                  
                  return (
                    <tr
                      key={product._id}
                      className={cn(
                        "border-b border-gray-200",
                        index % 2 === 0 ? "bg-white" : "bg-pink-50",
                        "hover:bg-blue-50"
                      )}
                    >
                      <Td>
                        <div className="flex items-center gap-2">
                          {product.images?.[0] ? (
                            <img src={product.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100">
                              <Package className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-800">{product.name}</p>
                            {product.nameEn && (
                              <p className="text-[10px] text-gray-500">{product.nameEn}</p>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td className="text-gray-600">{product.barcode || '-'}</Td>
                      <Td className="text-gray-600">
                        {category ? (isAr ? category.name : (category.nameEn || category.name)) : '-'}
                      </Td>
                      <Td className="text-gray-600">{product.unit || 'قطعة'}</Td>
                      <Td>{formatPrice(product.purchaseCost || 0, lang)}</Td>
                      <Td className="font-medium">{formatPrice(product.basePrice, lang)}</Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            "font-bold",
                            stock <= 0 ? "text-red-600" : stock <= threshold ? "text-yellow-600" : "text-green-600"
                          )}>
                            {stock}
                          </span>
                          <span className={cn("rounded px-1 py-0.5 text-[8px] font-bold", stockStatus.className)}>
                            {stockStatus.text}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <span className={cn("inline-block rounded border px-2 py-0.5 text-[10px] font-bold", status.className)}>
                          {status.text}
                        </span>
                      </Td>
                      <Td>
                        <button
                          onClick={() => {
                            setShowAdjustModal(product);
                            setAdjustType('increase');
                            setAdjustQty('');
                            setAdjustReason('');
                          }}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                          title={isAr ? 'تعديل الرصيد' : 'Adjust Stock'}
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          <Pagination page={page} pages={productsData?.pages || 1} onPage={setPage} />
        </>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm bg-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-300 bg-[#e8e8e0] px-4 py-2">
              <h2 className="text-sm font-bold text-gray-800">
                {isAr ? `تعديل رصيد ${showAdjustModal.name}` : `Adjust Stock: ${showAdjustModal.name}`}
              </h2>
              <button
                onClick={() => setShowAdjustModal(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              <div className="text-center">
                <p className="text-xs text-gray-600">{isAr ? 'الرصيد الحالي' : 'Current Stock'}</p>
                <p className="text-3xl font-bold text-gray-800">{showAdjustModal.stockQuantity || 0}</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  {isAr ? 'نوع التعديل' : 'Adjustment Type'}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdjustType('increase')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1 rounded border px-3 py-2 text-xs font-bold",
                      adjustType === 'increase'
                        ? "border-green-300 bg-green-100 text-green-700"
                        : "border-gray-300 bg-white text-gray-600"
                    )}
                  >
                    <TrendingUp className="h-4 w-4" />
                    زيادة مخزون
                  </button>
                  <button
                    onClick={() => setAdjustType('decrease')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1 rounded border px-3 py-2 text-xs font-bold",
                      adjustType === 'decrease'
                        ? "border-red-300 bg-red-100 text-red-700"
                        : "border-gray-300 bg-white text-gray-600"
                    )}
                  >
                    <TrendingDown className="h-4 w-4" />
                    نقص مخزون
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  {isAr ? 'الكمية' : 'Quantity'}
                </label>
                <input
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  min="1"
                  className="w-full border border-gray-400 bg-white px-2 py-1.5 text-xs"
                  placeholder={isAr ? 'أدخل الكمية' : 'Enter quantity'}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  {isAr ? 'السبب' : 'Reason'}
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full border border-gray-400 bg-white px-2 py-1.5 text-xs"
                  placeholder={isAr ? 'سبب التعديل (اختياري)' : 'Reason (optional)'}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAdjustModal(null)}
                  className="rounded border border-gray-400 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={handleAdjustStock}
                  disabled={!adjustQty || Number(adjustQty) <= 0 || updateMutation.isPending}
                  className="rounded bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:bg-gray-300"
                >
                  {isAr ? 'تأكيد التعديل' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
