import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import {
  adminSearchProducts,
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
import { formatPrice } from '@/lib/utils';

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
                        {p.productSize && <span className="ms-1 text-night-500">({p.productSize})</span>}
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

function PurchaseFormModal({ onClose, lang, queryClient }: { onClose: () => void; lang: string; queryClient: ReturnType<typeof useQueryClient> }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<AdminSearchProduct | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));

  const searchResults = useQuery({
    queryKey: ['admin', 'productSearch', searchQuery],
    queryFn: () => adminSearchProducts(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'purchases'] });
      toast.success(lang === 'ar' ? 'تم تسجيل المشتريات' : 'Purchase recorded');
      onClose();
    },
    onError: () => toast.error(lang === 'ar' ? 'فشل التسجيل' : 'Failed to record purchase'),
  });

  const totalCost = (Number(quantity) || 0) * (Number(unitCost) || 0);

  const handleSubmit = () => {
    if (!selectedProduct) return;
    createMutation.mutate({
      productId: selectedProduct._id,
      sizeId: selectedSizeId || undefined,
      productName: selectedProduct.name,
      productSize: selectedProduct.sizes?.find((s) => s._id === selectedSizeId)?.name || '',
      quantity: Number(quantity),
      unitCost: Number(unitCost),
      supplier,
      notes,
      purchaseDate: new Date(purchaseDate).toISOString(),
    });
  };

  const productName = (p: AdminSearchProduct) => lang === 'ar' ? p.name : (p.nameEn || p.name);

  return (
    <Modal open onClose={onClose}>
      <div className="w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-night-50">
          {lang === 'ar' ? 'إضافة مشتريات' : 'Add Purchase'}
        </h2>

        {/* Product Search */}
        {!selectedProduct ? (
          <div>
            <Label>{lang === 'ar' ? 'بحث عن منتج' : 'Search Product'}</Label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'اكتب اسم المنتج...' : 'Type product name...'}
            />
            {searchResults.data && searchResults.data.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-night-700">
                {searchResults.data.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => { setSelectedProduct(p); setSearchQuery(''); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-night-800"
                  >
                    <span className="text-night-100">{productName(p)}</span>
                    <span className="ms-auto text-xs text-night-500">{formatPrice(p.basePrice, lang)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-night-700 bg-night-900 p-3">
              <span className="text-night-100">{productName(selectedProduct)}</span>
              <button onClick={() => setSelectedProduct(null)} className="ms-auto text-night-500 hover:text-night-300">✕</button>
            </div>

            {/* Size Selection */}
            {selectedProduct.sizes && selectedProduct.sizes.length > 0 && (
              <div>
                <Label>{lang === 'ar' ? 'النوع / الوزن' : 'Variant / Weight'}</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.sizes.map((size) => (
                    <button
                      key={size._id}
                      onClick={() => setSelectedSizeId(size._id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                        selectedSizeId === size._id
                          ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                          : 'border-night-700 text-night-300 hover:border-night-500'
                      }`}
                    >
                      {lang === 'ar' ? size.name : (size.nameEn || size.name)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{lang === 'ar' ? 'الكمية' : 'Quantity'}</Label>
                <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div>
                <Label>{lang === 'ar' ? 'سعر الوحدة' : 'Unit Cost (EGP)'}</Label>
                <Input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
              </div>
            </div>

            <div className="rounded-lg border border-night-700 bg-night-900 p-3 text-center">
              <span className="text-sm text-night-400">{lang === 'ar' ? 'الإجمالي' : 'Total'}: </span>
              <span className="text-lg font-bold text-brand-400">{formatPrice(totalCost, lang)}</span>
            </div>

            <div>
              <Label>{lang === 'ar' ? 'المورد (اختياري)' : 'Supplier (optional)'}</Label>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>

            <div>
              <Label>{lang === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div>
              <Label>{lang === 'ar' ? 'تاريخ الشراء' : 'Purchase Date'}</Label>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>

            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending}
              disabled={!quantity || !unitCost || Number(quantity) <= 0}
              className="w-full"
            >
              {lang === 'ar' ? 'تسجيل المشتريات' : 'Record Purchase'}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
