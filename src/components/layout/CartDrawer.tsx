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
import { cn, formatPrice } from '@/lib/utils';

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
          <div className="absolute inset-0 bg-night-950/80 backdrop-blur-sm" onClick={() => dispatch(setCartOpen(false))} />
          <motion.aside
            className="absolute inset-y-0 inset-e-0 flex w-full max-w-md flex-col border-s border-night-800 bg-night-900 shadow-2xl"
            initial={{ x: i18n.dir() === 'rtl' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: i18n.dir() === 'rtl' ? '100%' : '-100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
          >
            <div className="flex items-center justify-between border-b border-night-800 px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-night-50">
                <ShoppingBag className="h-5 w-5 text-brand-500" />
                {t('cart.title')}
              </h2>
              <button
                onClick={() => dispatch(setCartOpen(false))}
                className="rounded-lg p-1.5 text-night-400 hover:bg-night-800 hover:text-night-50"
                aria-label="close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6">
                <EmptyState
                  icon={<ShoppingBag className="h-14 w-14" />}
                  title={t('cart.empty')}
                  hint={t('cart.emptyHint')}
                  action={
                    <Button onClick={() => goTo('/menu')} variant="gold">
                      {t('cart.browseMenu')}
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  {lines.map((line, index) => (
                    <div key={`${line.productId}-${line.size ?? ''}`} className="flex gap-3 rounded-xl border border-night-800 bg-night-950 p-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-night-800">
                        {line.image ? (
                          <img src={line.image} alt={line.name} className="h-full w-full object-cover" />
                        ) : (
                          <ShoppingBag className="h-6 w-6 text-night-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-bold text-night-50">
                            {i18n.language === 'ar' ? line.name : line.nameEn || line.name}
                          </p>
                          <button
                            onClick={() => dispatch(removeLine(index))}
                            className="text-night-500 transition-colors hover:text-red-400"
                            aria-label={t('cart.remove')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {line.sizeName ? <p className="text-xs text-night-400">{line.sizeName}</p> : null}
                        {line.extras.length > 0 ? (
                          <p className="truncate text-xs text-night-500">
                            {line.extras.map((e) => e.name).join(' + ')}
                          </p>
                        ) : null}
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-1 rounded-lg border border-night-700">
                            <button
                              onClick={() => dispatch(updateQty({ index, qty: line.qty + 1 }))}
                              className="p-1.5 text-night-300 hover:text-brand-500"
                              aria-label="plus"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-6 text-center text-sm font-bold text-night-50">{line.qty}</span>
                            <button
                              onClick={() => dispatch(updateQty({ index, qty: line.qty - 1 }))}
                              className="p-1.5 text-night-300 hover:text-brand-500"
                              aria-label="minus"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="text-sm font-bold text-brand-500">
                            {formatPrice(line.unitPrice * line.qty, i18n.language)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-night-800 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-night-300">{t('cart.subtotal')}</span>
                    <span className="text-lg font-extrabold text-night-50">{formatPrice(subtotal, i18n.language)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={() => dispatch(clearCart())}
                    >
                      {t('cart.clear')}
                    </Button>
                    <Button
                      variant="gold"
                      className={cn('flex-2')}
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