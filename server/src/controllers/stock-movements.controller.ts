/**
 * Stock Movements Controller
 *
 * Handles recording product movements and generating reports.
 */

import type { Request, Response } from 'express';
import * as stockMovements from '../db/stock-movements';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import type { AuthRequest } from '../middlewares/auth';
import * as XLSX from 'xlsx';

/**
 * Record a manual stock movement (gift, waste, damage, adjustment).
 */
export const recordMovement = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    productId, sizeId, productName, productSize, categoryId,
    movementType, quantity, reason, notes, supplier,
  } = req.body;

  if (!productId) throw new ApiError(400, 'Product ID is required');
  if (!productName) throw new ApiError(400, 'Product name is required');
  if (!movementType) throw new ApiError(400, 'Movement type is required');
  if (typeof quantity !== 'number' || quantity === 0) throw new ApiError(400, 'Quantity must be a non-zero number');

  const validTypes = ['sale', 'purchase', 'gift', 'return', 'waste', 'damage', 'stock_adjustment', 'other'];
  if (!validTypes.includes(movementType)) {
    throw new ApiError(400, `Invalid movement type. Must be one of: ${validTypes.join(', ')}`);
  }

  const movement = await stockMovements.recordMovement({
    productId,
    sizeId: sizeId || null,
    productName,
    productSize: productSize || '',
    categoryId: categoryId || null,
    movementType,
    quantity,
    reason: reason || '',
    notes: notes || '',
    supplier: supplier || '',
    createdBy: req.user!.id,
  });

  res.status(201).json(new ApiResponse(201, movement, 'Movement recorded'));
});

/**
 * Get movement report for a date range.
 */
export const getMovementReport = asyncHandler(async (req: Request, res: Response) => {
  const startDate = String(req.query.startDate ?? '');
  const endDate = String(req.query.endDate ?? '');

  if (!startDate || !endDate) {
    throw new ApiError(400, 'startDate and endDate are required');
  }

  const start = new Date(startDate);
  const end = new Date(endDate + 'T23:59:59');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid date format');
  }

  const report = await stockMovements.getMovementReport(
    start.toISOString(),
    end.toISOString(),
  );

  res.json(new ApiResponse(200, report));
});

/**
 * Export movement report as Excel.
 */
export const exportMovementReport = asyncHandler(async (req: Request, res: Response) => {
  const startDate = String(req.query.startDate ?? '');
  const endDate = String(req.query.endDate ?? '');
  const period = String(req.query.period ?? 'month');

  if (!startDate || !endDate) {
    throw new ApiError(400, 'startDate and endDate are required');
  }

  const start = new Date(startDate);
  const end = new Date(endDate + 'T23:59:59');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid date format');
  }

  const report = await stockMovements.getMovementReport(
    start.toISOString(),
    end.toISOString(),
  );

  // Calculate calendar days
  const msPerDay = 86400000;
  const calendarDays = Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };

  const MONEY = '#,##0.00" ج.م"';
  const COUNT = '#,##0';

  // Movement type labels
  const movementTypeAr: Record<string, string> = {
    sale: 'بيع',
    purchase: 'شراء',
    gift: 'هدية',
    return: 'مرتجع',
    waste: 'فاقد',
    damage: 'تالف',
    stock_adjustment: 'تسوية مخزون',
    other: 'أخرى',
  };

  // ---- Sheet 1: ملخص التقرير ----
  const periodLabel = period === 'today' ? 'اليوم' : period === 'week' ? 'هذا الأسبوع' : period === 'month' ? 'هذا الشهر' : 'فترة مخصصة';
  const summaryRows: (string | number)[][] = [
    ['تقرير حركة الأصناف — FREEZER EL BALAD'],
    [''],
    ['فترة التقرير', `${periodLabel}: ${startDate} → ${endDate}`],
    ['عدد الأيام', calendarDays],
    ['تاريخ الإنشاء', new Date().toISOString().slice(0, 16).replace('T', ' ')],
    [''],
    ['إجمالي المشتريات', report.summary.reduce((a, p) => a + p.totalPurchased, 0)],
    ['إجمالي المبيعات', report.summary.reduce((a, p) => a + p.totalSold, 0)],
    ['إجمالي الهدايا', report.summary.reduce((a, p) => a + p.totalGifted, 0)],
    ['إجمالي المرتجعات', report.summary.reduce((a, p) => a + p.totalReturned, 0)],
    ['إجمالي الفاقد', report.summary.reduce((a, p) => a + p.totalWasted, 0)],
    ['إجمالي التالف', report.summary.reduce((a, p) => a + p.totalDamaged, 0)],
    [''],
    ['إجمالي تكلفة المشتريات', report.summary.reduce((a, p) => a + p.totalPurchaseCost, 0)],
    ['إجمالي إيرادات المبيعات', report.summary.reduce((a, p) => a + p.totalSalesRevenue, 0)],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'ملخص التقرير');

  // ---- Sheet 2: ملخص الأصناف ----
  const productSummaryRows: (string | number)[][] = [
    ['المنتج', 'الوزن', 'الفئة', 'تم الشراء', 'تم البيع', 'هدايا', 'مرتجع', 'فاقد', 'تالف', 'تسوية', 'تكلفة الشراء', 'إيرادات البيع', 'المخزون الحالي'],
  ];
  for (const item of report.summary) {
    productSummaryRows.push([
      item.productName,
      item.productSize || '—',
      item.categoryName || '—',
      item.totalPurchased,
      item.totalSold,
      item.totalGifted,
      item.totalReturned,
      item.totalWasted,
      item.totalDamaged,
      item.totalAdjusted,
      item.totalPurchaseCost,
      item.totalSalesRevenue,
      item.currentStock,
    ]);
  }
  const productSummaryWs = XLSX.utils.aoa_to_sheet(productSummaryRows);
  for (let r = 1; r < productSummaryRows.length; r++) {
    for (const c of [3, 4, 5, 6, 7, 8, 9, 12]) {
      const cell = productSummaryWs[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.t === 'n') cell.z = COUNT;
    }
    for (const c of [10, 11]) {
      const cell = productSummaryWs[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.t === 'n') cell.z = MONEY;
    }
  }
  productSummaryWs['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, productSummaryWs, 'ملخص الأصناف');

  // ---- Sheet 3: حركة الأصناف (detailed movements) ----
  const detailRows: (string | number)[][] = [
    ['التاريخ', 'الوقت', 'المنتج', 'الوزن', 'الفئة', 'نوع الحركة', 'الكمية', 'سعر الشراء', 'إجمالي الشراء', 'سعر البيع', 'إجمالي البيع', 'طريقة الدفع', 'رقم الطلب', 'العميل', 'المورد', 'السبب', 'ملاحظات'],
  ];
  for (const d of report.details) {
    detailRows.push([
      d.date,
      d.time,
      d.productName,
      d.productSize || '—',
      d.categoryName || '—',
      movementTypeAr[d.movementType] ?? d.movementType,
      d.quantity,
      d.unitPurchasePrice ?? '—',
      d.totalPurchasePrice ?? '—',
      d.unitSellingPrice ?? '—',
      d.totalSellingPrice ?? '—',
      d.paymentMethod || '—',
      d.orderNo || '—',
      d.customerName || '—',
      d.supplier || '—',
      d.reason || '—',
      d.notes || '—',
    ]);
  }
  const detailWs = XLSX.utils.aoa_to_sheet(detailRows);
  detailWs['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 14 },
    { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 16 },
    { wch: 20 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, detailWs, 'حركة الأصناف');

  // Generate filename
  const filename = `freezer-elbalad-movement-report-${startDate}-to-${endDate}.xlsx`;
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});
