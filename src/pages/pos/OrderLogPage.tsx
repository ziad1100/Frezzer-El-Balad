import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Clock, Eye } from 'lucide-react';
import { adminListOrders } from '@/api/admin';
import type { Order } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { PageHeader, Pagination, TableWrap, Td, Th, StatusBadge } from '@/components/admin/primitives';
import { cn, formatPrice } from '@/lib/utils';

type TabType = 'all' | 'pending';

export function OrderLogPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Fetch orders
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', { page, q: search, status: activeTab === 'pending' ? 'pending' : undefined }],
    queryFn: () => adminListOrders({
      page,
      limit: 20,
      q: search,
      status: activeTab === 'pending' ? 'pending' : undefined,
    }),
  });

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString(isAr ? 'ar-EG' : 'en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div>
      <PageHeader title={isAr ? 'سجل الطلبات' : 'Order Log'} />

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        <Button
          variant={activeTab === 'all' ? 'primary' : 'outline'}
          onClick={() => { setActiveTab('all'); setPage(1); }}
        >
          <FileText className="h-4 w-4" />
          {isAr ? 'سجل الطلبات' : 'Order Log'}
        </Button>
        <Button
          variant={activeTab === 'pending' ? 'primary' : 'outline'}
          onClick={() => { setActiveTab('pending'); setPage(1); }}
        >
          <Clock className="h-4 w-4" />
          {isAr ? 'الطلبات المعلقة' : 'Pending Orders'}
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tw-text-muted)]" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={isAr ? 'بحث برقم الطلب، اسم العميل، أو الباركود...' : 'Search by order number, customer, or barcode...'}
            className="pl-9"
          />
        </div>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--tw-border-strong)] border-t-transparent" />
        </div>
      ) : !data?.items.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-[var(--tw-text-muted)]" />
            <p className="mt-4 text-[var(--tw-text-muted)]">
              {isAr ? 'لا توجد طلبات' : 'No orders found'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--tw-border)] text-right">
                  <Th>{isAr ? 'رقم الطلب' : 'Order No'}</Th>
                  <Th>{isAr ? 'نوع الطلب' : 'Order Type'}</Th>
                  <Th>{isAr ? 'توقيت الإنشاء' : 'Created At'}</Th>
                  <Th>{isAr ? 'أنشئ بواسطة' : 'Created By'}</Th>
                  <Th>{isAr ? 'العميل' : 'Customer'}</Th>
                  <Th>{isAr ? 'عدد الأصناف' : 'Items'}</Th>
                  <Th>{isAr ? 'الكمية' : 'Qty'}</Th>
                  <Th>{isAr ? 'القيمة الإجمالية' : 'Total'}</Th>
                  <Th>{isAr ? 'الحالة' : 'Status'}</Th>
                  <Th>{isAr ? 'عرض' : 'View'}</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((order) => (
                  <tr
                    key={order._id}
                    className={cn(
                      "border-b border-[var(--tw-border)]/50 transition-colors",
                      selectedOrder?._id === order._id ? "bg-blue-500/10" : "hover:bg-[var(--tw-hover)]"
                    )}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <Td className="font-medium text-[var(--tw-text)]">#{order.orderNo}</Td>
                    <Td>{order.orderType || (isAr ? 'بيع' : 'Sale')}</Td>
                    <Td className="text-xs">{formatDate(order.createdAt)}</Td>
                    <Td>{order.createdByName || (isAr ? 'نظام' : 'System')}</Td>
                    <Td>{order.customerName || (isAr ? 'عميل' : 'Customer')}</Td>
                    <Td>{order.items.length}</Td>
                    <Td>{order.items.reduce((sum, item) => sum + item.qty, 0)}</Td>
                    <Td className="font-medium">{formatPrice(order.total, lang)}</Td>
                    <Td><StatusBadge status={order.status} /></Td>
                    <Td>
                      <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(order)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <Modal open onClose={() => setSelectedOrder(null)} title={isAr ? `تفاصيل الطلب #${selectedOrder.orderNo}` : `Order #${selectedOrder.orderNo} Details`} size="lg">
          <div className="space-y-4">
            {/* Order Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[var(--tw-text-muted)]">{isAr ? 'رقم الطلب' : 'Order No'}</p>
                <p className="font-medium">#{selectedOrder.orderNo}</p>
              </div>
              <div>
                <p className="text-[var(--tw-text-muted)]">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</p>
                <p className="font-medium">{formatDate(selectedOrder.createdAt)}</p>
              </div>
              <div>
                <p className="text-[var(--tw-text-muted)]">{isAr ? 'العميل' : 'Customer'}</p>
                <p className="font-medium">{selectedOrder.customerName || (isAr ? 'عميل' : 'Customer')}</p>
              </div>
              <div>
                <p className="text-[var(--tw-text-muted)]">{isAr ? 'أنشئ بواسطة' : 'Created By'}</p>
                <p className="font-medium">{selectedOrder.createdByName || (isAr ? 'نظام' : 'System')}</p>
              </div>
              <div>
                <p className="text-[var(--tw-text-muted)]">{isAr ? 'الحالة' : 'Status'}</p>
                <StatusBadge status={selectedOrder.status} />
              </div>
              <div>
                <p className="text-[var(--tw-text-muted)]">{isAr ? 'الإجمالي' : 'Total'}</p>
                <p className="text-lg font-bold text-emerald-500">{formatPrice(selectedOrder.total, lang)}</p>
              </div>
            </div>

            {/* Order Items */}
            <div>
              <h4 className="mb-2 font-medium">{isAr ? 'الأصناف' : 'Items'}</h4>
              <TableWrap>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--tw-border)] text-right">
                      <Th>{isAr ? 'الصنف' : 'Product'}</Th>
                      <Th>{isAr ? 'الكمية' : 'Qty'}</Th>
                      <Th>{isAr ? 'السعر' : 'Price'}</Th>
                      <Th>{isAr ? 'الإجمالي' : 'Total'}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item, index) => (
                      <tr key={index} className="border-b border-[var(--tw-border)]/50">
                        <Td>
                          {isAr ? item.name : (item.nameEn || item.name)}
                          {item.size && <span className="text-xs text-[var(--tw-text-muted)]"> ({item.size})</span>}
                        </Td>
                        <Td>{item.qty}</Td>
                        <Td>{formatPrice(item.unitPrice, lang)}</Td>
                        <Td className="font-medium">{formatPrice(item.lineTotal, lang)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
