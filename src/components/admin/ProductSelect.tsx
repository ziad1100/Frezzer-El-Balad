/**
 * ProductSelect — Searchable product combobox
 *
 * A custom searchable dropdown that shows all available products.
 * Supports Arabic + English search, partial matching, and
 * displays product info (name, category, stock).
 *
 * Uses a React Portal for the dropdown to prevent clipping in modals.
 * Fixes:
 * - Proper dropdown positioning (no clipping in modals)
 * - Responsive width (no compression)
 * - Keyboard navigation support
 * - Click outside to close
 * - Touch-friendly for mobile
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  const isLoading = searchQuery.length >= 1 ? searchResults.isFetching : allProducts.isFetching;

  // Calculate dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 280),
      });
    }
  }, []);

  // Update position when opening
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      // Update on scroll/resize
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [isOpen, updateDropdownPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check if click is inside container or dropdown
      if (containerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setIsOpen(false);
      setSearchQuery('');
      setHighlightedIndex(-1);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset highlight when products change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [products.length, searchQuery]);

  const handleSelect = useCallback((product: AdminSearchProduct) => {
    onSelect(product);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  }, [onSelect]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClear?.();
    setSearchQuery('');
    setHighlightedIndex(-1);
  }, [onClear]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
        setHighlightedIndex((prev) => (prev < products.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : products.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < products.length) {
          handleSelect(products[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
        break;
    }
  }, [isOpen, products, highlightedIndex, handleSelect]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const productName = (p: AdminSearchProduct) => isAr ? p.name : (p.nameEn || p.name);
  const defaultPlaceholder = isAr ? 'اختر المنتج...' : 'Select product...';

  const dropdown = isOpen ? createPortal(
    <div
      ref={listRef}
      className="fixed z-[9999] max-h-72 overflow-y-auto rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] shadow-2xl"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
      }}
      role="listbox"
    >
      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center py-4 text-sm text-[var(--tw-text-muted)]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <span className="ms-2">{isAr ? 'جاري البحث...' : 'Searching...'}</span>
        </div>
      )}

      {/* No results */}
      {!isLoading && products.length === 0 && (
        <div className="py-4 text-center text-sm text-[var(--tw-text-muted)]">
          {isAr ? 'لم يتم العثور على منتجات' : 'No products found'}
        </div>
      )}

      {/* Results */}
      {!isLoading && products.map((product, index) => (
        <button
          key={product._id}
          onClick={() => handleSelect(product)}
          className={cn(
            'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
            highlightedIndex === index
              ? 'bg-brand-500/20'
              : 'hover:bg-[var(--tw-surface-alt)]/50',
          )}
          role="option"
          aria-selected={highlightedIndex === index}
          type="button"
        >
          <Package className="h-4 w-4 shrink-0 text-[var(--tw-text-muted)]" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--tw-text)]">
              {productName(product)}
            </p>
            <div className="flex items-center gap-2 text-xs text-[var(--tw-text-muted)]">
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
    </div>,
    document.body,
  ) : null;

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      {/* Selected product display or search input */}
      {value && !isOpen ? (
        <div
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-4 py-3 transition-colors hover:border-[var(--tw-border-strong)]"
          onClick={() => { if (!disabled) setIsOpen(true); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(true); } }}
        >
          <Package className="h-4 w-4 shrink-0 text-brand-400" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--tw-text)]">{productName(value)}</p>
            <div className="flex items-center gap-2 text-xs text-[var(--tw-text-muted)]">
              {value.basePrice > 0 && <span>{formatPrice(value.basePrice, lang)}</span>}
              {value.sizes && value.sizes.length > 0 && (
                <span>• {value.sizes.length} {isAr ? 'أوزان' : 'variants'}</span>
              )}
            </div>
          </div>
          {onClear && (
            <button
              onClick={handleClear}
              className="text-[var(--tw-text-muted)] hover:text-[var(--tw-text-muted)] p-1"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <ChevronDown className="h-4 w-4 text-[var(--tw-text-muted)]" />
        </div>
      ) : (
        <div
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 transition-colors',
            isOpen
              ? 'border-brand-500 bg-[var(--tw-surface)]'
              : 'border-[var(--tw-border-strong)] bg-[var(--tw-surface)] hover:border-[var(--tw-border-strong)]',
          )}
          onClick={() => { if (!disabled) setIsOpen(true); }}
        >
          <Search className="h-4 w-4 shrink-0 text-[var(--tw-text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? defaultPlaceholder}
            disabled={disabled}
            className="flex-1 bg-transparent text-sm text-[var(--tw-text)] outline-none placeholder:text-[var(--tw-text-muted)]"
          />
          <ChevronDown className={cn('h-4 w-4 text-[var(--tw-text-muted)] transition-transform', isOpen && 'rotate-180')} />
        </div>
      )}

      {dropdown}
    </div>
  );
}