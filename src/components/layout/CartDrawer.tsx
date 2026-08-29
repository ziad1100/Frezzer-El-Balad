import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks';
import {
  clearCart,
  removeLine,
  selectSubtotal,
  updateQty,
} from '@/store/slices/cartSlice';
import { setCartOpen } from '@/store/slices/uiSlice';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { formatPrice } from '@/lib/utils';

export function CartDrawer() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const open = useAppSelector((state) => state.ui.cartOpen);
  const lines = useAppSelector((state) => state.cart.lines);
  const subtotal = useAppSelector(selectSubtotal);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const goTo = (path: string): void => {
    dispatch(setCartOpen(false));
    navigate(path);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => dispatch(setCartOpen(false))} />
          <motion.aside
            className="absolute inset-y-0 inset-e-0 flex w-full max-w-md flex-col border-s border-[var(--tw-border-strong)] bg-[var(--tw-surface)] shadow-2xl"
            initial={{ x: i18n.dir() === 'rtl' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: i18n.dir() === 'rtl' ? '100%' : '-100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--tw-border)] px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  <ShoppingBag className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[var(--tw-text)]">{t('cart.title')}</h2>
                  <p className="text-xs text-[var(--tw-text-muted)]">
                    {lines.length} {lines.length === 1 ? (i18n.language === 'ar' ? 'منتج' : 'item') : (i18n.language === 'ar' ? 'منتجات' : 'items')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => dispatch(setCartOpen(false))}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
                aria-label="close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6">
                <EmptyState
                  icon={<ShoppingBag className="h-12 w-12" />}
                  title={t('cart.empty')}
                  hint={t('cart.emptyHint')}
                  action={
                    <Button onClick={() => goTo('/menu')} variant="fresh">
                      {t('cart.browseMenu')}
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                {/* Items */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-2.5">
                    {lines.map((line, index) => (
                      <div
                        key={`${line.productId}-${line.size ?? ''}`}
                        className="group flex gap-3 rounded-xl border border-[var(--tw-border)] bg-[var(--tw-card-bg)] p-3 transition-colors hover:border-[var(--tw-border-strong)]"
                      >
                        {/* Image */}
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--tw-surface-alt)]">
                          {line.image ? (
                            <img src={line.image} alt={line.name} className="h-full w-full object-cover" />
                          ) : (
                            <ShoppingBag className="h-6 w-6 text-[var(--tw-text-muted)]" />
                          )}
                        </div>

                        {/* Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--tw-text)]">
                                {i18n.language === 'ar' ? line.name : line.nameEn || line.name}
                              </p>
                              {line.sizeName ? (
                                <p className="mt-0.5 text-xs text-[var(--tw-text-muted)]">{line.sizeName}</p>
                              ) : null}
                              {line.extras.length > 0 ? (
                                <p className="mt-0.5 truncate text-xs text-[var(--tw-text-muted)]">
                                  {line.extras.map((e) => e.name).join(' + ')}
                                </p>
                              ) : null}
                            </div>
                            <button
                              onClick={() => dispatch(removeLine(index))}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--tw-text-muted)] opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                              aria-label={t('cart.remove')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Price + Qty */}
                          <div className="mt-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-0.5 rounded-lg border border-[var(--tw-border-strong)] bg-[var(--tw-surface)]">
                              <button
                                onClick={() => dispatch(updateQty({ index, qty: line.qty - 1 }))}
                                className="flex h-7 w-7 items-center justify-center rounded-l-lg text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
                                aria-label="minus"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="min-w-7 text-center text-sm font-bold tabular-nums text-[var(--tw-text)]">{line.qty}</span>
                              <button
                                onClick={() => dispatch(updateQty({ index, qty: line.qty + 1 }))}
                                className="flex h-7 w-7 items-center justify-center rounded-r-lg text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
                                aria-label="plus"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <p className="text-sm font-extrabold text-brand-500">
                              {formatPrice(line.unitPrice * line.qty, i18n.language)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-[var(--tw-border)] bg-[var(--tw-surface)] px-5 py-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm text-[var(--tw-text-muted)]">{t('cart.subtotal')}</span>
                    <span className="text-lg font-extrabold text-[var(--tw-text)]">{formatPrice(subtotal, i18n.language)}</span>
                  </div>
                  <div className="flex gap-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-3"
                      onClick={() => dispatch(clearCart())}
                    >
                      {t('cart.clear')}
                    </Button>
                    <Button
                      variant="fresh"
                      className="flex-[2]"
                      onClick={() => goTo('/checkout')}
                    >
                      {t('cart.checkout')}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
