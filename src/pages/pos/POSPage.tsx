import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { searchProductByBarcode, adminSearchProducts, type AdminSearchProduct } from '@/api/admin';
import { createOrder } from '@/api/orders';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAppSelector } from '@/hooks';
import { cn, formatPrice } from '@/lib/utils';

interface CartItem {
  productId: string;
  name: string;
  nameEn: string;
  size: string | null;
  sizeName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  stockQuantity?: number;
  trackInventory?: boolean;
}

export function POSPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';
  const queryClient = useQueryClient();
  const user = useAppSelector((state) => state.auth.user);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminSearchProduct[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus barcode input on mount
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  // Barcode search mutation
  const barcodeMutation = useMutation({
    mutationFn: searchProductByBarcode,
    onSuccess: (product) => {
      addToCart(product);
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

  // Add product to cart
  const addToCart = (product: AdminSearchProduct) => {
    const existingIndex = cart.findIndex(
      (item) => item.productId === product._id && item.size === null
    );

    if (existingIndex >= 0) {
      // Increase quantity
      const newCart = [...cart];
      const item = newCart[existingIndex];
      const newQty = item.qty + 1;
      
      // Check stock
      if (item.trackInventory && item.stockQuantity !== undefined && newQty > item.stockQuantity) {
        toast.error(isAr ? 'الكمية المطلوبة تتجاوز المخزون المتاح' : 'Requested quantity exceeds available stock');
        return;
      }
      
      item.qty = newQty;
      item.lineTotal = item.unitPrice * newQty;
      setCart(newCart);
    } else {
      // Add new item
      const productPrice = product.sizes?.[0]?.price ?? product.basePrice;
      const stockQty = product.trackInventory ? product.stockQuantity : undefined;
      
      if (product.trackInventory && stockQty !== undefined && stockQty <= 0) {
        toast.error(isAr ? 'المنتج غير متوفر حالياً' : 'Product is currently out of stock');
        return;
      }
      
      setCart([
        ...cart,
        {
          productId: product._id,
          name: product.name,
          nameEn: product.nameEn || product.name,
          size: product.sizes?.[0]?._id ?? null,
          sizeName: product.sizes?.[0] ? (isAr ? product.sizes[0].name : (product.sizes[0].nameEn || product.sizes[0].name)) : '',
          qty: 1,
          unitPrice: productPrice,
          lineTotal: productPrice,
          stockQuantity: stockQty,
          trackInventory: product.trackInventory,
        },
      ]);
    }
    
    toast.success(isAr ? 'تمت إضافة المنتج' : 'Product added');
  };

  // Update quantity
  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    const newQty = item.qty + delta;
    
    if (newQty <= 0) {
      newCart.splice(index, 1);
    } else {
      // Check stock
      if (item.trackInventory && item.stockQuantity !== undefined && newQty > item.stockQuantity) {
        toast.error(isAr ? 'الكمية المطلوبة تتجاوز المخزون المتاح' : 'Requested quantity exceeds available stock');
        return;
      }
      
      item.qty = newQty;
      item.lineTotal = item.unitPrice * newQty;
    }
    
    setCart(newCart);
  };

  // Set quantity directly
  const setQuantity = (index: number, qty: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    
    if (qty <= 0) {
      newCart.splice(index, 1);
    } else {
      // Check stock
      if (item.trackInventory && item.stockQuantity !== undefined && qty > item.stockQuantity) {
        toast.error(isAr ? 'الكمية المطلوبة تتجاوز المخزون المتاح' : 'Requested quantity exceeds available stock');
        return;
      }
      
      item.qty = qty;
      item.lineTotal = item.unitPrice * qty;
    }
    
    setCart(newCart);
  };

  // Remove item from cart
  const removeItem = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
  };

  // Create order mutation
  const orderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      toast.success(isAr ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully');
      setCart([]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      barcodeInputRef.current?.focus();
    },
    onError: (error: Error) => {
      toast.error(error.message || (isAr ? 'فشل إنشاء الطلب' : 'Failed to create order'));
    },
  });

  // Handle F12 to confirm order
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

  // Confirm order
  const handleConfirmOrder = () => {
    if (cart.length === 0) {
      toast.error(isAr ? 'السلة فارغة' : 'Cart is empty');
      return;
    }

    orderMutation.mutate({
      items: cart.map((item) => ({
        product: item.productId,
        size: item.size,
        sizeName: item.sizeName,
        extras: [],
        qty: item.qty,
      })),
      paymentMethod: 'cash',
      customerName: 'عميل',
      phone: '01000000000',
      address: {
        label: 'Home',
        city: 'القاهرة',
        street: 'العنوان',
        building: '1',
      },
    });
  };

  // Suspend order (placeholder)
  const handleSuspendOrder = () => {
    toast.info(isAr ? 'تم تعليق الطلب مؤقتاً' : 'Order suspended');
  };

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
    <div className="flex h-full flex-col bg-white text-gray-800">
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Products Search & Cart */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Barcode Input Section */}
          <div className="border-b border-gray-300 bg-[#e8e8e0] p-3">
            <form onSubmit={handleBarcodeSubmit} className="flex gap-3">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--tw-text-muted)]" />
                <Input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder={isAr ? 'امسح الباركود أو اكتب الكود...' : 'Scan barcode or enter code...'}
                  className="flex-1 border-gray-400 bg-white pl-10 text-sm"
                  autoFocus
                />
              </div>
              <Button type="submit" variant="primary">
                <Search className="h-5 w-5" />
              </Button>
            </form>

            {/* Product Search */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tw-text-muted)]" />
              <Input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={isAr ? 'بحث بالاسم...' : 'Search by name...'}
                className="border-gray-400 bg-white pl-9 text-sm"
              />
              
              {/* Search Results Dropdown */}
              {showSearch && searchResults.length > 0 && (
                <div className="search-dropdown absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto border border-gray-400 bg-white shadow-lg">
                  {searchResults.map((product) => (
                    <button
                      key={product._id}
                      type="button"
                      onClick={() => {
                        addToCart(product);
                        setSearchQuery('');
                        setSearchResults([]);
                        setShowSearch(false);
                      }}
                      className="flex w-full items-center gap-3 border-b border-gray-200 p-2 text-left text-xs hover:bg-blue-50"
                    >
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100">
                          <Package className="h-4 w-4 text-gray-500" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">
                          {isAr ? product.name : (product.nameEn || product.name)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatPrice(product.basePrice, lang)}
                        </p>
                      </div>
                      {product.trackInventory && product.stockQuantity !== undefined && (
                        <span className={cn(
                          "text-sm font-medium",
                          product.stockQuantity <= 0 ? "text-red-500" : 
                          product.stockQuantity <= 10 ? "text-amber-500" : "text-emerald-500"
                        )}>
                          {product.stockQuantity}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart Table */}
          <div className="flex-1 overflow-auto bg-white">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <ShoppingCart className="h-12 w-12 text-gray-400" />
                <p className="mt-3 text-sm font-medium text-gray-500">
                  {isAr ? 'السلة فارغة' : 'Cart is empty'}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {isAr ? 'امسح الباركود أو ابحث عن منتج' : 'Scan barcode or search for a product'}
                </p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#d4d4c8]">
                  <tr className="border-b border-gray-300 text-right">
                    <th className="px-2 py-1.5 font-bold text-gray-700">{isAr ? 'الصنف' : 'Product'}</th>
                    <th className="px-2 py-1.5 font-bold text-gray-700">{isAr ? 'الكمية' : 'Qty'}</th>
                    <th className="px-2 py-1.5 font-bold text-gray-700">{isAr ? 'السعر' : 'Price'}</th>
                    <th className="px-2 py-1.5 font-bold text-gray-700">{isAr ? 'الإجمالي' : 'Total'}</th>
                    <th className="w-8 px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, index) => (
                    <tr
                      key={`${item.productId}-${item.size}`}
                      className={cn(
                        "border-b border-gray-200",
                        index % 2 === 0 ? "bg-white" : "bg-pink-50",
                        "hover:bg-blue-50"
                      )}
                    >
                      <td className="px-2 py-1.5">
                        <p className="font-medium text-gray-800">
                          {isAr ? item.name : item.nameEn}
                        </p>
                        {item.sizeName && (
                          <p className="text-[10px] text-gray-500">{item.sizeName}</p>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(index, -1)}
                            className="flex h-5 w-5 items-center justify-center border border-gray-300 bg-gray-100 hover:bg-gray-200"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => setQuantity(index, parseInt(e.target.value) || 0)}
                            className="w-12 border border-gray-300 bg-white px-1 py-0.5 text-center text-xs"
                            min="1"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(index, 1)}
                            className="flex h-5 w-5 items-center justify-center border border-gray-300 bg-gray-100 hover:bg-gray-200"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-gray-700">{formatPrice(item.unitPrice, lang)}</td>
                      <td className="px-2 py-1.5 font-medium text-gray-800">{formatPrice(item.lineTotal, lang)}</td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
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

        {/* Right Panel - Order Summary */}
        <div className="w-72 border-l border-gray-300 bg-[#e8e8e0] p-3">
          {/* Order Info */}
          <div className="mb-3 space-y-1 border-b border-gray-300 pb-3 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">{isAr ? 'رقم الطلب' : 'Order No'}</span>
              <span className="font-bold text-gray-800">#{Date.now().toString().slice(-6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{isAr ? 'المستخدم' : 'User'}</span>
              <span className="font-medium text-gray-800">{user?.fullName || 'Admin'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</span>
              <span className="font-medium text-gray-800">
                {new Date().toLocaleString(isAr ? 'ar-EG' : 'en-GB')}
              </span>
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2 border-b border-gray-300 pb-3">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">{isAr ? 'عدد الأصناف' : 'Items'}</span>
              <span className="font-medium text-gray-800">{itemCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-bold text-gray-700">{isAr ? 'الإجمالي' : 'Total'}</span>
              <span className="text-lg font-bold text-green-600">{formatPrice(subtotal, lang)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-3 space-y-2">
            <button
              onClick={handleConfirmOrder}
              disabled={cart.length === 0 || orderMutation.isPending}
              className="w-full rounded bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500"
            >
              <Check className="inline h-4 w-4 ml-1" />
              {isAr ? 'تأكيد (F12)' : 'Confirm (F12)'}
            </button>
            <button
              onClick={handleSuspendOrder}
              disabled={cart.length === 0}
              className="w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:bg-gray-200 disabled:text-gray-400"
            >
              {isAr ? 'تعليق (F9)' : 'Suspend (F9)'}
            </button>
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:text-gray-400"
            >
              <X className="inline h-3 w-3 ml-1" />
              {isAr ? 'تفريغ السلة' : 'Clear Cart'}
            </button>
          </div>
        </div>
      </div>


    </div>
  );
}
