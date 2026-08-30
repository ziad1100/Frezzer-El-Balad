/**
 * Admin Payment Verification Page
 *
 * Shows pending manual payments (Vodafone Cash, Bank Transfer, InstaPay)
 * for admin review and verification.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Eye, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  adminListPendingPayments,
  adminApprovePayment,
  adminRejectPayment,
  type PendingPaymentItem,
} from '@/api/payment';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader, Pagination, TableWrap, Td, Th } from '@/components/admin/primitives';
import { formatPrice } from '@/lib/utils';

export function AdminPaymentsPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState<PendingPaymentItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<PendingPaymentItem | null>(null);

  const pendingPayments = useQuery({
    queryKey: ['admin', 'pending-payments', page],
    queryFn: () => adminListPendingPayments({ page, limit: 20 }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApprovePayment(id),
    onSuccess: () => {
      toast.success(isAr ? 'تم تأكيد الدفع' : 'Payment approved');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pending-payments'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      setSelectedTransaction(null);
    },
    onError: () => toast.error(isAr ? 'فشل تأكيد الدفع' : 'Failed to approve payment'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminRejectPayment(id, reason),
    onSuccess: () => {
      toast.success(isAr ? 'تم رفض الدفع' : 'Payment rejected');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pending-payments'] });
      setRejectTarget(null);
      setRejectReason('');
      setShowRejectDialog(false);
    },
    onError: () => toast.error(isAr ? 'فشل رفض الدفع' : 'Failed to reject payment'),
  });

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(isAr ? 'ar-EG' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const paymentMethodLabel = (method: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      vodafone_cash: { ar: 'فودافون كاش', en: 'Vodafone Cash' },
      bank_transfer: { ar: 'تحويل بنكي', en: 'Bank Transfer' },
      instapay: { ar: 'انستاباي', en: 'InstaPay' },
    };
    return labels[method]?.[isAr ? 'ar' : 'en'] ?? method;
  };

  return (
    <div>
      <PageHeader title={isAr ? 'تحقق من المدفوعات' : 'Payment Verification'} />

      {pendingPayments.isLoading ? (
        <Skeleton className="h-96" />
      ) : pendingPayments.data && pendingPayments.data.items.length > 0 ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>{isAr ? 'رقم الطلب' : 'Order'}</Th>
                <Th>{isAr ? 'العميل' : 'Customer'}</Th>
                <Th>{isAr ? 'المبلغ' : 'Amount'}</Th>
                <Th>{isAr ? 'طريقة الدفع' : 'Method'}</Th>
                <Th>{isAr ? 'رقم العملية' : 'Reference'}</Th>
                <Th>{isAr ? 'التاريخ' : 'Date'}</Th>
                <Th className="text-end">{isAr ? 'إجراءات' : 'Actions'}</Th>
              </tr>
            </thead>
            <tbody>
              {pendingPayments.data.items.map((item) => (
                <tr key={item.id} className="group transition-colors hover:bg-[var(--tw-hover)]">
                  <Td>
                    <span className="font-mono font-bold tracking-tight text-[var(--tw-text)]">#{item.orderNo}</span>
                  </Td>
                  <Td>
                    <p className="font-bold text-[var(--tw-text)]">{item.customerName}</p>
                    <p className="text-xs text-[var(--tw-text-muted)]" dir="ltr">{item.phone}</p>
                  </Td>
                  <Td>
                    <span className="text-sm font-extrabold tracking-tight text-brand-400">
                      {formatPrice(item.amount, lang)}
                    </span>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-bold text-brand-400">
                      {paymentMethodLabel(item.paymentMethod)}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-[var(--tw-text-muted)]">
                      {item.transactionReference || '—'}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs text-[var(--tw-text-muted)]">
                      {fmtDate(item.createdAt)}
                    </span>
                  </Td>
                  <Td className="text-end">
                    <div className="inline-flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedTransaction(item)} title={isAr ? 'عرض التفاصيل' : 'View details'}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-emerald-400 hover:bg-emerald-500/10" loading={approveMutation.isPending} onClick={() => approveMutation.mutate(item.id)} title={isAr ? 'تأكيد الدفع' : 'Approve payment'}>
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-400 hover:bg-red-500/10" onClick={() => { setRejectTarget(item); setShowRejectDialog(true); setRejectReason(''); }} title={isAr ? 'رفض الدفع' : 'Reject payment'}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination
            page={pendingPayments.data.page}
            pages={pendingPayments.data.pages}
            onPage={setPage}
          />
        </>
      ) : (
        <div className="rounded-3xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-[var(--tw-text)]">
            {isAr ? 'لا توجد مدفوعات تنتظر التحقق' : 'No pending payments to verify'}
          </p>
          <p className="mt-1 text-xs text-[var(--tw-text-muted)]">
            {isAr ? 'جميع المدفوعات تم التحقق منها' : 'All payments have been verified'}
          </p>
        </div>
      )}

      {/* Transaction Detail Modal */}
      <Modal
        open={Boolean(selectedTransaction)}
        onClose={() => setSelectedTransaction(null)}
        title={isAr ? 'تفاصيل الدفع' : 'Payment Details'}
        size="lg"
      >
        {selectedTransaction && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--tw-border)] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--tw-text-muted)]">
                  {isAr ? 'رقم الطلب' : 'Order'}
                </p>
                <p className="mt-1 text-lg font-extrabold text-[var(--tw-text)]">#{selectedTransaction.orderNo}</p>
              </div>
              <div className="rounded-xl border border-[var(--tw-border)] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--tw-text-muted)]">
                  {isAr ? 'المبلغ' : 'Amount'}
                </p>
                <p className="mt-1 text-lg font-extrabold text-brand-400">
                  {formatPrice(selectedTransaction.amount, lang)}
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-[var(--tw-border)] p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--tw-text-muted)]">{isAr ? 'العميل' : 'Customer'}</span>
                <span className="font-bold text-[var(--tw-text)]">{selectedTransaction.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--tw-text-muted)]">{isAr ? 'رقم الهاتف' : 'Phone'}</span>
                <span className="text-[var(--tw-text)]" dir="ltr">{selectedTransaction.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--tw-text-muted)]">{isAr ? 'طريقة الدفع' : 'Payment Method'}</span>
                <span className="font-bold text-[var(--tw-text)]">{paymentMethodLabel(selectedTransaction.paymentMethod)}</span>
              </div>
              {selectedTransaction.transactionReference && (
                <div className="flex justify-between">
                  <span className="text-[var(--tw-text-muted)]">{isAr ? 'رقم العملية' : 'Transaction Reference'}</span>
                  <span className="font-mono text-[var(--tw-text)]">{selectedTransaction.transactionReference}</span>
                </div>
              )}
              {selectedTransaction.senderPhone && (
                <div className="flex justify-between">
                  <span className="text-[var(--tw-text-muted)]">{isAr ? 'هاتف المحول' : 'Sender Phone'}</span>
                  <span className="text-[var(--tw-text)]" dir="ltr">{selectedTransaction.senderPhone}</span>
                </div>
              )}
              {selectedTransaction.senderName && (
                <div className="flex justify-between">
                  <span className="text-[var(--tw-text-muted)]">{isAr ? 'اسم المحول' : 'Sender Name'}</span>
                  <span className="text-[var(--tw-text)]">{selectedTransaction.senderName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--tw-text-muted)]">{isAr ? 'التاريخ' : 'Date'}</span>
                <span className="text-[var(--tw-text)]">{fmtDate(selectedTransaction.createdAt)}</span>
              </div>
            </div>

            {/* Proof */}
            {selectedTransaction.proofUrl && (
              <div className="rounded-xl border border-[var(--tw-border)] p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--tw-text-muted)]">
                  <FileText className="mr-1 inline h-3 w-3" />
                  {isAr ? 'إثبات التحويل' : 'Transfer Proof'}
                </p>
                <p className="text-sm text-[var(--tw-text-muted)]">{selectedTransaction.proofUrl}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={() => approveMutation.mutate(selectedTransaction.id)}
                loading={approveMutation.isPending}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4" />
                {isAr ? 'تأكيد الدفع' : 'Approve Payment'}
              </Button>
              <Button
                variant="outline"
                className="border-red-500/40 text-red-400"
                onClick={() => { setRejectTarget(selectedTransaction); setShowRejectDialog(true); setRejectReason(''); setSelectedTransaction(null); }}
              >
                <XCircle className="h-4 w-4" />
                {isAr ? 'رفض' : 'Reject'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Reason Dialog */}
      <Modal
        open={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        title={isAr ? 'سبب رفض الدفع' : 'Rejection Reason'}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-300">
              {isAr
                ? 'أدخل سبب رفض الدفع. سيتم إبلاغ العميل.'
                : 'Enter the rejection reason. The customer will be notified.'}
            </p>
          </div>
          <Input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={isAr ? 'سبب الرفض' : 'Rejection reason'}
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              loading={rejectMutation.isPending}
              disabled={!rejectReason.trim()}
              onClick={() => {
                if (rejectTarget && rejectReason.trim()) {
                  rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason.trim() });
                }
              }}
            >
              {isAr ? 'رفض الدفع' : 'Reject Payment'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
