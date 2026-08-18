import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Eye, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { adminCancelOrder, adminListOrders, adminMarkComplimentary, updateOrderStatus } from '@/api/admin';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog, PageHeader, Pagination, SearchBox, StatusBadge, TableWrap, Td, Th } from '@/components/admin/primitives';
import type { Order, OrderStatus } from '@/types';
import { formatPrice } from '@/lib/utils';

type AdminOrder = Omit<Order, 'user'> & {
  user: string | { fullName: string; email: string; phone: string };
};

const TERMINAL: OrderStatus[] = ['cancelled', 'refunded', 'complimentary'];

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ['preparing'],
  preparing: ['on_delivery'],
  on_delivery: ['completed'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
  complimentary: [],
};

export function AdminOrdersPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [complimentaryTarget, setComplimentaryTarget] = useState<AdminOrder | null>(null);
  const [complimentaryReason, setComplimentaryReason] = useState('');

  const orders = useQuery({
    queryKey: ['admin', 'orders', { page, q: search, status }],
    queryFn: () => adminListOrders({ page, limit: 15, q: search, status }),
  });

  const invalidateAll = (): Promise<unknown> =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'day'] }),
    ]);

  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: OrderStatus }) => updateOrderStatus(id, next),
    onSuccess: (order) => {
      toast.success(t('admin.saved'));
      void invalidateAll();
      setSelected(order as AdminOrder);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminCancelOrder(id, reason),
    onSuccess: (order) => {
      toast.success(t('admin.orderCancelled'));
      void invalidateAll();
      setSelected(order as AdminOrder);
      setCancelTarget(null);
      setCancelReason('');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const complimentaryMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminMarkComplimentary(id, reason),
    onSuccess: (order) => {
      toast.success(t('admin.orderMarkedComplimentary'));
      void invalidateAll();
      setSelected(order as AdminOrder);
      setComplimentaryTarget(null);
      setComplimentaryReason('');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const fmtDate = (iso: string): string =>
    new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  const itemName = (item: { name: string; nameEn?: string }): string => (lang === 'ar' ? item.name : (item.nameEn ?? item.name));

  const cancelNote = selected
    ? [...selected.statusHistory].reverse().find((h) => h.status === 'cancelled' && h.reason)
    : undefined;
  const complimentaryNote = selected
    ? [...selected.statusHistory].reverse().find((h) => h.status === 'complimentary' && h.reason)
    : undefined;
  const adjustedBy = selected?.adjustedBy;
  const adjustedByName = typeof adjustedBy === 'object' && adjustedBy ? adjustedBy.fullName : '';

  return (
    <div>
      <PageHeader title={t('admin.nav.orders')} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={t('admin.searchPlaceholder')} />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 w-44">
          <option value="">{t('admin.allStatuses')}</option>
          <option value="pending">{t('admin.status.pending')}</option>
          <option value="preparing">{t('admin.status.preparing')}</option>
          <option value="on_delivery">{t('admin.status.on_delivery')}</option>
          <option value="completed">{t('admin.status.completed')}</option>
          <option value="cancelled">{t('admin.status.cancelled')}</option>
          <option value="refunded">{t('admin.status.refunded')}</option>
          <option value="complimentary">{t('admin.status.complimentary')}</option>
        </Select>
      </div>

      {orders.isLoading ? (
        <Skeleton className="h-96" />
      ) : orders.data && orders.data.items.length > 0 ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>{t('admin.nav.orders')}</Th>
                <Th>{t('admin.customer')}</Th>
                <Th>{t('admin.phone')}</Th>
                <Th>{t('admin.total')}</Th>
                <Th>{t('admin.orderItems')}</Th>
                <Th>{t('admin.date')}</Th>
                <Th>{t('admin.statusChange')}</Th>
                <Th className="text-end">{t('admin.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {(orders.data.items as AdminOrder[]).map((o) => (
                <tr key={o._id} className="transition-colors hover:bg-night-800/40">
                  <Td className="font-bold text-night-50">{o.orderNo}</Td>
                  <Td>
                    <p className="font-semibold text-night-100">{o.customerName}</p>
                    <p className="text-xs text-night-500">
                      {typeof o.user === 'object'
                        ? lang === 'ar'
                          ? o.user.fullName
                          : o.user.email
                        : ''}
                    </p>
                  </Td>
                  <Td dir="ltr">{o.phone}</Td>
                  <Td className="font-bold text-night-50">{formatPrice(o.total, lang)}</Td>
                  <Td>{o.items.reduce((sum, i) => sum + i.qty, 0)}</Td>
                  <Td className="text-xs text-night-500">{fmtDate(o.createdAt)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={o.status} />
                      {!TERMINAL.includes(o.status) ? (
                        <Select
                          value=""
                          onChange={(e) => statusMutation.mutate({ id: o._id, next: e.target.value as OrderStatus })}
                          disabled={statusMutation.isPending}
                          className="h-8 w-32"
                          aria-label={t('admin.statusChange')}
                        >
                          <option value="">{t('admin.statusChange')}…</option>
                          {NEXT_STATUSES[o.status].map((s) => (
                            <option key={s} value={s}>
                              {t(`admin.status.${s}`)}
                            </option>
                          ))}
                        </Select>
                      ) : null}
                    </div>
                  </Td>
                  <Td className="text-end">
                    <Button variant="ghost" size="icon" onClick={() => setSelected(o)} aria-label={t('common.viewAll')}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={orders.data.page} pages={orders.data.pages} onPage={setPage} />
        </>
      ) : (
        <Card>
          <CardContent className="py-14">
            <EmptyState title={t('admin.emptyList')} hint={t('admin.emptyListHint')} />
          </CardContent>
        </Card>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.orderNo ?? ''} size="lg">
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <StatusBadge status={selected.status} />
                {selected.isComplimentary ? <StatusBadge status="complimentary" /> : null}
              </div>
              {!TERMINAL.includes(selected.status) ? (
                <div className="flex flex-wrap gap-2">
                  {NEXT_STATUSES[selected.status].map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant={next === 'refunded' ? 'outline' : 'primary'}
                      className={next === 'refunded' ? 'border-slate-500/40 text-slate-300' : ''}
                      loading={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: selected._id, next })}
                    >
                      {next === 'refunded' ? t('admin.refundOrder') : t(`admin.status.${next}`)}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/40 text-red-400"
                    loading={cancelMutation.isPending}
                    onClick={() => { setCancelTarget(selected); setCancelReason(''); }}
                  >
                    <Ban className="h-4 w-4" />
                    {t('admin.cancelOrder')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gold-500/40 text-gold-400"
                    loading={complimentaryMutation.isPending}
                    onClick={() => { setComplimentaryTarget(selected); setComplimentaryReason(''); }}
                  >
                    <Gift className="h-4 w-4" />
                    {t('admin.markComplimentary')}
                  </Button>
                </div>
              ) : null}
            </div>

            {cancelNote ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {t('admin.cancelReasonLabel')}: {cancelNote.reason}
              </div>
            ) : null}
            {complimentaryNote ? (
              <div className="rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-sm text-gold-300">
                {t('admin.complimentaryReasonLabel')}: {complimentaryNote.reason}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-night-800 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-night-500">{t('admin.customer')}</p>
                <p className="mt-2 font-bold text-night-50">{selected.customerName}</p>
                <p dir="ltr" className="text-sm text-night-400">{selected.phone}</p>
                {selected.payment ? (
                  <p className="mt-1 text-sm capitalize text-night-400">
                    {selected.payment.method} · {formatPrice(selected.payment.amount, lang)}
                  </p>
                ) : null}
              </div>
              <div className="rounded-xl border border-night-800 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-night-500">{t('admin.category')}</p>
                <p className="mt-2 text-sm text-night-200">
                  {selected.deliveryAddress.city
                    ? [selected.deliveryAddress.city, selected.deliveryAddress.street, selected.deliveryAddress.building]
                        .filter(Boolean)
                        .join(' — ')
                    : '—'}
                </p>
                {selected.notes ? <p className="mt-1 text-sm text-night-500">{selected.notes}</p> : null}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-night-500">{t('admin.orderItems')}</p>
              <div className="space-y-2">
                {selected.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-night-800 px-4 py-3 text-sm">
                    <span className="font-semibold text-night-100">
                      {item.qty} × {itemName(item)}
                      {item.size ? <span className="text-night-500"> ({item.size})</span> : null}
                      {item.extras?.length ? (
                        <span className="block text-xs text-night-500">{item.extras.map((e) => e.name).join(', ')}</span>
                      ) : null}
                    </span>
                    <span className="font-bold text-night-50">{formatPrice(item.lineTotal, lang)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-night-800 px-4 py-3">
              <div className="space-y-1 text-sm">
                <p className="text-night-400">
                  {t('common.min')}: <span className="font-bold text-night-100">{formatPrice(selected.subtotal, lang)}</span>
                </p>
                <p className="text-night-400">
                  {t('admin.deliveryFee')}: <span className="font-bold text-night-100">{formatPrice(selected.deliveryFee, lang)}</span>
                </p>
                {selected.couponCode ? (
                  <p className="text-night-400">
                    {selected.couponCode}: <span className="font-bold text-emerald-400">−{formatPrice(selected.discount, lang)}</span>
                  </p>
                ) : null}
                {selected.isComplimentary ? (
                  <>
                    <p className="text-night-400">
                      {t('admin.adjustment')}: <span className="font-bold text-gold-400">−{formatPrice(selected.adjustmentAmount, lang)}</span>
                    </p>
                    <p className="text-night-500">
                      {t('admin.adjustedBy')}: {adjustedByName || (typeof selected.adjustedBy === 'string' ? selected.adjustedBy : '—')}
                      {selected.adjustedAt ? ` · ${fmtDate(selected.adjustedAt)}` : ''}
                    </p>
                    {selected.adjustmentReason ? (
                      <p className="text-night-500">
                        {t('admin.reason')}: {selected.adjustmentReason}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div className="text-end">
                <p className="text-xs text-night-500">{fmtDate(selected.createdAt)}</p>
                <p className="text-lg font-extrabold text-night-50">
                  {t('admin.total')}: {formatPrice(selected.total, lang)}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={t('admin.confirmCancelTitle')}
        message={t('admin.confirmCancelMessage', { orderNo: cancelTarget?.orderNo ?? '' })}
        confirmLabel={t('admin.cancelOrder')}
        confirmVariant="primary"
        reason={cancelReason}
        onReasonChange={setCancelReason}
        reasonLabel={t('admin.cancelReason')}
        reasonPlaceholder={t('admin.cancelReasonPlaceholder')}
        loading={cancelMutation.isPending}
        onConfirm={() => {
          if (cancelTarget) cancelMutation.mutate({ id: cancelTarget._id, reason: cancelReason });
        }}
      />

      <ConfirmDialog
        open={Boolean(complimentaryTarget)}
        onClose={() => setComplimentaryTarget(null)}
        title={t('admin.confirmComplimentaryTitle')}
        message={t('admin.confirmComplimentaryMessage', {
          amount: complimentaryTarget ? formatPrice(complimentaryTarget.subtotal + complimentaryTarget.deliveryFee - complimentaryTarget.discount, lang) : '',
        })}
        confirmLabel={t('admin.confirmComplimentary')}
        confirmVariant="gold"
        reason={complimentaryReason}
        onReasonChange={setComplimentaryReason}
        reasonLabel={t('admin.complimentaryReason')}
        reasonPlaceholder={t('admin.complimentaryReasonPlaceholder')}
        reasonRequired
        loading={complimentaryMutation.isPending}
        onConfirm={() => {
          if (complimentaryTarget) complimentaryMutation.mutate({ id: complimentaryTarget._id, reason: complimentaryReason });
        }}
      />
    </div>
  );
}
