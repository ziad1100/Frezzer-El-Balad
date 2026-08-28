import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Eye, Gift, Printer, ChevronDown, FileDown, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { adminCancelOrder, adminListOrders, adminMarkComplimentary, getAdminSettings, updateOrderStatus } from '@/api/admin';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog, PageHeader, Pagination, SearchBox, StatusBadge, TableWrap, Td, Th } from '@/components/admin/primitives';
import type { Order, OrderStatus } from '@/types';
import { formatPrice } from '@/lib/utils';
import { buildReceiptFromOrder, type ReceiptData } from '@/lib/receiptFormatter';
import { renderReceiptToCanvas, canvasToDataURL, hasArabic } from '@/lib/receiptImage';
import { printReceipt, checkLocalAgent, printViaLocalAgent } from '@/lib/browserPrint';
import { markOrderPrinted, createPrintJob, getOrderPrintJobs } from '@/api/print';
import { PrintInvoiceDialog, type PrinterConfig } from '@/components/admin/PrintInvoiceDialog';
import { PdfPreviewDialog } from '@/components/admin/PdfPreviewDialog';

type AdminOrder = Omit<Order, 'user'> & {
  user: string | { fullName: string; email: string; phone: string };
};

const TERMINAL: OrderStatus[] = ['cancelled', 'delivery_failed', 'refunded', 'complimentary'];

/** Statuses that require a confirmation dialog before applying. */
const CONFIRM_STATUSES: OrderStatus[] = ['completed', 'cancelled', 'delivery_failed'];

/** Next allowed statuses per current status. */
const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready_for_delivery', 'cancelled'],
  ready_for_delivery: ['on_delivery', 'cancelled'],
  on_delivery: ['completed', 'delivery_failed', 'cancelled'],
  completed: ['refunded'],
  cancelled: [],
  delivery_failed: [],
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
  /** Confirmation dialog for irreversible status changes */
  const [confirmStatusTarget, setConfirmStatusTarget] = useState<{ order: AdminOrder; next: OrderStatus } | null>(null);

  const orders = useQuery({
    queryKey: ['admin', 'orders', { page, q: search, status }],
    queryFn: () => adminListOrders({ page, limit: 15, q: search, status }),
  });

  const settingsQuery = useQuery({ queryKey: ['admin', 'settings'], queryFn: getAdminSettings });
  const printers: PrinterConfig[] = useMemo(() => {
    const raw = settingsQuery.data?.printerConfig;
    if (Array.isArray(raw)) return raw as PrinterConfig[];
    if (raw && typeof raw === 'object' && 'name' in raw) {
      const legacy = raw as Record<string, unknown>;
      return [{
        id: 'default',
        name: String(legacy.name || 'Default Printer'),
        paperWidth: (legacy.paperWidth === '58' ? '58' : '80') as '58' | '80',
        connection: (legacy.connection || 'lan') as PrinterConfig['connection'],
        ipAddress: String(legacy.ipAddress || ''),
        port: String(legacy.port || '9100'),
        isDefault: true,
        isActive: legacy.isActive !== false,
      }];
    }
    return [];
  }, [settingsQuery.data]);

  // Default printer name for Main Counter quick-print
  const defaultPrinterName = useMemo(() => {
    const defaultP = printers.find((p) => p.isDefault) ?? printers[0];
    return defaultP?.name ?? (lang === 'ar' ? 'الكاونتر' : 'Main Counter');
  }, [printers, lang]);

  // Print dialog state
  const [printDialogOrder, setPrintDialogOrder] = useState<AdminOrder | null>(null);
  const [printDialogReceipt, setPrintDialogReceipt] = useState<ReceiptData | null>(null);
  const [printLoading, setPrintLoading] = useState(false);

  // Quick-print state (Main Counter)
  const [quickPrintingId, setQuickPrintingId] = useState<string | null>(null);

  /** Main Counter quick-print: directly prints to the local agent, skipping the dialog */
  const handleQuickPrint = useCallback(async (order: AdminOrder): Promise<void> => {
    setQuickPrintingId(order._id);
    try {
      // Check if local agent is online
      const agentUrl = await checkLocalAgent();
      if (!agentUrl) {
        // Agent offline — fall back to the full print dialog
        toast.warning(
          lang === 'ar'
            ? 'خدمة الطباعة المحلية غير متصلة — افتح نافذة الطباعة'
            : 'Local print service offline — opening print dialog'
        );
        await openPrintDialog(order);
        return;
      }

      // Build receipt and send directly to the local agent
      const receipt = buildReceipt(order, '80');
      const result = await printViaLocalAgent(receipt, agentUrl);

      if (result.success) {
        await markOrderPrinted(order._id);
        void invalidateAll();
        toast.success(
          lang === 'ar'
            ? `✓ تم الطباعة على ${defaultPrinterName}`
            : `✓ Printed to ${defaultPrinterName}`
        );
      } else {
        toast.error(
          lang === 'ar'
            ? `✗ فشلت الطباعة: ${result.error}`
            : `✗ Print failed: ${result.error}`
        );
      }
    } catch {
      toast.error(lang === 'ar' ? 'فشلت الطباعة' : 'Print failed');
    } finally {
      setQuickPrintingId(null);
    }
  }, [lang]);

  // PDF preview dialog state
  const [pdfPreviewOrder, setPdfPreviewOrder] = useState<AdminOrder | null>(null);

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

  // Print-related state
  const [printJobs, setPrintJobs] = useState<Array<{ id: string; status: string; createdAt: string }>>([]);

  const fetchPrintJobs = async (orderId: string): Promise<void> => {
    try {
      const jobs = await getOrderPrintJobs(orderId);
      setPrintJobs(jobs);
    } catch {
      setPrintJobs([]);
    }
  };

  const buildReceipt = (order: AdminOrder, paperWidth: '58' | '80' = '80'): ReceiptData =>
    buildReceiptFromOrder(
      {
        orderNo: order.orderNo,
        createdAt: order.createdAt,
        customerName: order.customerName,
        phone: order.phone,
        deliveryAddress: order.deliveryAddress,
        status: order.status,
        items: order.items.map((i) => ({
          name: i.name,
          nameEn: i.nameEn,
          size: i.size,
          qty: i.qty,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        })),
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        discount: order.discount,
        total: order.total,
        payment: order.payment,
      },
      paperWidth,
      lang === 'ar' ? 'ar' : 'en',
    );

  const openPrintDialog = async (order: AdminOrder): Promise<void> => {
    const receipt = buildReceipt(order, '80');
    setPrintDialogOrder(order);
    setPrintDialogReceipt(receipt);
    await fetchPrintJobs(order._id);
  };

  const handlePrintFromDialog = async (_printerId: string, paperWidth: '58' | '80', copies: number): Promise<void> => {
    if (!printDialogOrder) return;
    setPrintLoading(true);
    try {
      const receipt = buildReceipt(printDialogOrder, paperWidth);
      // For Arabic text, render as image for printers without native Arabic support
      const isArabic = hasArabic(receipt.storeNameAr) || receipt.language === 'ar';
      const receiptPayload = isArabic
        ? { ...receipt, imageDataUrl: canvasToDataURL(renderReceiptToCanvas(receipt)) }
        : receipt;
      for (let i = 0; i < copies; i++) {
        try {
          await createPrintJob(printDialogOrder._id, receiptPayload as unknown as Record<string, unknown>);
        } catch {
          printReceipt(receipt);
        }
      }
      await markOrderPrinted(printDialogOrder._id);
      void invalidateAll();
      await fetchPrintJobs(printDialogOrder._id);
      toast.success(lang === 'ar' ? 'تم إرسال الفاتورة للطابعة' : 'Invoice sent to printer');
    } catch {
      toast.error(lang === 'ar' ? 'فشلت الطباعة' : 'Print failed');
    } finally {
      setPrintLoading(false);
    }
  };

  const handleBrowserPrintFromDialog = async (paperWidth: '58' | '80'): Promise<void> => {
    if (!printDialogOrder) return;
    setPrintLoading(true);
    try {
      const receipt = buildReceipt(printDialogOrder, paperWidth);
      printReceipt(receipt);
      await markOrderPrinted(printDialogOrder._id);
      void invalidateAll();
      await fetchPrintJobs(printDialogOrder._id);
    } catch {
      toast.error(lang === 'ar' ? 'فشلت الطباعة' : 'Print failed');
    } finally {
      setPrintLoading(false);
    }
  };

  /** Direct print via local agent (no about:blank, no browser dialog) */
  const handleDirectPrintFromDialog = async (): Promise<void> => {
    if (!printDialogOrder) return;
    try {
      await markOrderPrinted(printDialogOrder._id);
      void invalidateAll();
      await fetchPrintJobs(printDialogOrder._id);
    } catch {
      // non-critical
    }
  };

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

  /** Handle status change — shows confirmation dialog for irreversible actions */
  const handleStatusChange = (order: AdminOrder, next: OrderStatus): void => {
    if (CONFIRM_STATUSES.includes(next)) {
      setConfirmStatusTarget({ order, next });
    } else {
      statusMutation.mutate({ id: order._id, next });
    }
  };

  /** Confirm the irreversible status change */
  const confirmStatusChange = (): void => {
    if (confirmStatusTarget) {
      statusMutation.mutate({ id: confirmStatusTarget.order._id, next: confirmStatusTarget.next });
      setConfirmStatusTarget(null);
    }
  };

  const cancelNote = selected
    ? [...selected.statusHistory].reverse().find((h) => h.status === 'cancelled' && h.reason)
    : undefined;
  const complimentaryNote = selected
    ? [...selected.statusHistory].reverse().find((h) => h.status === 'complimentary' && h.reason)
    : undefined;
  const adjustedBy = selected?.adjustedBy;
  const adjustedByName = typeof adjustedBy === 'object' && adjustedBy ? adjustedBy.fullName : '';

  /** Confirmation message for irreversible status changes */
  const confirmStatusMessage = confirmStatusTarget
    ? (() => {
        const { next, order } = confirmStatusTarget;
        if (next === 'completed') {
          return lang === 'ar'
            ? `هل أنت متأكد من تغيير حالة الطلب ${order.orderNo} إلى تم التسليم؟`
            : `Are you sure you want to mark order ${order.orderNo} as Delivered?`;
        }
        if (next === 'cancelled') {
          return lang === 'ar'
            ? `هل أنت متأكد من إلغاء الطلب ${order.orderNo}؟`
            : `Are you sure you want to cancel order ${order.orderNo}?`;
        }
        if (next === 'delivery_failed') {
          return lang === 'ar'
            ? `هل أنت متأكد من تغيير حالة الطلب ${order.orderNo} إلى فشل التسليم؟`
            : `Are you sure you want to mark order ${order.orderNo} as Delivery Failed?`;
        }
        return '';
      })()
    : '';

  return (
    <div>
      <PageHeader title={t('admin.nav.orders')} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={t('admin.searchPlaceholder')} />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 w-44">
          <option value="">{t('admin.allStatuses')}</option>
          <option value="pending">{t('admin.status.pending')}</option>
          <option value="confirmed">{t('admin.status.confirmed')}</option>
          <option value="preparing">{t('admin.status.preparing')}</option>
          <option value="ready_for_delivery">{t('admin.status.ready_for_delivery')}</option>
          <option value="on_delivery">{t('admin.status.on_delivery')}</option>
          <option value="completed">{t('admin.status.completed')}</option>
          <option value="cancelled">{t('admin.status.cancelled')}</option>
          <option value="delivery_failed">{t('admin.status.delivery_failed')}</option>
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
                        <div className="relative">
                          <Select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleStatusChange(o, e.target.value as OrderStatus);
                                e.target.value = '';
                              }
                            }}
                            disabled={statusMutation.isPending}
                            className="h-8 w-36 appearance-none pr-7"
                            aria-label={t('admin.statusChange')}
                          >
                            <option value="">{t('admin.statusChange')}…</option>
                            {NEXT_STATUSES[o.status].map((s) => (
                              <option key={s} value={s}>
                                {t(`admin.status.${s}`)}
                              </option>
                            ))}
                          </Select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-night-400" />
                        </div>
                      ) : null}
                    </div>
                  </Td>
                  <Td className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-emerald-400 hover:bg-emerald-500/10"
                        title={lang === 'ar' ? `طباعة على ${defaultPrinterName}` : `Quick print to ${defaultPrinterName}`}
                        loading={quickPrintingId === o._id}
                        onClick={() => void handleQuickPrint(o)}
                      >
                        <Zap className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setSelected(o); void fetchPrintJobs(o._id); }} aria-label={t('common.viewAll')}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
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
                      variant={
                        next === 'refunded' || next === 'cancelled' || next === 'delivery_failed'
                          ? 'outline'
                          : 'primary'
                      }
                      className={
                        next === 'refunded'
                          ? 'border-slate-500/40 text-slate-300'
                          : next === 'cancelled'
                          ? 'border-red-500/40 text-red-400'
                          : next === 'delivery_failed'
                          ? 'border-orange-500/40 text-orange-400'
                          : ''
                      }
                      loading={statusMutation.isPending}
                      onClick={() => handleStatusChange(selected, next)}
                    >
                      {next === 'refunded' ? t('admin.refundOrder') : t(`admin.status.${next}`)}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="primary"
                    loading={quickPrintingId === selected._id}
                    onClick={() => void handleQuickPrint(selected)}
                  >
                    <Zap className="h-4 w-4" />
                    {lang === 'ar' ? `طباعة على ${defaultPrinterName}` : `Print to ${defaultPrinterName}`}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-500/40 text-blue-400"
                    onClick={() => void openPrintDialog(selected)}
                  >
                    <Printer className="h-4 w-4" />
                    {lang === 'ar' ? 'خيارات الطباعة' : 'Print Options'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/40 text-emerald-400"
                    onClick={() => setPdfPreviewOrder(selected)}
                  >
                    <FileDown className="h-4 w-4" />
                    {lang === 'ar' ? 'تصدير PDF' : 'Export PDF'}
                  </Button>
                  {printJobs.length > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-500/40 text-blue-300"
                      onClick={() => void openPrintDialog(selected)}
                    >
                      <Printer className="h-4 w-4" />
                      {lang === 'ar' ? 'إعادة طباعة' : 'Reprint'}
                    </Button>
                  ) : null}
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
                      {item.isCustomPrice ? (
                        <span className="ms-1 inline-block rounded bg-gold-500/20 px-1.5 py-0.5 text-xs font-bold text-gold-400">
                          {lang === 'ar' ? 'سعر مخصص' : 'Custom Price'}
                        </span>
                      ) : null}
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

            {/* Print History */}
            {printJobs.length > 0 ? (
              <div className="rounded-xl border border-night-800 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-night-500">
                  {lang === 'ar' ? 'سجل الطباعة' : 'Print History'}
                </p>
                <div className="mt-2 space-y-1">
                  {printJobs.map((pj) => (
                    <div key={pj.id} className="flex items-center justify-between text-xs">
                      <span className="text-night-400">{fmtDate(pj.createdAt)}</span>
                      <span className={
                        pj.status === 'printed' ? 'text-emerald-400' :
                        pj.status === 'failed' ? 'text-red-400' :
                        pj.status === 'pending' ? 'text-amber-400' :
                        'text-blue-400'
                      }>
                        {pj.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Print Invoice Dialog */}
      {printDialogOrder && printDialogReceipt ? (
        <PrintInvoiceDialog
          open={Boolean(printDialogOrder)}
          onClose={() => { setPrintDialogOrder(null); setPrintDialogReceipt(null); }}
          orderNo={printDialogOrder.orderNo}
          receipt={printDialogReceipt}
          printers={printers}
          onPrint={handlePrintFromDialog}
          onBrowserPrint={handleBrowserPrintFromDialog}
          onDirectPrint={handleDirectPrintFromDialog}
          printLoading={printLoading}
        />
      ) : null}

      {/* PDF Preview Dialog */}
      {pdfPreviewOrder ? (
        <PdfPreviewDialog
          open={Boolean(pdfPreviewOrder)}
          onClose={() => setPdfPreviewOrder(null)}
          order={pdfPreviewOrder as unknown as Order}
        />
      ) : null}

      {/* Confirmation dialog for irreversible status changes */}
      <ConfirmDialog
        open={Boolean(confirmStatusTarget)}
        onClose={() => setConfirmStatusTarget(null)}
        title={
          confirmStatusTarget?.next === 'completed'
            ? (lang === 'ar' ? 'تأكيد التسليم' : 'Confirm Delivery')
            : confirmStatusTarget?.next === 'cancelled'
            ? t('admin.confirmCancelTitle')
            : (lang === 'ar' ? 'تأكيد فشل التسليم' : 'Confirm Delivery Failed')
        }
        message={confirmStatusMessage}
        confirmLabel={
          confirmStatusTarget?.next === 'completed'
            ? (lang === 'ar' ? 'تم التسليم' : 'Mark Delivered')
            : confirmStatusTarget?.next === 'cancelled'
            ? t('admin.cancelOrder')
            : (lang === 'ar' ? 'فشل التسليم' : 'Mark Delivery Failed')
        }
        confirmVariant={confirmStatusTarget?.next === 'cancelled' ? 'primary' : 'primary'}
        loading={statusMutation.isPending}
        onConfirm={confirmStatusChange}
      />

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
