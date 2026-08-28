import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Plus, ShoppingCart } from 'lucide-react';
import { adminSearchProducts, type AdminSearchProduct } from '@/api/admin';
import { formatPrice, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface ProductSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (product: AdminSearchProduct, sizeId: string | null, qty: number) => void;
}

export function ProductSearchDialog({ open, onClose, onSelect }: ProductSearchDialogProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminSearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedProduct, setSelectedProduct] = useState<AdminSearchProduct | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
      setSelectedProduct(null);
      setSelectedSizeId(null);
      setQuantity(1);
      setHighlightedIndex(-1);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await adminSearchProducts(query.trim());
        setResults(data);
        setHighlightedIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (selectedProduct) {
        setSelectedProduct(null);
        setSelectedSizeId(null);
        setQuantity(1);
      } else {
        onClose();
      }
      return;
    }

    if (selectedProduct) return; // Don't navigate when product is selected

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && results[highlightedIndex]) {
      e.preventDefault();
      setSelectedProduct(results[highlightedIndex]);
      // Auto-select first available size
      const firstSize = results[highlightedIndex].sizes?.find((s) => s.isAvailable);
      setSelectedSizeId(firstSize?._id ?? null);
    }
  }, [results, highlightedIndex, selectedProduct, onClose]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && resultsRef.current) {
      const items = resultsRef.current.querySelectorAll('[data-search-item]');
      items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleSelectProduct = (product: AdminSearchProduct) => {
    setSelectedProduct(product);
    const firstSize = product.sizes?.find((s) => s.isAvailable);
    setSelectedSizeId(firstSize?._id ?? null);
    setQuantity(1);
  };

  const handleAddToOrder = () => {
    if (!selectedProduct) return;
    onSelect(selectedProduct, selectedSizeId, quantity);
    onClose();
  };

  const productName = (p: AdminSearchProduct) => lang === 'ar' ? p.name : (p.nameEn || p.name);
  const categoryName = (p: AdminSearchProduct) => {
    if (!p.category) return '';
    return lang === 'ar' ? p.category.name : (p.category.nameEn || p.category.name);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-night-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={lang === 'ar' ? 'بحث عن منتج...' : 'Search products...'}
            className="w-full rounded-xl border border-night-700 bg-night-900 py-3 pl-10 pr-10 text-sm text-night-100 placeholder-night-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-night-500 hover:text-night-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        )}

        {/* Product Selected View */}
        {selectedProduct && !loading && (
          <div className="mt-3 rounded-xl border border-night-700 bg-night-900 p-4">
            <div className="mb-3 flex items-start gap-3">
              {selectedProduct.images?.[0] && (
                <img
                  src={selectedProduct.images[0]}
                  alt={productName(selectedProduct)}
                  className="h-16 w-16 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <h3 className="font-bold text-night-100">{productName(selectedProduct)}</h3>
                {categoryName(selectedProduct) && (
                  <p className="text-xs text-night-500">{categoryName(selectedProduct)}</p>
                )}
                <p className="mt-1 text-sm font-bold text-brand-400">
                  {formatPrice(selectedProduct.basePrice, lang)}
                </p>
              </div>
              <button
                onClick={() => { setSelectedProduct(null); setSelectedSizeId(null); }}
                className="text-night-500 hover:text-night-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Size Selection */}
            {selectedProduct.sizes && selectedProduct.sizes.length > 0 && (
              <div className="mb-3">
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-night-400">
                  {lang === 'ar' ? 'النوع / الوزن' : 'Variant / Weight'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.sizes.map((size) => (
                    <button
                      key={size._id}
                      disabled={!size.isAvailable}
                      onClick={() => setSelectedSizeId(size._id)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                        selectedSizeId === size._id
                          ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                          : size.isAvailable
                            ? 'border-night-700 text-night-300 hover:border-night-500'
                            : 'border-night-800 text-night-600 opacity-50',
                      )}
                    >
                      {lang === 'ar' ? size.name : (size.nameEn || size.name)}
                      {' — '}
                      {formatPrice(size.price, lang)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-3">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-night-400">
                {lang === 'ar' ? 'الكمية' : 'Quantity'}
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-night-700 text-night-300 hover:border-night-500"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                  className="w-16 rounded-lg border border-night-700 bg-night-800 px-2 py-1.5 text-center text-sm text-night-100 focus:border-brand-500 focus:outline-none"
                />
                <button
                  onClick={() => setQuantity(Math.min(99, quantity + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-night-700 text-night-300 hover:border-night-500"
                >
                  +
                </button>
              </div>
            </div>

            {/* Add Button */}
            <Button
              onClick={handleAddToOrder}
              className="w-full"
              size="lg"
            >
              <ShoppingCart className="h-4 w-4" />
              {lang === 'ar' ? 'إضافة للطلب' : 'Add to Order'}
            </Button>
          </div>
        )}

        {/* Search Results */}
        {!selectedProduct && !loading && results.length > 0 && (
          <div
            ref={resultsRef}
            className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-night-700 bg-night-900"
          >
            {results.map((product, idx) => (
              <button
                key={product._id}
                data-search-item
                onClick={() => handleSelectProduct(product)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                  idx === highlightedIndex ? 'bg-night-800' : 'hover:bg-night-800/50',
                  !product.isAvailable && 'opacity-50',
                )}
              >
                {product.images?.[0] && (
                  <img
                    src={product.images[0]}
                    alt={productName(product)}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-night-100">
                    {productName(product)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-night-500">
                    {categoryName(product) && <span>{categoryName(product)}</span>}
                    {product.sizes && product.sizes.length > 0 && (
                      <span>
                        {product.sizes.map((s) => lang === 'ar' ? s.name : (s.nameEn || s.name)).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-400">
                    {formatPrice(product.basePrice, lang)}
                  </p>
                  {!product.isAvailable && (
                    <p className="text-xs text-red-400">
                      {lang === 'ar' ? 'غير متاح' : 'Unavailable'}
                    </p>
                  )}
                </div>
                <Plus className="h-4 w-4 shrink-0 text-night-500" />
              </button>
            ))}
          </div>
        )}

        {/* No Results */}
        {!selectedProduct && !loading && query.trim() && results.length === 0 && (
          <div className="mt-3 py-6 text-center text-sm text-night-500">
            {lang === 'ar' ? 'لا توجد نتائج' : 'No products found'}
          </div>
        )}

        {/* Keyboard hint */}
        {!selectedProduct && !loading && results.length > 0 && (
          <div className="mt-2 flex items-center justify-center gap-4 text-xs text-night-600">
            <span>↑↓ {lang === 'ar' ? 'تنقل' : 'Navigate'}</span>
            <span>↵ {lang === 'ar' ? 'اختيار' : 'Select'}</span>
            <span>Esc {lang === 'ar' ? 'إغلاق' : 'Close'}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
