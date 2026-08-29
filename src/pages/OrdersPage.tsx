import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, XCircle, Calendar, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { cancelOrder, getMyOrders } from '@/api/orders';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge, Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { OrderReviewPanel } from '@/components/review/OrderReviewPanel';
import { formatPrice } from '@/lib/utils';

const statusTone: Record<string, 'brand' | 'gold' | 'success' | 'neutral'> = {
  pending: 'gold',
  confirmed: 'brand',
  preparing: 'brand',
  ready_for_delivery: 'brand',
  on_delivery: 'brand',
  completed: 'success',
  cancelled: 'neutral',
  delivery_failed: 'neutral',
  refunded: 'neutral',
  complimentary: 'gold',
};

export function OrdersPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'mine'],
    queryFn: () => getMyOrders(),
  });
  const orders = data?.items ?? [];

  const cancelMutation = useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => {
      toast.success(t('order.cancel'));
      void queryClient.invalidateQueries({ queryKey: ['orders', 'mine'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading) {
    return (
      <div className="container-px space-y-4 py-12">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
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
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[var(--tw-text)]">{t('order.title')}</h1>
        <p className="mt-1 text-sm text-[var(--tw-text-muted)]">
          {i18n.language === 'ar' ? `${orders.length} طلب` : `${orders.length} orders`}
        </p>
      </div>

      <div className="space-y-3">
        {orders.map((order) => (
          <Card key={order._id}>
            <CardContent className="p-4">
              {/* Order Header */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-brand-500/10 px-2.5 py-1 font-mono text-sm font-bold text-brand-500" dir="ltr">
                    #{order.orderNo}
                  </span>
                  <Badge tone={statusTone[order.status as keyof typeof statusTone] ?? 'neutral'}>
                    {t(`order.status.${order.status}`)}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--tw-text-muted)]">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(order.createdAt).toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-GB')}
                </div>
              </div>

              {/* Items */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {order.items.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--tw-surface-alt)] px-2 py-1 text-xs text-[var(--tw-text-muted)]"
                  >
                    <ShoppingBag className="h-3 w-3" />
                    {item.name} × {item.qty}
                  </span>
                ))}
              </div>

              {/* Footer: Price + Actions */}
              <div className="flex items-center justify-between border-t border-[var(--tw-border)] pt-3">
                <span className="text-lg font-extrabold text-brand-500">
                  {formatPrice(order.total, i18n.language)}
                </span>
                <div className="flex items-center gap-2">
                  {order.status === 'pending' || order.status === 'confirmed' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(order._id)}
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <XCircle className="h-4 w-4" />
                      {t('order.cancel')}
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Review Panel */}
              {order.status === 'completed' ? (
                <OrderReviewPanel orderId={order._id} orderNo={order.orderNo} />
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
