/**
 * ProductSearch — Reusable autocomplete product search dropdown.
 *
 * Shared between Checkout (admin) and Menu (public) pages.
 * Uses a React Portal so the dropdown is never clipped by parent containers.
 *
 * Features:
 *  - Shows all available products when opened empty
 *  - Filters with partial, case-insensitive matching as the user types
 *  - Keyboard navigation (↑↓ Enter Escape)
 *  - Click-outside to close
 *  - Responsive — works on desktop, tablet and mobile
 *  - Portal-based dropdown — never clipped
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search, X, Package } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

/** Minimal product shape the dropdown needs. Both AdminSearchProduct
 *  and the public Product type satisfy this interface.               */
export interface SearchableProduct {
  _id: string;
  name: string;
  nameEn?: string;
  basePrice: number;
  images: string[];
  isAvailable: boolean;
  category?: { _id: string; name: string; nameEn?: string } | null;
  sizes?: Array<{
    _id?: string;
    name: string;
    nameEn?: string;
    price: number;
    isAvailable: boolean;
  }>;
}

export interface ProductSearchProps {
  /** Called when the user picks a product from the dropdown. */
  onSelect: (product: SearchableProduct) => void;
  /**
   * Async function that returns matching products for a given query.
   * When `query` is empty it should return all (or a broad set of) products.
   */
  searchFn: (query: string) => Promise<SearchableProduct[]>;
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Extra CSS classes for the wrapper. */
  className?: string;
  /** Auto-focus the input on mount. */
  autoFocus?: boolean;
  /** Called whenever the search query text changes (for external syncing). */
  onQueryChange?: (query: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ProductSearch({
  onSelect,
  searchFn,
  placeholder,
  className,
  autoFocus,
  onQueryChange,
}: ProductSearchProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';

  /* ---- local state ---- */
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<SearchableProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  /* ---- refs ---- */
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  /* ---- helpers ---- */
  const productName = (p: SearchableProduct) =>
    isAr ? p.name : p.nameEn || p.name;

  const categoryName = (p: SearchableProduct) => {
    if (!p.category) return '';
    return isAr ? p.category.name : p.category.nameEn || p.category.name;
  };

  /* ---- dropdown positioning (portal) ---- */
  const updatePosition = useCallback(() => {
    if (containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: r.bottom + window.scrollY + 4,
        left: r.left + window.scrollX,
        width: Math.max(r.width, 260),
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, updatePosition]);

  /* ---- search / debounce ---- */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!isOpen) return;

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchFn(query.trim());
        setProducts(data);
        setHighlightedIndex(-1);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen, searchFn]);

  /* ---- click outside ---- */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- focus on open ---- */
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  /* ---- reset highlight when list changes ---- */
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [products.length, query]);

  /* ---- scroll highlighted into view ---- */
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  /* ---- close helper ---- */
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setProducts([]);
    setHighlightedIndex(-1);
  }, []);

  /* ---- selection ---- */
  const handleSelect = useCallback(
    (product: SearchableProduct) => {
      onSelect(product);
      close();
    },
    [onSelect, close],
  );

  /* ---- keyboard ---- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((i) => (i < products.length - 1 ? i + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((i) => (i > 0 ? i - 1 : products.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && products[highlightedIndex]) {
            handleSelect(products[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    },
    [isOpen, products, highlightedIndex, handleSelect, close],
  );

  /* ---- default placeholder ---- */
  const ph =
    placeholder ?? (isAr ? 'بحث عن منتج...' : 'Search products...');

  /* ---- dropdown portal ---- */
  const dropdown = isOpen
    ? createPortal(
        <div
          ref={listRef}
          className="fixed z-[9999] max-h-80 overflow-y-auto rounded-xl border border-night-700 bg-night-900 shadow-2xl"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
          }}
          role="listbox"
        >
          {/* loading */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-night-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              {isAr ? 'جاري البحث...' : 'Searching...'}
            </div>
          )}

          {/* empty */}
          {!loading && query.trim() && products.length === 0 && (
            <div className="py-6 text-center text-sm text-night-500">
              {isAr ? 'لا توجد نتائج' : 'No products found'}
            </div>
          )}

          {/* results */}
          {!loading &&
            products.map((product, idx) => (
              <button
                key={product._id}
                type="button"
                onClick={() => handleSelect(product)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                  highlightedIndex === idx
                    ? 'bg-brand-500/15'
                    : 'hover:bg-night-800/50',
                  !product.isAvailable && 'opacity-50',
                )}
                role="option"
                aria-selected={highlightedIndex === idx}
              >
                {product.images?.[0] ? (
                  <img
                    src={product.images[0]}
                    alt={productName(product)}
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <Package className="h-5 w-5 shrink-0 text-night-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-night-100">
                    {productName(product)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-night-500">
                    {categoryName(product) && (
                      <span>{categoryName(product)}</span>
                    )}
                    {product.sizes && product.sizes.length > 0 && (
                      <span>
                        {product.sizes
                          .map((s) => (isAr ? s.name : s.nameEn || s.name))
                          .join(' • ')}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold text-brand-400">
                  {formatPrice(product.basePrice, lang)}
                </span>
              </button>
            ))}

          {/* keyboard hints */}
          {!loading && products.length > 0 && (
            <div className="flex items-center justify-center gap-4 border-t border-night-800 px-4 py-1.5 text-[11px] text-night-600">
              <span>↑↓ {isAr ? 'تنقل' : 'Navigate'}</span>
              <span>↵ {isAr ? 'اختيار' : 'Select'}</span>
              <span>Esc {isAr ? 'إغلاق' : 'Close'}</span>
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-night-500" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onQueryChange?.(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={ph}
        autoFocus={autoFocus}
        className={cn(
          'w-full rounded-xl border bg-night-900 py-3 ps-10 pe-9 text-sm text-night-100 placeholder-night-500 outline-none transition-colors',
          isOpen
            ? 'border-brand-500 ring-1 ring-brand-500'
            : 'border-night-700 hover:border-night-500',
        )}
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            inputRef.current?.focus();
          }}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-night-500 hover:text-night-300"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {dropdown}
    </div>
  );
}
