/**
 * ProductSelect — Searchable product combobox
 *
 * A dropdown that shows all available products with search.
 * Supports Arabic + English search, partial matching, and
 * displays product info (name, category, stock).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Package, ChevronDown } from 'lucide-react';
import { adminSearchProducts, type AdminSearchProduct } from '@/api/admin';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/utils';

interface ProductSelectProps {
  value: AdminSearchProduct | null;
  onSelect: (product: AdminSearchProduct) => void;
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ProductSelect({ value, onSelect, onClear, placeholder, disabled, className }: ProductSelectProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search products when typing
  const searchResults = useQuery({
    queryKey: ['admin', 'productSelect', searchQuery],
    queryFn: () => adminSearchProducts(searchQuery),
    enabled: searchQuery.length >= 1 && isOpen,
  });

  // Load all products when dropdown opens (if no search query)
  const allProducts = useQuery({
    queryKey: ['admin', 'productSelect', 'all'],
    queryFn: () => adminSearchProducts(''),
    enabled: isOpen && searchQuery.length < 1,
  });

  const products = searchQuery.length >= 1
    ? (searchResults.data ?? [])
    : (allProducts.data ?? []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = useCallback((product: AdminSearchProduct) => {
    onSelect(product);
    setIsOpen(false);
    setSearchQuery('');
  }, [onSelect]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClear?.();
    setSearchQuery('');
  }, [onClear]);

  const productName = (p: AdminSearchProduct) => isAr ? p.name : (p.nameEn || p.name);

  const defaultPlaceholder = isAr ? 'اختر المنتج...' : 'Select product...';

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Selected product display or search input */}
      {value && !isOpen ? (
        <div
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-night-700 bg-night-900 px-4 py-3 transition-colors hover:border-night-500"
          onClick={() => { setIsOpen(true); setSearchQuery(''); }}
        >
          <Package className="h-4 w-4 shrink-0 text-brand-400" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-night-50">{productName(value)}</p>
            <div className="flex items-center gap-2 text-xs text-night-500">
              {value.basePrice > 0 && <span>{formatPrice(value.basePrice, lang)}</span>}
              {value.sizes && value.sizes.length > 0 && (
                <span>• {value.sizes.length} {isAr ? 'أوزان' : 'variants'}</span>
              )}
            </div>
          </div>
          {onClear && (
            <button onClick={handleClear} className="text-night-500 hover:text-night-300">
              <X className="h-4 w-4" />
            </button>
          )}
          <ChevronDown className="h-4 w-4 text-night-500" />
        </div>
      ) : (
        <div
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 transition-colors',
            isOpen
              ? 'border-brand-500 bg-night-900'
              : 'border-night-700 bg-night-900 hover:border-night-500',
          )}
          onClick={() => { if (!disabled) setIsOpen(true); }}
        >
          <Search className="h-4 w-4 shrink-0 text-night-500" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={placeholder ?? defaultPlaceholder}
            disabled={disabled}
            className="flex-1 bg-transparent text-sm text-night-100 outline-none placeholder:text-night-500"
            readOnly={!isOpen}
          />
          <ChevronDown className={cn('h-4 w-4 text-night-500 transition-transform', isOpen && 'rotate-180')} />
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-night-700 bg-night-900 shadow-xl">
          {/* Loading indicator */}
          {(searchResults.isFetching || allProducts.isFetching) && (
            <div className="flex items-center justify-center py-4 text-sm text-night-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <span className="ms-2">{isAr ? 'جاري البحث...' : 'Searching...'}</span>
            </div>
          )}

          {/* Results */}
          {!searchResults.isFetching && !allProducts.isFetching && products.length === 0 && (
            <div className="py-4 text-center text-sm text-night-500">
              {isAr ? 'لم يتم العثور على منتجات' : 'No products found'}
            </div>
          )}

          {!searchResults.isFetching && !allProducts.isFetching && products.map((product) => (
            <button
              key={product._id}
              onClick={() => handleSelect(product)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-night-800/50"
            >
              <Package className="h-4 w-4 shrink-0 text-night-500" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-night-100">
                  {productName(product)}
                </p>
                <div className="flex items-center gap-2 text-xs text-night-500">
                  {product.basePrice > 0 && (
                    <span className="font-semibold text-brand-400">{formatPrice(product.basePrice, lang)}</span>
                  )}
                  {product.sizes && product.sizes.length > 0 && (
                    <span>
                      {product.sizes.map((s) => s.name).join(' • ')}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
