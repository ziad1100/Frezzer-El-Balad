import { api } from '@/lib/api';

export type MovementType = 'sale' | 'purchase' | 'gift' | 'return' | 'waste' | 'damage' | 'stock_adjustment' | 'other';

export interface StockMovement {
  id: string;
  productId: string;
  sizeId: string | null;
  productName: string;
  productSize: string;
  categoryId: string | null;
  movementType: MovementType;
  quantity: number;
  unitSellingPrice: number | null;
  totalSellingPrice: number | null;
  unitPurchasePrice: number | null;
  totalPurchasePrice: number | null;
  referenceType: string;
  referenceId: string;
  orderNo: string;
  customerName: string;
  paymentMethod: string;
  supplier: string;
  reason: string;
  notes: string;
  movementDate: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MovementReportItem {
  productId: string;
  productName: string;
  productSize: string;
  categoryId: string | null;
  categoryName: string;
  totalPurchased: number;
  totalSold: number;
  totalReturned: number;
  totalGifted: number;
  totalWasted: number;
  totalDamaged: number;
  totalAdjusted: number;
  totalPurchaseCost: number;
  totalSalesRevenue: number;
  currentStock: number;
}

export interface MovementReportDetail {
  date: string;
  time: string;
  productName: string;
  productSize: string;
  categoryName: string;
  movementType: string;
  quantity: number;
  unitPurchasePrice: number | null;
  totalPurchasePrice: number | null;
  unitSellingPrice: number | null;
  totalSellingPrice: number | null;
  paymentMethod: string;
  orderNo: string;
  customerName: string;
  supplier: string;
  reason: string;
  notes: string;
}

export interface MovementReport {
  summary: MovementReportItem[];
  details: MovementReportDetail[];
}

/**
 * Record a manual stock movement (gift, waste, damage, adjustment).
 */
export const recordMovement = (data: {
  productId: string;
  sizeId?: string | null;
  productName: string;
  productSize?: string;
  categoryId?: string | null;
  movementType: MovementType;
  quantity: number;
  reason?: string;
  notes?: string;
  supplier?: string;
}): Promise<StockMovement> =>
  api.post('/stock-movements/record', data).then((r: { data: { data: StockMovement } }) => r.data.data);

/**
 * Get movement report for a date range.
 */
export const getMovementReport = (startDate: string, endDate: string): Promise<MovementReport> =>
  api.get('/stock-movements/report', {
    params: { startDate, endDate },
  }).then((r: { data: { data: MovementReport } }) => r.data.data);

/**
 * Export movement report as Excel.
 */
export const exportMovementReport = async (
  startDate: string,
  endDate: string,
  period: string = 'month',
): Promise<{ blob: Blob; filename: string }> => {
  const res = await api.get<Blob>('/stock-movements/export', {
    params: { startDate, endDate, period },
    responseType: 'blob',
  });
  const disposition = String(res.headers?.['content-disposition'] ?? '');
  const match = disposition.match(/filename="?([^";]+)"?/);
  const fallback = `freezer-elbalad-movement-report-${startDate}-to-${endDate}.xlsx`;
  return { blob: res.data, filename: match?.[1] ?? fallback };
};