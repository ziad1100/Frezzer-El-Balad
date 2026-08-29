import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, XCircle, Calendar, ShoppingBag, ChevronDown, ChevronUp, Clock, CheckCircle2, Truck, AlertCircle, Hash, StickyNote, Tag, RefreshCw, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { cancelOrder, getMyOrders } from '@/api/orders';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/admin/primitives';
import { OrderReviewPanel } from '@/components/review/OrderReviewPanel';
import { cn, formatPrice } from '@/lib/utils';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready_for_delivery' | 'on_delivery' | 'completed' | 'cancelled' | 'delivery_failed' | 'refunded' | 'complimentary';

const statusConfig: Record<OrderStatus, { color: string; bg: string; border: string; accent: string; icon: typeof Package }> = {
  pending:           { color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  accent: 'border-l-amber-400', icon: Clock },
  confirmed:         { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   accent: 'border-l-blue-400',   icon: CheckCircle2 },
  preparing:         { color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/30',    accent: 'border-l-sky-400',    icon: Package },
  ready_for_delivery:{ color: 'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/30',   accent: 'border-l-teal-400',   icon: Package },
  on_delivery:       { color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30', accent: 'border-l-violet-400', icon: Truck },
  completed:         { color: 'text-emerald-400',bg: 'bg-emerald-500/10',border: 'border-emerald-500/30',accent: 'border-l-emerald-400',icon: CheckCircle2 },
  cancelled:         { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    accent: 'border-l-red-400',    icon: XCircle },
  delivery_failed:   { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', accent: 'border-l-orange-400', icon: AlertCircle },
  refunded:          { color: 'text-[var(--tw-text-muted)]', bg: 'bg-[var(--tw-surface-alt)]', border: 'border-[var(--tw-border-strong)]', accent: 'border-l-[var(--tw-border-strong)]', icon: Package },
  complimentary:     { color: 'text-gold-400',   bg: 'bg-gold-500/10',   border: 'border-gold-500/30',   accent: 'border-l-gold-400',   icon: Package },
};

const PROGRESS_STEPS: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready_for_delivery', 'on_delivery', 'completed'];

function StatusProgress({ status }: { status: OrderStatus }) {
  const currentIdx = PROGRESS_STEPS.indexOf(status);
  const isTerminal = currentIdx < 0;

  return (
    <div className="hidden items-center gap-1.5 sm:flex" aria-label={`Progress: step ${currentIdx + 1} of ${PROGRESS_STEPS.length}`}>
      {PROGRESS_STEPS.map((step, idx) => {
        const isActive = idx <= currentIdx && !isTerminal;
        const isCurrent = idx === currentIdx && !isTerminal;
        return (
          <div key={step} className="flex items-center gap-1" aria-hidden="true">
            <div className={cn(
              'h-2 w-2 rounded-full transition-all duration-300',
              isActive ? 'bg-brand-500' : 'bg-[var(--tw-border-strong)]',
              isCurrent && 'scale-125 ring-2 ring-brand-500/30',
            )} />
            {idx < PROGRESS_STEPS.length - 1 && (
              <div className={cn(
                'h-0.5 w-3 rounded-full',
                idx < currentIdx && !isTerminal ? 'bg-brand-500' : 'bg-[var(--tw-border)]',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Status history timeline shown in expanded view */
function StatusTimeline({ history, lang }: { history: { status: string; at: string; reason?: string }[]; lang: string }) {
  if (!history || history.length === 0) return null;
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-[var(--tw-border)] p-4">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--tw-text-muted)]">
        {lang === 'ar' ? 'تتبع الحالة' : 'Status History'}
      </h4>
      <div className="space-y-0">
        {[...history].reverse().map((entry, idx) => {
          const config = statusConfig[entry.status as OrderStatus] ?? statusConfig.pending;
          const Icon = config.icon;
          return (
            <div key={idx} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Vertical line */}
              {idx < history.length - 1 && (
                <div className="absolute start-[11px] top-6 h-full w-px bg-[var(--tw-border)]" />
              )}
              {/* Dot */}
              <div className={cn(
                'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                idx === 0 ? config.bg : 'bg-[var(--tw-surface-alt)]',
              )}>
                <Icon className={cn('h-3 w-3', idx === 0 ? config.color : 'text-[var(--tw-text-subtle)]')} />
              </div>
              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-bold', idx === 0 ? config.color : 'text-[var(--tw-text-muted)]')}>
                    {t(`order.status.${entry.status}`)}
                  </span>
                  <span className="text-[10px] text-[var(--tw-text-subtle)]">
                    {new Date(entry.at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}
                  </span>
                </div>
                {entry.reason && (
                  <p className="mt-0.5 text-xs text-[var(--tw-text-muted)]">
                    {entry.reason}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OrdersPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const lang = i18n.language;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['orders', 'mine'],
    queryFn: () => getMyOrders(),
  });
  const orders = data?.items ?? [];

  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const cancelMutation = useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => {
      toast.success(t('order.cancel'));
      void queryClient.invalidateQueries({ queryKey: ['orders', 'mine'] });
      setCancelTarget(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const activeOrders = orders.filter((o) => !['completed', 'cancelled', 'delivery_failed', 'refunded', 'complimentary'].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === 'completed');

  if (isLoading) {
    return (
      <div className="container-px space-y-5 py-12">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="container-px py-24">
        <EmptyState
          icon={<Package className="h-14 w-14" />}
          title={t('order.empty')}
          hint={lang === 'ar' ? 'لم تطلب بعد؟ ابدأ بتصفح منتجاتنا المميزة!' : "Haven't ordered yet? Browse our premium products!"}
          action={
            <Link to="/menu">
              <Button variant="fresh">{t('cart.browseMenu')}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-px py-10">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--tw-text)]">{t('order.title')}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full border border-[var(--tw-border)] bg-[var(--tw-surface-alt)] px-3 py-1 text-xs font-semibold text-[var(--tw-text-muted)]">
              {orders.length} {lang === 'ar' ? 'إجمالي الطلبات' : 'total'}
            </span>
            {activeOrders.length > 0 && (
              <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-400">
                {activeOrders.length} {lang === 'ar' ? 'نشطة' : 'active'}
              </span>
            )}
            {completedOrders.length > 0 && (
              <span className="rounded-full border border-fresh-500/30 bg-fresh-500/10 px-3 py-1 text-xs font-semibold text-fresh-400">
                {completedOrders.length} {lang === 'ar' ? 'مكتملة' : 'done'}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          loading={isRefetching}
          className="shrink-0"
        >
          <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
          {lang === 'ar' ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.map((order) => {
          const status = order.status as OrderStatus;
          const config = statusConfig[status] ?? statusConfig.pending;
          const StatusIcon = config.icon;
          const isExpanded = expandedOrder === order._id;
          const isCancellable = status === 'pending' || status === 'confirmed';
          const isActive = !['completed', 'cancelled', 'delivery_failed', 'refunded', 'complimentary'].includes(status);
          const totalItems = order.items.reduce((sum, i) => sum + i.qty, 0);

          // Find cancellation reason from status history
          const cancelEntry = order.statusHistory?.find((h) => h.status === 'cancelled' && h.reason);

          return (
            <Card
              key={order._id}
              variant="interactive"
              className={cn('border-l-4', config.accent)}
            >
              <CardContent className="p-5">
                {/* Order Header */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500/10 px-3 py-1.5 font-mono text-sm font-bold text-brand-500" dir="ltr">
                      <Hash className="h-3.5 w-3.5" />
                      {order.orderNo}
                    </span>
                    <span className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold capitalize',
                      config.bg, config.color, config.border,
                    )}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {t(`order.status.${status}`)}
                    </span>
                    {isActive && <StatusProgress status={status} />}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--tw-text-muted)]">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(order.createdAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}
                  </div>
                </div>

                {/* Cancellation reason — shown inline for cancelled orders */}
                {cancelEntry?.reason && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">
                    <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                    <p className="text-xs text-red-400">{cancelEntry.reason}</p>
                  </div>
                )}

                {/* Items Preview */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {order.items.slice(0, isExpanded ? undefined : 4).map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--tw-border)] bg-[var(--tw-surface-alt)] px-3 py-1.5 text-xs font-medium text-[var(--tw-text-muted)]"
                    >
                      <ShoppingBag className="h-3 w-3 text-brand-400" />
                      <span className="text-[var(--tw-text)]">{item.name}</span>
                      <span className="text-[var(--tw-text-subtle)]">×{item.qty}</span>
                      {item.size && (
                        <span className="hidden sm:inline text-[var(--tw-text-subtle)]">({item.size})</span>
                      )}
                    </span>
                  ))}
                  {!isExpanded && order.items.length > 4 && (
                    <span className="inline-flex items-center rounded-xl border border-[var(--tw-border)] bg-[var(--tw-surface-alt)] px-3 py-1.5 text-xs font-medium text-[var(--tw-text-subtle)]">
                      +{order.items.length - 4} {lang === 'ar' ? 'أخرى' : 'more'}
                    </span>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mb-4 space-y-3 animate-slide-down">
                    {/* Full Items List */}
                    <div className="rounded-xl border border-[var(--tw-border)] bg-[var(--tw-surface-alt)]/50 p-4">
                      <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--tw-text-muted)]">
                        {lang === 'ar' ? 'تفاصيل الطلب' : 'Order Details'}
                      </h4>
                      <div className="space-y-2.5">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                              <span className="text-[var(--tw-text)] font-medium">{item.name}</span>
                              {item.size && <span className="shrink-0 text-[var(--tw-text-subtle)]">({item.size})</span>}
                              {item.extras && item.extras.length > 0 && (
                                <span className="truncate text-[var(--tw-text-subtle)]">
                                  + {item.extras.map((e) => e.name).join(', ')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ms-3">
                              <span className="text-[var(--tw-text-muted)]">×{item.qty}</span>
                              <span className="font-bold text-[var(--tw-text)]">
                                {formatPrice(item.lineTotal, lang)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Order Summary */}
                    <div className="rounded-xl border border-[var(--tw-border)] p-4">
                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--tw-text-muted)]">{lang === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
                          <span className="font-semibold text-[var(--tw-text)]">{formatPrice(order.subtotal, lang)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--tw-text-muted)]">{lang === 'ar' ? 'التوصيل' : 'Delivery'}</span>
                          <span className={cn('font-semibold', order.deliveryFee === 0 ? 'text-fresh-400' : 'text-[var(--tw-text)]')}>
                            {order.deliveryFee === 0 ? (lang === 'ar' ? 'مجاني' : 'Free') : formatPrice(order.deliveryFee, lang)}
                          </span>
                        </div>
                        {order.discount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-[var(--tw-text-muted)]">{lang === 'ar' ? 'الخصم' : 'Discount'}</span>
                            <span className="font-semibold text-fresh-400">-{formatPrice(order.discount, lang)}</span>
                          </div>
                        )}
                        {order.isComplimentary && (
                          <div className="flex justify-between">
                            <span className="text-[var(--tw-text-muted)]">{lang === 'ar' ? 'التسوية' : 'Adjustment'}</span>
                            <span className="font-semibold text-gold-400">-{formatPrice(order.adjustmentAmount, lang)}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-[var(--tw-border)] pt-2.5">
                          <span className="font-bold text-[var(--tw-text)]">{lang === 'ar' ? 'الإجمالي' : 'Total'}</span>
                          <span className="font-extrabold text-brand-500">{formatPrice(order.total, lang)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Address & Payment */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {order.deliveryAddress?.city && (
                        <div className="rounded-xl border border-[var(--tw-border)] p-4">
                          <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-[var(--tw-text-muted)]">
                            {lang === 'ar' ? 'عنوان التوصيل' : 'Delivery Address'}
                          </p>
                          <p className="text-sm text-[var(--tw-text)]">
                            {[order.deliveryAddress.city, order.deliveryAddress.street, order.deliveryAddress.building].filter(Boolean).join(' — ')}
                          </p>
                          {order.deliveryAddress.notes && (
                            <p className="mt-1 text-xs text-[var(--tw-text-subtle)]">
                              {order.deliveryAddress.notes}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="rounded-xl border border-[var(--tw-border)] p-4">
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-[var(--tw-text-muted)]">
                          {lang === 'ar' ? 'طريقة الدفع' : 'Payment'}
                        </p>
                        <p className="text-sm capitalize text-[var(--tw-text)]">
                          {order.payment?.method === 'cash' ? (lang === 'ar' ? 'الدفع عند الاستلام' : 'Cash on Delivery')
                            : order.payment?.method === 'card' ? (lang === 'ar' ? 'بطاقة ائتمان' : 'Credit Card')
                            : order.payment?.method === 'vodafone_cash' ? 'Vodafone Cash'
                            : order.payment?.method ?? '—'}
                        </p>
                      </div>
                    </div>

                    {/* Coupon & Notes */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {order.couponCode && (
                        <div className="flex items-center gap-2 rounded-xl border border-fresh-500/20 bg-fresh-500/5 px-4 py-3">
                          <Tag className="h-4 w-4 shrink-0 text-fresh-400" />
                          <div>
                            <p className="text-xs font-bold text-fresh-400">
                              {lang === 'ar' ? 'كود الخصم' : 'Coupon'}
                            </p>
                            <p className="text-sm font-semibold text-[var(--tw-text)]">{order.couponCode}</p>
                          </div>
                        </div>
                      )}
                      {order.notes && (
                        <div className="flex items-center gap-2 rounded-xl border border-[var(--tw-border)] px-4 py-3">
                          <StickyNote className="h-4 w-4 shrink-0 text-[var(--tw-text-subtle)]" />
                          <div>
                            <p className="text-xs font-bold text-[var(--tw-text-muted)]">
                              {lang === 'ar' ? 'ملاحظات' : 'Notes'}
                            </p>
                            <p className="text-sm text-[var(--tw-text)]">{order.notes}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status Timeline */}
                    {order.statusHistory && order.statusHistory.length > 0 && (
                      <StatusTimeline history={order.statusHistory} lang={lang} />
                    )}

                    {/* Review Panel */}
                    {status === 'completed' && (
                      <OrderReviewPanel orderId={order._id} orderNo={order.orderNo} />
                    )}
                  </div>
                )}

                {/* Footer: Price + Actions */}
                <div className="flex items-center justify-between border-t border-[var(--tw-border)] pt-4">
                  <div>
                    <span className="text-2xl font-extrabold text-brand-500">
                      {formatPrice(order.total, lang)}
                    </span>
                    <p className="text-xs text-[var(--tw-text-subtle)]">
                      {totalItems} {totalItems === 1 ? (lang === 'ar' ? 'منتج' : 'item') : (lang === 'ar' ? 'منتجات' : 'items')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedOrder(isExpanded ? null : order._id)}
                      className="text-[var(--tw-text-muted)] hover:text-brand-500"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          {lang === 'ar' ? 'إخفاء' : 'Less'}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          {lang === 'ar' ? 'التفاصيل' : 'Details'}
                        </>
                      )}
                    </Button>
                    {isCancellable && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => setCancelTarget(order._id)}
                      >
                        <XCircle className="h-4 w-4" />
                        {t('order.cancel')}
                      </Button>
                    )}
                    {status === 'completed' && (
                      <Link to="/menu">
                        <Button variant="fresh" size="sm">
                          <ShoppingBag className="h-4 w-4" />
                          {lang === 'ar' ? 'إعادة الطلب' : 'Reorder'}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={t('admin.confirmCancelTitle')}
        message={lang === 'ar' ? 'هل أنت متأكد من إلغاء هذا الطلب؟' : 'Are you sure you want to cancel this order?'}
        confirmLabel={t('order.cancel')}
        loading={cancelMutation.isPending}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget)}
      />
    </div>
  );
}
