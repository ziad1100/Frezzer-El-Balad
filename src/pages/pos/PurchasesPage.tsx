import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Search,
  Barcode,
  Package,
  Save,
  X,
  Eye,
} from 'lucide-react';
import {
  searchProductByBarcode,
  adminSearchProducts,
  createPurchase,
  listPurchases,
  type AdminSearchProduct,
  type Purchase,
} from '@/api/admin';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { PageHeader, TableWrap, Td, Th } from '@/components/admin/primitives';
import { useAppSelector } from '@/hooks';
import { cn, formatPrice } from '@/lib/utils';

interface PurchaseItem {
  productId: string;
  productName: string;
  productNameEn: string;
  barcode: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  stockQuantity?: number;
}

interface Supplier {
  _id: string;
  name: string;
  nameEn: string;
  phone: string;
}

export function PurchasesPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';
  const queryClient = useQueryClient();
  const user = useAppSelector((state) => state.auth.user);

  // State
  const [showNewPurchase, setShowNewPurchase] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminSearchProduct[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Fetch purchases list
  const { data: purchasesData, isLoading } = useQuery({
    queryKey: ['admin', 'purchases'],
    queryFn: () => listPurchases({ page: 1, limit: 50 }),
  });

  // Barcode search mutation
  const barcodeMutation = useMutation({
    mutationFn: searchProductByBarcode,
    onSuccess: (product) => {
      addProductToPurchase(product);
      setBarcodeInput('');
      barcodeInputRef.current?.focus();
    },
    onError: () => {
      toast.error(isAr ? 'الصنف غير موجود' : 'Product not found');
      setBarcodeInput('');
      barcodeInputRef.current?.focus();
    },
  });

  // Search products mutation
  const searchMutation = useMutation({
    mutationFn: adminSearchProducts,
    onSuccess: (results) => {
      setSearchResults(results);
      setShowSearch(true);
    },
  });

  // Create purchase mutation
  const createPurchaseMutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: () => {
      toast.success(isAr ? 'تم تسجيل المشتريات بنجاح' : 'Purchase recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'purchases'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      resetPurchaseForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || (isAr ? 'فشل تسجيل المشتريات' : 'Failed to record purchase'));
    },
  });

  // Calculate totals
  const purchaseTotal = purchaseItems.reduce((sum, item) => sum + item.totalCost, 0);

  // Handle barcode input
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      barcodeMutation.mutate(barcodeInput.trim());
    }
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length >= 2) {
      searchMutation.mutate(query);
    } else {
      setSearchResults([]);
      setShowSearch(false);
    }
  };

  // Add product to purchase
  const addProductToPurchase = (product: AdminSearchProduct) => {
    const existingIndex = purchaseItems.findIndex(
      (item) => item.productId === product._id
    );

    if (existingIndex >= 0) {
      // Increase quantity
      const newItems = [...purchaseItems];
      newItems[existingIndex].quantity += 1;
      newItems[existingIndex].totalCost = newItems[existingIndex].quantity * newItems[existingIndex].unitCost;
      setPurchaseItems(newItems);
    } else {
      // Add new item
      setPurchaseItems([
        ...purchaseItems,
        {
          productId: product._id,
          productName: product.name,
          productNameEn: product.nameEn || product.name,
          barcode: product.barcode || '',
          quantity: 1,
          unitCost: product.purchaseCost || product.basePrice,
          totalCost: product.purchaseCost || product.basePrice,
          stockQuantity: product.stockQuantity,
        },
      ]);
    }
    toast.success(isAr ? 'تمت إضافة الصنف' : 'Product added');
  };

  // Update quantity
  const updateQuantity = (index: number, qty: number) => {
    const newItems = [...purchaseItems];
    if (qty <= 0) {
      newItems.splice(index, 1);
    } else {
      newItems[index].quantity = qty;
      newItems[index].totalCost = qty * newItems[index].unitCost;
    }
    setPurchaseItems(newItems);
  };

  // Update unit cost
  const updateUnitCost = (index: number, cost: number) => {
    const newItems = [...purchaseItems];
    newItems[index].unitCost = cost;
    newItems[index].totalCost = newItems[index].quantity * cost;
    setPurchaseItems(newItems);
  };

  // Remove item
  const removeItem = (index: number) => {
    const newItems = [...purchaseItems];
    newItems.splice(index, 1);
    setPurchaseItems(newItems);
  };

  // Reset form
  const resetPurchaseForm = () => {
    setSelectedSupplier(null);
    setSupplierSearch('');
    setPurchaseItems([]);
    setShowNewPurchase(false);
  };

  // Handle save purchase (sequential to avoid race conditions)
  const handleSavePurchase = async () => {
    if (purchaseItems.length === 0) {
      toast.error(isAr ? 'يجب إضافة صنف واحد على الأقل' : 'At least one product is required');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const item of purchaseItems) {
      try {
        await new Promise<void>((resolve, reject) => {
          createPurchaseMutation.mutate(
            {
              productId: item.productId,
              productName: item.productName,
              productSize: '',
              quantity: item.quantity,
              unitCost: item.unitCost,
              supplier: selectedSupplier?.name || '',
              notes: '',
              purchaseDate: new Date().toISOString(),
            },
            {
              onSuccess: () => { successCount++; resolve(); },
              onError: (err) => { errorCount++; reject(err); },
            }
          );
        });
      } catch {
        // Error already counted
      }
    }

    if (successCount > 0) {
      toast.success(isAr ? `تم تسجيل ${successCount} مشتريات بنجاح` : `${successCount} purchases recorded successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'purchases'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      resetPurchaseForm();
    }
    if (errorCount > 0) {
      toast.error(isAr ? `فشل تسجيل ${errorCount} مشتريات` : `${errorCount} purchases failed`);
    }
  };

  // Auto-focus barcode input
  useEffect(() => {
    if (showNewPurchase) {
      barcodeInputRef.current?.focus();
    }
  }, [showNewPurchase]);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showSearch && !(e.target as HTMLElement)?.closest('.search-dropdown')) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSearch]);

  return (
    <div className="h-full bg-white text-gray-800">
      <PageHeader
        title={isAr ? 'المشتريات' : 'Purchases'}
        action={
          <button
            onClick={() => setShowNewPurchase(true)}
            className="flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'مشتريات جديدة' : 'New Purchase'}
          </button>
        }
      />

      {/* Purchases List */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-green-600" />
        </div>
      ) : !purchasesData?.items.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">
              {isAr ? 'لا توجد مشتريات' : 'No purchases found'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <TableWrap>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-300 bg-[#d4d4c8] text-right">
                <Th>{isAr ? 'رقم المشتريات' : 'Purchase No'}</Th>
                <Th>{isAr ? 'الصنف' : 'Product'}</Th>
                <Th>{isAr ? 'المورد' : 'Supplier'}</Th>
                <Th>{isAr ? 'التاريخ' : 'Date'}</Th>
                <Th>{isAr ? 'الكمية' : 'Qty'}</Th>
                <Th>{isAr ? 'سعر الوحدة' : 'Unit Cost'}</Th>
                <Th>{isAr ? 'الإجمالي' : 'Total'}</Th>
                <Th>{isAr ? 'أنشئ بواسطة' : 'Created By'}</Th>
                <Th>{isAr ? 'عرض' : 'View'}</Th>
              </tr>
            </thead>
            <tbody>
              {purchasesData.items.map((purchase, index) => (
                <tr
                  key={purchase._id}
                  className={cn(
                    "border-b border-gray-200",
                    index % 2 === 0 ? "bg-white" : "bg-pink-50",
                    "hover:bg-blue-50 cursor-pointer"
                  )}
                  onClick={() => setSelectedPurchase(purchase)}
                >
                  <Td className="font-medium text-gray-800">#{purchase._id.slice(-6)}</Td>
                  <Td>{purchase.productName}</Td>
                  <Td>{purchase.supplier || '-'}</Td>
                  <Td>
                    {new Date(purchase.purchaseDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}
                  </Td>
                  <Td className="font-medium">{purchase.quantity}</Td>
                  <Td>{formatPrice(purchase.unitCost, lang)}</Td>
                  <Td className="font-bold text-green-600">{formatPrice(purchase.totalCost, lang)}</Td>
                  <Td>{purchase.createdBy?.fullName || '-'}</Td>
                  <Td>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPurchase(purchase);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {/* New Purchase Modal */}
      {showNewPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex h-[90vh] w-[95vw] flex-col bg-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-300 bg-[#e8e8e0] px-4 py-2">
              <h2 className="text-sm font-bold text-gray-800">
                {isAr ? 'مشتريات جديدة' : 'New Purchase'}
              </h2>
              <button
                onClick={resetPurchaseForm}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Panel - Products */}
              <div className="flex flex-1 flex-col border-l border-gray-300">
                {/* Barcode Input */}
                <div className="border-b border-gray-300 bg-[#e8e8e0] p-3">
                  <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                    <div className="relative flex-1">
                      <Barcode className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        ref={barcodeInputRef}
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        placeholder={isAr ? 'امسح الباركود...' : 'Scan barcode...'}
                        className="w-full border border-gray-400 bg-white pl-8 pr-2 py-1.5 text-sm"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      className="rounded bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  </form>

                  {/* Product Search */}
                  <div className="relative mt-2">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder={isAr ? 'بحث بالاسم...' : 'Search by name...'}
                      className="w-full border border-gray-400 bg-white pl-8 pr-2 py-1.5 text-sm"
                    />
                    
                    {/* Search Results Dropdown */}
                    {showSearch && searchResults.length > 0 && (
                      <div className="search-dropdown absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto border border-gray-400 bg-white shadow-lg">
                        {searchResults.map((product) => (
                          <button
                            key={product._id}
                            type="button"
                            onClick={() => {
                              addProductToPurchase(product);
                              setSearchQuery('');
                              setSearchResults([]);
                              setShowSearch(false);
                            }}
                            className="flex w-full items-center gap-2 border-b border-gray-200 p-2 text-right text-xs hover:bg-blue-50"
                          >
                            <Package className="h-4 w-4 text-gray-400" />
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">
                                {isAr ? product.name : (product.nameEn || product.name)}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {formatPrice(product.basePrice, lang)}
                                {product.barcode && <span className="ml-2">| {product.barcode}</span>}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Purchase Items Table */}
                <div className="flex-1 overflow-auto bg-white">
                  {purchaseItems.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <Package className="h-10 w-10 text-gray-400" />
                      <p className="mt-2 text-xs text-gray-500">
                        {isAr ? 'امسح الباركود أو ابحث عن منتج' : 'Scan barcode or search for a product'}
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#d4d4c8]">
                        <tr className="border-b border-gray-300 text-right">
                          <th className="px-2 py-1.5 font-bold text-gray-700">#</th>
                          <th className="px-2 py-1.5 font-bold text-gray-700">{isAr ? 'الصنف' : 'Product'}</th>
                          <th className="px-2 py-1.5 font-bold text-gray-700">{isAr ? 'الباركود' : 'Barcode'}</th>
                          <th className="px-2 py-1.5 font-bold text-gray-700">{isAr ? 'الكمية' : 'Qty'}</th>
                          <th className="px-2 py-1.5 font-bold text-gray-700">{isAr ? 'سعر الشراء' : 'Cost'}</th>
                          <th className="px-2 py-1.5 font-bold text-gray-700">{isAr ? 'الإجمالي' : 'Total'}</th>
                          <th className="w-8 px-2 py-1.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseItems.map((item, index) => (
                          <tr
                            key={item.productId}
                            className={cn(
                              "border-b border-gray-200",
                              index % 2 === 0 ? "bg-white" : "bg-pink-50"
                            )}
                          >
                            <td className="px-2 py-1.5 text-gray-500">{index + 1}</td>
                            <td className="px-2 py-1.5 font-medium text-gray-800">
                              {isAr ? item.productName : item.productNameEn}
                            </td>
                            <td className="px-2 py-1.5 text-gray-500">{item.barcode || '-'}</td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 0)}
                                className="w-16 border border-gray-300 bg-white px-1 py-0.5 text-center text-xs"
                                min="1"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                value={item.unitCost}
                                onChange={(e) => updateUnitCost(index, parseFloat(e.target.value) || 0)}
                                className="w-20 border border-gray-300 bg-white px-1 py-0.5 text-center text-xs"
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="px-2 py-1.5 font-medium text-green-600">
                              {formatPrice(item.totalCost, lang)}
                            </td>
                            <td className="px-2 py-1.5">
                              <button
                                onClick={() => removeItem(index)}
                                className="text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Right Panel - Summary */}
              <div className="w-72 bg-[#e8e8e0] p-3">
                {/* Supplier Selection */}
                <div className="mb-3 border-b border-gray-300 pb-3">
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    {isAr ? 'المورد' : 'Supplier'}
                  </label>
                  <input
                    type="text"
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    placeholder={isAr ? 'اسم المورد...' : 'Supplier name...'}
                    className="w-full border border-gray-400 bg-white px-2 py-1.5 text-xs"
                  />
                </div>

                {/* Purchase Info */}
                <div className="mb-3 space-y-1 border-b border-gray-300 pb-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{isAr ? 'التاريخ' : 'Date'}</span>
                    <span className="font-medium text-gray-800">
                      {new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{isAr ? 'المستخدم' : 'User'}</span>
                    <span className="font-medium text-gray-800">{user?.fullName || 'Admin'}</span>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="mb-3 border-b border-gray-300 pb-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">{isAr ? 'عدد الأصناف' : 'Items'}</span>
                    <span className="font-medium text-gray-800">{purchaseItems.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">{isAr ? 'إجمالي الكمية' : 'Total Qty'}</span>
                    <span className="font-medium text-gray-800">
                      {purchaseItems.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  </div>
                </div>

                {/* Total */}
                <div className="mb-4">
                  <div className="flex justify-between">
                    <span className="text-sm font-bold text-gray-700">{isAr ? 'الإجمالي' : 'Total'}</span>
                    <span className="text-lg font-bold text-green-600">{formatPrice(purchaseTotal, lang)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <button
                    onClick={handleSavePurchase}
                    disabled={purchaseItems.length === 0 || createPurchaseMutation.isPending}
                    className="w-full rounded bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    <Save className="inline h-4 w-4 ml-1" />
                    {isAr ? 'تسجيل المشتريات' : 'Record Purchase'}
                  </button>
                  <button
                    onClick={resetPurchaseForm}
                    className="w-full rounded border border-gray-400 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Details Modal */}
      {selectedPurchase && (
        <Modal
          open
          onClose={() => setSelectedPurchase(null)}
          title={isAr ? `تفاصيل المشتريات #${selectedPurchase._id.slice(-6)}` : `Purchase #${selectedPurchase._id.slice(-6)}`}
          size="lg"
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500">{isAr ? 'الصنف' : 'Product'}</p>
                <p className="font-medium">{selectedPurchase.productName}</p>
              </div>
              <div>
                <p className="text-gray-500">{isAr ? 'المورد' : 'Supplier'}</p>
                <p className="font-medium">{selectedPurchase.supplier || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">{isAr ? 'التاريخ' : 'Date'}</p>
                <p className="font-medium">
                  {new Date(selectedPurchase.purchaseDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}
                </p>
              </div>
              <div>
                <p className="text-gray-500">{isAr ? 'الكمية' : 'Quantity'}</p>
                <p className="font-medium">{selectedPurchase.quantity}</p>
              </div>
              <div>
                <p className="text-gray-500">{isAr ? 'سعر الوحدة' : 'Unit Cost'}</p>
                <p className="font-medium">{formatPrice(selectedPurchase.unitCost, lang)}</p>
              </div>
              <div>
                <p className="text-gray-500">{isAr ? 'الإجمالي' : 'Total'}</p>
                <p className="text-lg font-bold text-green-600">{formatPrice(selectedPurchase.totalCost, lang)}</p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
