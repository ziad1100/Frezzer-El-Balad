import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Calendar, Weight } from 'lucide-react';
import { toast } from 'sonner';
import {
  createPurchase,
  deletePurchase,
  listPurchases,
  getPurchaseStats,
  type AdminSearchProduct,
} from '@/api/admin';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader, Pagination, TableWrap, Td, Th } from '@/components/admin/primitives';
import { ProductSelect } from '@/components/admin/ProductSelect';
import { cn, formatPrice } from '@/lib/utils';

type DateFilter = 'today' | 'week' | 'month' | 'custom';

function getDateRange(filter: DateFilter, customStart?: string, customEnd?: string): { startDate?: string; endDate?: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case 'today':
      return { startDate: today.toISOString(), endDate: now.toISOString() };
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { startDate: weekAgo.toISOString(), endDate: now.toISOString() };
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: monthStart.toISOString(), endDate: now.toISOString() };
    }
    case 'custom':
      return {
        startDate: customStart ? new Date(customStart).toISOString() : undefined,
        endDate: customEnd ? new Date(customEnd + 'T23:59:59').toISOString() : undefined,
      };
    default:
      return {};
  }
}

export function AdminPurchasesPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const dateRange = getDateRange(dateFilter, customStart, customEnd);

  const purchases = useQuery({
    queryKey: ['admin', 'purchases', { page, ...dateRange }],
    queryFn: () => listPurchases({ page, limit: 15, ...dateRange }),
    placeholderData: { items: [], total: 0, pages: 1, page: 1, limit: 15 },
  });

  const stats = useQuery({
    queryKey: ['admin', 'purchases', 'stats', dateRange],
    queryFn: () => getPurchaseStats(dateRange),
    placeholderData: { totalCost: 0, totalQuantity: 0, purchaseCount: 0, byProduct: [] },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'purchases'] });
      toast.success(lang === 'ar' ? 'تم حذف المشتريات' : 'Purchase deleted');
    },
    onError: () => toast.error(lang === 'ar' ? 'فشل الحذف' : 'Delete failed'),
  });

  return (
    <div>
      <PageHeader
        title={lang === 'ar' ? 'المشتريات' : 'Purchases'}
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            {lang === 'ar' ? 'إضافة مشتريات' : 'Add Purchase'}
          </Button>
        }
      />

      {/* Date Filter */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Calendar className="h-4 w-4 text-night-500" />
        {(['today', 'week', 'month', 'custom'] as DateFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              dateFilter === f
                ? 'bg-brand-500/20 text-brand-400'
                : 'text-night-400 hover:text-night-200'
            }`}
          >
            {f === 'today' ? (lang === 'ar' ? 'اليوم' : 'Today')
              : f === 'week' ? (lang === 'ar' ? 'هذا الأسبوع' : 'This Week')
              : f === 'month' ? (lang === 'ar' ? 'هذا الشهر' : 'This Month')
              : (lang === 'ar' ? 'مخصص' : 'Custom')}
          </button>
        ))}
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-36" />
            <span className="text-night-500">—</span>
            <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-36" />
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-night-400">{lang === 'ar' ? 'إجمالي التكلفة' : 'Total Cost'}</p>
            <p className="mt-1 text-2xl font-extrabold text-night-50">
              {stats.data ? formatPrice(stats.data.totalCost, lang) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-night-400">{lang === 'ar' ? 'إجمالي الكمية' : 'Total Quantity'}</p>
            <p className="mt-1 text-2xl font-extrabold text-night-50">
              {stats.data?.totalQuantity ?? '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-night-400">{lang === 'ar' ? 'عدد المشتريات' : 'Purchases'}</p>
            <p className="mt-1 text-2xl font-extrabold text-night-50">
              {stats.data?.purchaseCount ?? '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Purchase History Table */}
      <Card>
        <CardContent>
          {purchases.isLoading ? (
            <div className="py-8 text-center text-night-500">{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
          ) : purchases.isError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-400">
                {lang === 'ar' ? 'تعذر تحميل المشتريات — يرجى المحاولة مرة أخرى' : 'Failed to load purchases — please try again'}
              </p>
              <button
                onClick={() => purchases.refetch()}
                className="mt-2 text-sm font-semibold text-brand-400 hover:text-brand-300"
              >
                {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          ) : !purchases.data?.items.length ? (
            <div className="py-8 text-center text-night-500">
              {lang === 'ar' ? 'لا توجد مشتريات' : 'No purchases found'}
            </div>
          ) : (
            <TableWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-night-800 text-left text-xs uppercase tracking-wider text-night-500">
                    <Th>{lang === 'ar' ? 'التاريخ' : 'Date'}</Th>
                    <Th>{lang === 'ar' ? 'المنتج' : 'Product'}</Th>
                    <Th>{lang === 'ar' ? 'الوزن' : 'Weight'}</Th>
                    <Th>{lang === 'ar' ? 'الكمية' : 'Qty'}</Th>
                    <Th>{lang === 'ar' ? 'سعر الوحدة' : 'Unit Cost'}</Th>
                    <Th>{lang === 'ar' ? 'الإجمالي' : 'Total'}</Th>
                    <Th>{lang === 'ar' ? 'المورد' : 'Supplier'}</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.data.items.map((p) => (
                    <tr key={p._id} className="border-b border-night-800/50">
                      <Td>{new Date(p.purchaseDate).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</Td>
                      <Td>
                        <span className="font-semibold text-night-100">{p.productName}</span>
                      </Td>
                      <Td className="text-xs text-night-400">
                        {p.weightDisplay || p.productSize || '—'}
                      </Td>
                      <Td>{p.quantity}</Td>
                      <Td>{formatPrice(p.unitCost, lang)}</Td>
                      <Td className="font-bold text-night-50">{formatPrice(p.totalCost, lang)}</Td>
                      <Td className="text-night-400">{p.supplier || '—'}</Td>
                      <Td>
                        <button
                          onClick={() => {
                            if (confirm(lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?')) {
                              deleteMutation.mutate(p._id);
                            }
                          }}
                          className="text-night-500 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
          {purchases.data && purchases.data.pages > 1 && (
            <div className="mt-4">
              <Pagination page={purchases.data.page} pages={purchases.data.pages} onPage={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchase Form Modal */}
      {showForm && <PurchaseFormModal onClose={() => setShowForm(false)} lang={lang} queryClient={queryClient} />}
    </div>
  );
}

type WeightMode = 'fixed' | 'custom';

/** Convert grams to display string */
function formatWeightDisplay(grams: number, lang: string): string {
  if (grams === 0) return '';
  if (grams >= 1000) {
    const kg = grams / 1000;
    return kg === Math.floor(kg)
      ? `${kg} ${lang === 'ar' ? 'كيلو' : 'kg'}`
      : `${kg.toFixed(1)} ${lang === 'ar' ? 'كيلو' : 'kg'}`;
  }
  return `${grams} ${lang === 'ar' ? 'جم' : 'g'}`;
}

function PurchaseFormModal({ onClose, lang, queryClient }: { onClose: () => void; lang: string; queryClient: ReturnType<typeof useQueryClient> }) {
  const isAr = lang === 'ar';
  const [selectedProduct, setSelectedProduct] = useState<AdminSearchProduct | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [weightMode, setWeightMode] = useState<WeightMode>('fixed');
  const [customWeightValue, setCustomWeightValue] = useState('');
  const [customWeightUnit, setCustomWeightUnit] = useState<'g' | 'kg'>('g');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate weight in grams
  const weightGrams = useMemo(() => {
    if (weightMode === 'fixed' && selectedSizeId) {
      const size = selectedProduct?.sizes?.find((s) => s._id === selectedSizeId);
      if (size) {
        // Try to parse weight from size name (e.g., "500 جم", "1 كيلو")
        const name = (size.nameEn || size.name).toLowerCase();
        const match500 = name.includes('500');
        const match1kilo = name.includes('1') && (name.includes('kilo') || name.includes('كيلو') || name.includes('1kg'));
        if (match500) return 500;
        if (match1kilo) return 1000;
        // Default for known sizes
        return 500;
      }
    }
    if (weightMode === 'custom') {
      const val = parseFloat(customWeightValue);
      if (isNaN(val) || val <= 0) return 0;
      return customWeightUnit === 'kg' ? val * 1000 : val;
    }
    return 0;
  }, [weightMode, selectedSizeId, selectedProduct, customWeightValue, customWeightUnit]);

  const weightDisplay = useMemo(() => {
    if (weightMode === 'fixed' && selectedSizeId) {
      const size = selectedProduct?.sizes?.find((s) => s._id === selectedSizeId);
      if (size) return isAr ? size.name : (size.nameEn || size.name);
    }
    if (weightMode === 'custom' && weightGrams > 0) {
      return formatWeightDisplay(weightGrams, lang);
    }
    return '';
  }, [weightMode, selectedSizeId, selectedProduct, weightGrams, isAr, lang]);

  const totalCost = (Number(quantity) || 0) * (Number(unitCost) || 0);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!selectedProduct) newErrors.product = isAr ? 'من فضلك اختر المنتج' : 'Please select a product';
    if (weightMode === 'fixed' && !selectedSizeId) newErrors.weight = isAr ? 'من فضلك حدد الوزن' : 'Please select a weight';
    if (weightMode === 'custom' && weightGrams <= 0) newErrors.weight = isAr ? 'من فضلك أدخل وزنًا صحيحًا' : 'Please enter a valid weight';
    if (!quantity || Number(quantity) <= 0) newErrors.quantity = isAr ? 'الكمية يجب أن تكون أكبر من صفر' : 'Quantity must be greater than 0';
    if (!unitCost || Number(unitCost) < 0) newErrors.unitCost = isAr ? 'من فضلك أدخل سعر الشراء' : 'Please enter purchase price';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createMutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'purchases'] });
      toast.success(isAr ? 'تم تسجيل المشتريات' : 'Purchase recorded');
      onClose();
    },
    onError: (error: Error) => {
      // Extract actual backend error message from Axios response
      let backendMsg = '';
      try {
        const axiosData = (error as any)?.response?.data;
        backendMsg = axiosData?.message || error?.message || '';
      } catch { backendMsg = error?.message || ''; }
      console.error('[purchases] CREATE error:', backendMsg, error);
      const userMsg = backendMsg.includes('Purchases table does not exist')
        ? (isAr ? 'نظام المشتريات غير متاح — يرجى تطبيق الترحيل' : 'Purchases system not available — please apply migration')
        : backendMsg.includes('Invalid product')
          ? (isAr ? 'المنتج غير صالح — تأكد من اختيار منتج صحيح' : 'Invalid product — please select a valid product')
          : backendMsg.includes('foreign key')
            ? (isAr ? 'خطأ في ربط البيانات — تأكد من صحة المنتج' : 'Data linkage error — check product selection')
            : (isAr ? `فشل تسجيل المشتريات: ${backendMsg || 'خطأ غير معروف'}` : `Failed to record purchase: ${backendMsg || 'Unknown error'}`);
      toast.error(userMsg);
    },
  });

  const handleSubmit = () => {
    if (!validate() || !selectedProduct) return;
    createMutation.mutate({
      productId: selectedProduct._id,
      sizeId: weightMode === 'fixed' ? (selectedSizeId || undefined) : undefined,
      productName: selectedProduct.name,
      productSize: weightDisplay,
      quantity: Number(quantity),
      unitCost: Number(unitCost),
      supplier,
      notes,
      purchaseDate: new Date(purchaseDate).toISOString(),
      weightGrams,
      weightMode,
      weightDisplay,
      categoryId: selectedProduct.category?._id,
    });
  };

  const productName = (p: AdminSearchProduct) => isAr ? p.name : (p.nameEn || p.name);

  return (
    <Modal open onClose={onClose}>
      <div className="w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-night-50">
          {isAr ? 'إضافة مشتريات' : 'Add Purchase'}
        </h2>

        {/* Product Select — Searchable Combobox */}
        <div>
          <Label>{isAr ? 'المنتج' : 'Product'}</Label>
          <ProductSelect
            value={selectedProduct}
            onSelect={(p) => { setSelectedProduct(p); setSelectedSizeId(null); setWeightMode('fixed'); }}
            onClear={() => { setSelectedProduct(null); setSelectedSizeId(null); }}
            placeholder={isAr ? 'اختر المنتج...' : 'Select product...'}
          />
          {errors.product && <p className="mt-1 text-xs text-red-400">{errors.product}</p>}
        </div>

        {/* Selected Product Info */}
        {selectedProduct && (
          <div className="rounded-lg border border-night-700 bg-night-900/50 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-night-100">{productName(selectedProduct)}</span>
              {selectedProduct.basePrice > 0 && (
                <span className="text-xs text-night-500">• {formatPrice(selectedProduct.basePrice, lang)}</span>
              )}
            </div>
            {selectedProduct.sizes && selectedProduct.sizes.length > 0 && (
              <p className="mt-1 text-xs text-night-500">
                {isAr ? 'الأوزان المتاحة:' : 'Available variants:'}{' '}
                {selectedProduct.sizes.map((s) => isAr ? s.name : (s.nameEn || s.name)).join(' • ')}
              </p>
            )}
          </div>
        )}

        {/* Weight Selection */}
        {selectedProduct && (
          <div>
            <Label>{isAr ? 'الوزن' : 'Weight'}</Label>
            <div className="space-y-3">
              {/* Predefined variants */}
              {selectedProduct.sizes && selectedProduct.sizes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.sizes.map((size) => (
                    <button
                      key={size._id}
                      onClick={() => { setSelectedSizeId(size._id); setWeightMode('fixed'); }}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                        weightMode === 'fixed' && selectedSizeId === size._id
                          ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                          : 'border-night-700 text-night-300 hover:border-night-500',
                      )}
                    >
                      {isAr ? size.name : (size.nameEn || size.name)}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom weight toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setWeightMode('custom'); setSelectedSizeId(null); }}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                    weightMode === 'custom'
                      ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                      : 'border-night-700 text-night-300 hover:border-night-500',
                  )}
                >
                  {isAr ? 'وزن مخصص' : 'Custom Weight'}
                </button>
              </div>

              {/* Custom weight input */}
              {weightMode === 'custom' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    step="0.1"
                    value={customWeightValue}
                    onChange={(e) => setCustomWeightValue(e.target.value)}
                    placeholder={isAr ? 'أدخل الوزن' : 'Enter weight'}
                    className="flex-1"
                    dir="ltr"
                  />
                  <select
                    value={customWeightUnit}
                    onChange={(e) => setCustomWeightUnit(e.target.value as 'g' | 'kg')}
                    className="rounded-lg border border-night-700 bg-night-900 px-3 py-2.5 text-sm text-night-100 outline-none"
                  >
                    <option value="g">{isAr ? 'جم' : 'g'}</option>
                    <option value="kg">{isAr ? 'كيلو' : 'kg'}</option>
                  </select>
                </div>
              )}

              {/* Weight display */}
              {weightGrams > 0 && (
                <div className="flex items-center gap-2 text-xs text-night-500">
                  <Weight className="h-3 w-3" />
                  <span>{isAr ? 'الوزن:' : 'Weight:'} {formatWeightDisplay(weightGrams, lang)}</span>
                </div>
              )}
              {errors.weight && <p className="text-xs text-red-400">{errors.weight}</p>}
            </div>
          </div>
        )}

        {/* Quantity & Price */}
        {selectedProduct && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{isAr ? 'الكمية (عدد الحبات)' : 'Quantity (units)'}</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                error={Boolean(errors.quantity)}
              />
              {errors.quantity && <p className="mt-1 text-xs text-red-400">{errors.quantity}</p>}
            </div>
            <div>
              <Label>{isAr ? 'سعر الوحدة' : 'Unit Cost (EGP)'}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                dir="ltr"
                error={Boolean(errors.unitCost)}
              />
              {errors.unitCost && <p className="mt-1 text-xs text-red-400">{errors.unitCost}</p>}
            </div>
          </div>
        )}

        {/* Total */}
        {selectedProduct && quantity && unitCost && (
          <div className="rounded-lg border border-night-700 bg-night-900 p-3 text-center">
            <span className="text-sm text-night-400">{isAr ? 'الإجمالي' : 'Total'}: </span>
            <span className="text-lg font-bold text-brand-400">{formatPrice(totalCost, lang)}</span>
          </div>
        )}

        {/* Supplier & Notes */}
        {selectedProduct && (
          <>
            <div>
              <Label>{isAr ? 'المورد (اختياري)' : 'Supplier (optional)'}</Label>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder={isAr ? 'اسم المورد' : 'Supplier name'} />
            </div>
            <div>
              <Label>{isAr ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div>
              <Label>{isAr ? 'تاريخ الشراء' : 'Purchase Date'}</Label>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
          </>
        )}

        {/* Submit */}
        {selectedProduct && (
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending}
            disabled={!quantity || !unitCost || Number(quantity) <= 0 || weightGrams <= 0}
            className="w-full"
          >
            {isAr ? 'تسجيل المشتريات' : 'Record Purchase'}
          </Button>
        )}
      </div>
    </Modal>
  );
}
