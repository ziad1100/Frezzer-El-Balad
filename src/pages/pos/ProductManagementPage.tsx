import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Package,
  Save,
  X,
  Edit,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  adminListProducts,
  adminListCategories,
  createProduct,
  updateProduct,
  toggleProduct,
} from '@/api/admin';
import type { Product, ProductPayload } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { PageHeader, Pagination, TableWrap, Td, Th } from '@/components/admin/primitives';
import { cn, formatPrice } from '@/lib/utils';

interface ProductFormState {
  name: string;
  nameEn: string;
  productType: string;
  category: string;
  basePrice: string;
  purchaseCost: string;
  barcode: string;
  unit: string;
  supplierCode: string;
  stockQuantity: string;
  isAvailable: boolean;
}

const defaultForm = (): ProductFormState => ({
  name: '',
  nameEn: '',
  productType: 'مخزوني',
  category: '',
  basePrice: '',
  purchaseCost: '',
  barcode: '',
  unit: 'قطعة',
  supplierCode: '',
  stockQuantity: '0',
  isAvailable: true,
});

export function ProductManagementPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';
  const queryClient = useQueryClient();

  // State
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ProductFormState>(defaultForm());
  const [formError, setFormError] = useState('');
  const [showStockAdjust, setShowStockAdjust] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'increase' | 'decrease'>('increase');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['admin', 'products', { page, q: search, category: categoryFilter, availability: statusFilter }],
    queryFn: () => adminListProducts({
      page,
      limit: 20,
      q: search,
      category: categoryFilter,
      availability: statusFilter,
    }),
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: adminListCategories,
  });

  // Create product mutation
  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      toast.success(isAr ? 'تم إنشاء المنتج بنجاح' : 'Product created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || (isAr ? 'فشل إنشاء المنتج' : 'Failed to create product'));
    },
  });

  // Update product mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductPayload> }) => updateProduct(id, data),
    onSuccess: () => {
      toast.success(isAr ? 'تم تحديث المنتج بنجاح' : 'Product updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || (isAr ? 'فشل تحديث المنتج' : 'Failed to update product'));
    },
  });

  // Toggle product status mutation
  const toggleMutation = useMutation({
    mutationFn: toggleProduct,
    onSuccess: () => {
      toast.success(isAr ? 'تم تحديث الحالة' : 'Status updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    },
  });

  // Reset form
  const resetForm = () => {
    setEditing(null);
    setCreating(false);
    setForm(defaultForm());
    setFormError('');
  };

  // Open create form
  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm());
    setCreating(true);
  };

  // Open edit form
  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      nameEn: product.nameEn || '',
      productType: product.productType || 'مخزوني',
      category: typeof product.category === 'object' ? product.category?._id || '' : product.category || '',
      basePrice: String(product.basePrice),
      purchaseCost: String(product.purchaseCost || 0),
      barcode: product.barcode || '',
      unit: product.unit || 'قطعة',
      supplierCode: product.supplierCode || '',
      stockQuantity: String(product.stockQuantity || 0),
      isAvailable: product.isAvailable,
    });
    setCreating(true);
  };

  // Handle save
  const handleSave = () => {
    if (!form.name.trim()) {
      setFormError(isAr ? 'اسم الصنف مطلوب' : 'Product name is required');
      return;
    }
    if (!form.basePrice || Number(form.basePrice) <= 0) {
      setFormError(isAr ? 'سعر البيع يجب أن يكون أكبر من صفر' : 'Selling price must be greater than 0');
      return;
    }

    const payload: ProductPayload = {
      name: form.name.trim(),
      nameEn: form.nameEn.trim(),
      productType: form.productType,
      category: form.category,
      basePrice: Number(form.basePrice),
      purchaseCost: Number(form.purchaseCost) || 0,
      barcode: form.barcode.trim() || undefined,
      unit: form.unit,
      supplierCode: form.supplierCode.trim() || undefined,
      stockQuantity: Number(form.stockQuantity) || 0,
      isAvailable: form.isAvailable,
      trackInventory: true,
    };

    if (editing) {
      updateMutation.mutate({ id: editing._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Handle stock adjustment
  const handleStockAdjust = () => {
    if (!showStockAdjust) return;
    const qty = Number(adjustQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error(isAr ? 'أدخل كمية صحيحة' : 'Enter a valid quantity');
      return;
    }

    const currentStock = showStockAdjust.stockQuantity || 0;
    const newStock = adjustType === 'increase' ? currentStock + qty : currentStock - qty;

    if (newStock < 0) {
      toast.error(isAr ? 'الكمية لا يمكن أن تكون سالبة' : 'Stock cannot be negative');
      return;
    }

    updateMutation.mutate({
      id: showStockAdjust._id,
      data: { stockQuantity: newStock },
    });

    setShowStockAdjust(null);
    setAdjustQty('');
    setAdjustReason('');
  };

  // Get category name
  const getCategoryName = (category: Product['category']) => {
    if (typeof category === 'object' && category) {
      return isAr ? category.name : (category.nameEn || category.name);
    }
    return '-';
  };

  // Get status display
  const getStatusDisplay = (isAvailable: boolean) => {
    return isAvailable
      ? { text: 'نشط', className: 'bg-green-100 text-green-700 border-green-300' }
      : { text: 'غير نشط', className: 'bg-red-100 text-red-700 border-red-300' };
  };

  return (
    <div className="h-full bg-white text-gray-800">
      <PageHeader
        title={isAr ? 'الأصناف' : 'Products'}
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'إضافة صنف' : 'Add Product'}
          </button>
        }
      />

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
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="border border-gray-400 bg-white px-2 py-1.5 text-xs"
        >
          <option value="">{isAr ? 'كل التصنيفات' : 'All Categories'}</option>
          {categories?.map((cat) => (
            <option key={cat._id} value={cat._id}>
              {isAr ? cat.name : (cat.nameEn || cat.name)}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-400 bg-white px-2 py-1.5 text-xs"
        >
          <option value="">{isAr ? 'كل الحالات' : 'All Status'}</option>
          <option value="available">{isAr ? 'نشط' : 'Active'}</option>
          <option value="hidden">{isAr ? 'غير نشط' : 'Inactive'}</option>
        </select>
      </div>

      {/* Products Table */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-green-600" />
        </div>
      ) : !productsData?.items.length ? (
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
                {productsData.items.map((product, index) => {
                  const status = getStatusDisplay(product.isAvailable);
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
                      <Td className="text-gray-600">{getCategoryName(product.category)}</Td>
                      <Td className="text-gray-600">{product.unit || 'قطعة'}</Td>
                      <Td>{formatPrice(product.purchaseCost || 0, lang)}</Td>
                      <Td className="font-medium">{formatPrice(product.basePrice, lang)}</Td>
                      <Td>
                        <button
                          onClick={() => {
                            setShowStockAdjust(product);
                            setAdjustType('increase');
                            setAdjustQty('');
                            setAdjustReason('');
                          }}
                          className={cn(
                            "font-medium hover:underline",
                            (product.stockQuantity || 0) <= 0 ? "text-red-600" :
                            (product.stockQuantity || 0) <= 10 ? "text-yellow-600" : "text-green-600"
                          )}
                        >
                          {product.stockQuantity || 0}
                        </button>
                      </Td>
                      <Td>
                        <span className={cn("inline-block rounded border px-2 py-0.5 text-[10px] font-bold", status.className)}>
                          {status.text}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(product)}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            title={isAr ? 'تعديل' : 'Edit'}
                          >
                            <Edit className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => toggleMutation.mutate(product._id)}
                            className={cn(
                              "rounded p-1 hover:bg-gray-100",
                              product.isAvailable ? "text-green-600" : "text-gray-400"
                            )}
                            title={product.isAvailable ? (isAr ? 'تعطيل' : 'Deactivate') : (isAr ? 'تفعيل' : 'Activate')}
                          >
                            {product.isAvailable ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          <Pagination page={productsData.page} pages={productsData.pages} onPage={setPage} />
        </>
      )}

      {/* Create/Edit Product Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-auto bg-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-300 bg-[#e8e8e0] px-4 py-2">
              <h2 className="text-sm font-bold text-gray-800">
                {editing ? (isAr ? 'تعديل الصنف' : 'Edit Product') : (isAr ? 'صنف جديد' : 'New Product')}
              </h2>
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Product Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    {isAr ? 'اسم الصنف (عربي)' : 'Product Name (Arabic)'} *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-400 bg-white px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    {isAr ? 'اسم الصنف (إنجليزي)' : 'Product Name (English)'}
                  </label>
                  <input
                    type="text"
                    value={form.nameEn}
                    onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                    className="w-full border border-gray-400 bg-white px-2 py-1.5 text-xs"
                  />
                </div>
              </div>

              {/* Product Type */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  {isAr ? 'نوع الصنف' : 'Product Type'}
                </label>
                <select
                  value={form.productType}
                  onChange={(e) => setForm({ ...form, productType: e.target.value })}
                  className="w-full border border-gray-400 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="مخزوني">صنف مخزوني</option>
                  <option value="خدمي">صنف خدمي</option>
                  <option value="خامات">خامات</option>
                  <option value="مجمّع">صنف مجمّع</option>
                </select>
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    {isAr ? 'التصنيف' : 'Category'}
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-gray-400 bg-white px-2 py-1.5 text-xs"
                  >
                    <option value="">{isAr ? 'اختر التصنيف' : 'Select category'}</option>
                    {categories?.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {isAr ? cat.name : (cat.nameEn || cat.name)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    {isAr ? 'الوحدة' : 'Unit'}
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full border border-gray-400 bg-white px-2 py-1.5 text-xs"
                  >
                    <option value="قطعة">قطعة</option>
                    <option value="كيلو">كيلو</option>
                    <option value="جرام">جرام</option>
                    <option value="لتر">لتر</option>
                    <option value="علبة">علبة</option>
                    <option value="كرتون">كرتون</option>
                  </select>
                </div>
              </div>

              {/* Barcode & Supplier Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    {isAr ? 'الباركود' : 'Barcode'}
                  </label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder={isAr ? 'امسح الباركود أو أدخل الكود' : 'Scan barcode or enter code'}
                    className="w-full border border-gray-400 bg-white px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    {isAr ? 'كود المورد' : 'Supplier Code'}
                  </label>
                  <input
                    type="text"
                    value={form.supplierCode}
                    onChange={(e) => setForm({ ...form, supplierCode: e.target.value })}
                    placeholder={isAr ? 'كود المورد' : 'Supplier code'}
                    className="w-full border border-gray-400 bg-white px-2 py-1.5 text-xs"
                  />
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    {isAr ? 'سعر الشراء' : 'Purchase Cost'}
                  </label>
                  <input
                    type="number"
                    value={form.purchaseCost}
                    onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })}
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-400 bg-white px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    {isAr ? 'سعر البيع' : 'Selling Price'} *
                  </label>
                  <input
                    type="number"
                    value={form.basePrice}
                    onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-400 bg-white px-2 py-1.5 text-xs"
                  />
                </div>
              </div>

              {/* Stock & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    {isAr ? 'الرصيد الحالي' : 'Current Stock'}
                  </label>
                  <input
                    type="number"
                    value={form.stockQuantity}
                    onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                    min="0"
                    className="w-full border border-gray-400 bg-white px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    {isAr ? 'الحالة' : 'Status'}
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, isAvailable: !form.isAvailable })}
                      className={cn(
                        "flex items-center gap-1 rounded border px-3 py-1.5 text-xs font-bold",
                        form.isAvailable
                          ? "border-green-300 bg-green-100 text-green-700"
                          : "border-red-300 bg-red-100 text-red-700"
                      )}
                    >
                      {form.isAvailable ? (
                        <>
                          <ToggleRight className="h-4 w-4" />
                          نشط
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-4 w-4" />
                          غير نشط
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Error */}
              {formError && (
                <p className="text-xs text-red-600">{formError}</p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-gray-300 pt-4">
                <button
                  onClick={resetForm}
                  className="rounded border border-gray-400 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:bg-gray-300"
                >
                  <Save className="inline h-4 w-4 ml-1" />
                  {isAr ? 'حفظ' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showStockAdjust && (
        <Modal
          open
          onClose={() => setShowStockAdjust(null)}
          title={isAr ? `تعديل رصيد ${showStockAdjust.name}` : `Adjust Stock: ${showStockAdjust.name}`}
          size="sm"
        >
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">{isAr ? 'الرصيد الحالي' : 'Current Stock'}</p>
              <p className="text-2xl font-bold text-gray-800">{showStockAdjust.stockQuantity || 0}</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                {isAr ? 'نوع التعديل' : 'Adjustment Type'}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAdjustType('increase')}
                  className={cn(
                    "flex-1 rounded border px-3 py-2 text-xs font-bold",
                    adjustType === 'increase'
                      ? "border-green-300 bg-green-100 text-green-700"
                      : "border-gray-300 bg-white text-gray-600"
                  )}
                >
                  زيادة مخزون
                </button>
                <button
                  onClick={() => setAdjustType('decrease')}
                  className={cn(
                    "flex-1 rounded border px-3 py-2 text-xs font-bold",
                    adjustType === 'decrease'
                      ? "border-red-300 bg-red-100 text-red-700"
                      : "border-gray-300 bg-white text-gray-600"
                  )}
                >
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
                placeholder={isAr ? 'سبب التعديل (اختياري)' : 'Adjustment reason (optional)'}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowStockAdjust(null)}
                className="rounded border border-gray-400 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleStockAdjust}
                disabled={!adjustQty || Number(adjustQty) <= 0}
                className="rounded bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:bg-gray-300"
              >
                {isAr ? 'تأكيد التعديل' : 'Confirm Adjustment'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
