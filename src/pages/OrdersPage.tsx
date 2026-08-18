import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cancelOrder, getMyOrders } from '@/api/orders';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge, Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { OrderReviewPanel } from '@/components/review/OrderReviewPanel';
import { formatPrice } from '@/lib/utils';

const statusTone: Record<string, 'brand' | 'gold' | 'success' | 'neutral'> = {
  pending: 'gold',
  preparing: 'brand',
  on_delivery: 'brand',
  completed: 'success',
  cancelled: 'neutral',
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
          <Skeleton key={i} className="h-32" />
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
              <Button variant="gold">{t('cart.browseMenu')}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-px py-12">
      <h1 className="mb-8 text-3xl font-extrabold text-night-50">{t('order.title')}</h1>
      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order._id}>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-night-800 pb-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-night-800 px-3 py-1.5 font-mono text-sm font-bold text-gold-400" dir="ltr">
                    {order.orderNo}
                  </span>
                  <Badge tone={statusTone[order.status as keyof typeof statusTone] ?? 'neutral'}>
                    {t(`order.status.${order.status}`)}
                  </Badge>
                </div>
                <div className="text-sm text-night-400">
                  {new Date(order.createdAt).toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-GB')}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                <div className="text-sm text-night-300">
                  {order.items.map((item) => `${item.name} × ${item.qty}`).join(', ')}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-extrabold text-brand-500">
                    {formatPrice(order.total, i18n.language)}
                  </span>
                  {order.status === 'pending' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(order._id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <XCircle className="h-4 w-4" />
                      {t('order.cancel')}
                    </Button>
                  ) : null}
                </div>
              </div>
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