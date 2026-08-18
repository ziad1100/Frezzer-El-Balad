import type { Request, Response } from 'express';
import * as analyticsRepo from '../db/analytics';
import * as ordersRepo from '../db/orders';
import * as productsRepo from '../db/products';
import * as reviewsRepo from '../db/reviews';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ORDER_STATUS, ORDER_STATUS_LABELS } from '../constants';
import { cache, resourceKeys } from '../services/cache';
import * as XLSX from 'xlsx';

export const periodWindows = (now = new Date()): { todayStart: Date; weekStart: Date; monthStart: Date } => {
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = (now.getUTCDay() + 6) % 7; // Monday = 0
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(todayStart.getUTCDate() - dayOfWeek);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { todayStart, weekStart, monthStart };
};

const daysAgo = (days: number) => new Date(Date.now() - days * 86400000);
const iso = (d: Date): string => d.toISOString().slice(0, 10);

export const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  const { todayStart, weekStart, monthStart } = periodWindows();
  const trend = await analyticsRepo.trend(daysAgo(30));
  const [totals, recent, byStatus, topProducts, today, week, month] = await Promise.all([
    analyticsRepo.totals(),
    analyticsRepo.recent(daysAgo(30)),
    analyticsRepo.statusBreakdown(),
    analyticsRepo.topProducts(),
    analyticsRepo.periodStats(todayStart),
    analyticsRepo.periodStats(weekStart),
    analyticsRepo.periodStats(monthStart),
  ]);

  const pending = byStatus.find((s) => s._id === ORDER_STATUS.PENDING)?.count ?? 0;
  const completed = byStatus.find((s) => s._id === ORDER_STATUS.COMPLETED)?.count ?? 0;

  res.json(
    new ApiResponse(200, {
      revenue: totals.revenue,
      netRevenue: totals.netRevenue,
      grossRevenue: totals.grossRevenue,
      discounts: totals.discounts,
      deliveryFees: totals.deliveryFees,
      orders: totals.orders,
      customers: totals.customers,
      products: totals.products,
      pendingOrders: pending,
      completedOrders: completed,
      cancelledOrders: totals.cancelledOrders,
      refundedOrders: totals.refundedOrders,
      complimentaryOrders: totals.complimentaryOrders,
      recentRevenue: recent.revenue,
      recentOrders: recent.orders,
      recentCustomers: recent.customers,
      revenueTrend: trend.slice(-7).map((d) => ({ date: d._id, revenue: d.revenue, orders: d.orders })),
      dailyStats: trend.map((d) => ({ date: d._id, revenue: d.revenue, orders: d.orders, unitsSold: d.unitsSold })),
      periodOverview: { today, week, month },
      statusBreakdown: byStatus.map((s) => ({ status: s._id, count: s.count })),
      topProducts,
    }),
  );
});

export const day = asyncHandler(async (req: Request, res: Response) => {
  const date = String(req.query.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError(400, 'A valid date (YYYY-MM-DD) is required');
  }
  const stats = await analyticsRepo.dayStats(date);
  res.json(new ApiResponse(200, { date, ...stats }));
});

/**
 * Fresh Data: clears the dashboard cache synchronously (so the next dashboard
 * GET is recomputed from the live database) and reports back. The actual data
 * is always computed from the DB — the cache layer only holds a 60s snapshot.
 */
export const refresh = asyncHandler(async (_req: Request, res: Response) => {
  const [exact, pattern] = resourceKeys('dashboard');
  await Promise.all([cache.del(exact), cache.delPattern(pattern)]);
  res.json(new ApiResponse(200, { ok: true }, 'Dashboard data refreshed'));
});

/**
 * Clear Stats: resets ONLY the dashboard statistics/aggregation layer. Business
 * records (orders, products, categories, customers, reviews) are never deleted.
 */
export const clear = asyncHandler(async (_req: Request, res: Response) => {
  await analyticsRepo.clearSalesStats();
  res.json(new ApiResponse(200, { ok: true }, 'Dashboard statistics reset'));
});

// ---------------------------------------------------------------------------
// Arabic Excel export
// ---------------------------------------------------------------------------

const MONEY = '#,##0.00" ج.م"';
const COUNT = '#,##0';
const RATING = '0.0';

const headerCell = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F2937' } } };

/** Styled worksheet with frozen header + autofilter + RTL-friendly widths. */
const sheetOf = (rows: (string | number)[][]): XLSX.WorkSheet => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  for (let c = 0; c < rows[0].length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = headerCell;
  }
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  if (rows.length > 1) {
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: rows[0].length - 1 } }),
    };
  }
  return ws;
};

const setFormat = (ws: XLSX.WorkSheet, r: number, c: number, z: string): void => {
  const cell = ws[XLSX.utils.encode_cell({ r, c })];
  if (cell && cell.t === 'n') cell.z = z;
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Formats a JS date as `YYYY-MM-DD HH:mm` (local time). */
const fmtDateTime = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const fmtDate = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const REVIEW_STATUS_AR: Record<string, string> = {
  pending: 'قيد المراجعة',
  published: 'منشور',
  hidden: 'مخفي',
};

export const exportStats = asyncHandler(async (req: Request, res: Response) => {
  const date = String(req.query.date ?? '');
  const period = String(req.query.period ?? 'today');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, 'A valid date (YYYY-MM-DD) is required');
  if (!['today', 'week', 'month'].includes(period)) throw new ApiError(400, 'Invalid period');

  const today = new Date();
  const todayIso = iso(today);
  const selectedDate = date && date <= todayIso ? date : todayIso;

  // Same calendar windows as the dashboard so exported figures match the screen.
  const { todayStart, weekStart, monthStart } = periodWindows();

  const [
    totals,
    recent,
    byStatus,
    top,
    todayStats,
    weekStats,
    monthStats,
    trend,
    dayStatsData,
    categoryData,
    reviewData,
    ordersPage,
    productsPage,
    customers,
    reviewsPage,
  ] = await Promise.all([
    analyticsRepo.totals(),
    analyticsRepo.recent(daysAgo(30)),
    analyticsRepo.statusBreakdown(),
    analyticsRepo.topProducts(),
    analyticsRepo.periodStats(todayStart),
    analyticsRepo.periodStats(weekStart),
    analyticsRepo.periodStats(monthStart),
    analyticsRepo.trend(daysAgo(30)),
    analyticsRepo.dayStats(selectedDate),
    analyticsRepo.categorySales(),
    reviewsRepo.adminStats(),
    ordersRepo.adminList(1, 500, '', ''),
    productsRepo.adminList(1, 1000, '', '', ''),
    analyticsRepo.customersBreakdown(),
    reviewsRepo.adminList(1, 500, '', '', '', '', '', 'newest', ''),
  ]);

  const reviewStats = reviewData as Record<string, unknown>;
  const periodMap = [
    { key: 'today', label: 'اليوم', stats: todayStats },
    { key: 'week', label: 'هذا الأسبوع', stats: weekStats },
    { key: 'month', label: 'هذا الشهر', stats: monthStats },
  ];

  const wb = XLSX.utils.book_new();
  // Right-to-left workbook so Arabic content lays out correctly in Excel.
  wb.Workbook = { Views: [{ RTL: true }] };

  // ---- Sheet 1: ملخص لوحة التحكم (المؤشر | القيمة) ----
  const summaryRows: (string | number)[][] = [
    ['المؤشر', 'القيمة'],
    ['الإيرادات الإجمالية', totals.revenue],
    ['صافي الإيرادات', totals.netRevenue],
    ['إجمالي الإيرادات', totals.grossRevenue],
    ['الخصومات', totals.discounts],
    ['رسوم التوصيل', totals.deliveryFees],
    ['إجمالي الطلبات', totals.orders],
    ['الطلبات المكتملة', totals.completedOrders],
    ['الطلبات الملغاة', totals.cancelledOrders],
    ['الطلبات المستردة', totals.refundedOrders],
    ['الطلبات المجانية', totals.complimentaryOrders],
    ['الطلبات المعلقة', byStatus.find((s) => s._id === 'pending')?.count ?? 0],
    ['إجمالي العملاء', totals.customers],
    ['إجمالي المنتجات', totals.products],
    ['إيرادات آخر ٣٠ يوم', recent.revenue],
    ['طلبات آخر ٣٠ يوم', recent.orders],
    ['عملاء جدد آخر ٣٠ يوم', recent.customers],
    ['إجمالي التقييمات', Number(reviewStats.total || 0)],
    ['متوسط التقييم', Number(reviewStats.average || 0)],
    ['تقييمات اليوم', Number(reviewStats.today || 0)],
    ['تقييمات ٥ نجوم', Number(reviewStats.fiveStar || 0)],
    ['تقييمات نجمة واحدة', Number(reviewStats.oneStar || 0)],
    [`إيرادات ${periodMap.find((p) => p.key === period)?.label ?? 'اليوم'}`, periodMap.find((p) => p.key === period)?.stats.revenue ?? todayStats.revenue],
    [`طلبات ${periodMap.find((p) => p.key === period)?.label ?? 'اليوم'}`, periodMap.find((p) => p.key === period)?.stats.orders ?? todayStats.orders],
    ['إيرادات اليوم المحدد', dayStatsData.revenue],
    ['طلبات اليوم المحدد', dayStatsData.orders],
  ];
  const summary = sheetOf(summaryRows);
  const moneyRows = [1, 2, 3, 4, 5, 14, 22, 24];
  for (let r = 1; r < summaryRows.length; r++) setFormat(summary, r, 1, moneyRows.includes(r) ? MONEY : RATING);
  for (const r of [6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 20, 21, 23, 25]) setFormat(summary, r, 1, COUNT);
  summary['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summary, 'ملخص لوحة التحكم');

  // ---- Sheet 2: الطلبات (real orders) ----
  const orderRows: (string | number)[][] = [
    ['رقم الطلب', 'اسم العميل', 'رقم الهاتف', 'المنتجات', 'الإجمالي', 'حالة الطلب', 'تاريخ الطلب', 'وقت الطلب'],
  ];
  for (const o of ordersPage.items) {
    const items = (Array.isArray(o.items) ? o.items : []) as Array<{ name: string; qty: number }>;
    const productsText = items.map((i) => `${i.name} × ${i.qty}`).join('\n');
    const created = new Date(String(o.createdAt ?? ''));
    orderRows.push([
      String(o.orderNo ?? ''),
      String(o.customerName ?? ''),
      String(o.phone ?? ''),
      productsText,
      Number(o.total) || 0,
      ORDER_STATUS_LABELS[String(o.status)]?.[0] ?? String(o.status ?? ''),
      fmtDate(created),
      fmtDateTime(created).slice(11),
    ]);
  }
  const ordersWs = sheetOf(orderRows);
  for (let r = 1; r < orderRows.length; r++) setFormat(ordersWs, r, 4, MONEY);
  ordersWs['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 34 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ordersWs, 'الطلبات');

  // ---- Sheet 3: المنتجات (real products) ----
  const productRows: (string | number)[][] = [
    ['معرّف المنتج', 'اسم المنتج', 'القسم', 'السعر', 'التقييم', 'عدد التقييمات', 'حالة التوفر', 'تاريخ الإضافة'],
  ];
  for (const p of productsPage.items) {
    const cat = (p.category as { name?: string; nameEn?: string } | null) ?? null;
    productRows.push([
      String(p._id ?? ''),
      String(p.name ?? ''),
      cat?.name ?? cat?.nameEn ?? '',
      Number(p.basePrice) || 0,
      Number(p.rating) || 0,
      Number(p.reviewsCount) || 0,
      p.isAvailable ? 'متاح' : 'غير متاح',
      p.createdAt ? fmtDate(new Date(String(p.createdAt))) : '',
    ]);
  }
  const productWs = sheetOf(productRows);
  for (let r = 1; r < productRows.length; r++) {
    setFormat(productWs, r, 3, MONEY);
    setFormat(productWs, r, 4, RATING);
    setFormat(productWs, r, 5, COUNT);
  }
  productWs['!cols'] = [{ wch: 40 }, { wch: 26 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, productWs, 'المنتجات');

  // ---- Sheet 4: العملاء (real customers) ----
  const customerRows: (string | number)[][] = [
    ['اسم العميل', 'رقم الهاتف', 'البريد الإلكتروني', 'عدد الطلبات', 'إجمالي الإنفاق', 'تاريخ التسجيل'],
  ];
  for (const c of customers) {
    customerRows.push([
      String(c.fullName ?? ''),
      String(c.phone ?? ''),
      String(c.email ?? ''),
      Number(c.orders) || 0,
      Number(c.totalSpent) || 0,
      c.createdAt ? fmtDate(new Date(String(c.createdAt))) : '',
    ]);
  }
  const customerWs = sheetOf(customerRows);
  for (let r = 1; r < customerRows.length; r++) {
    setFormat(customerWs, r, 3, COUNT);
    setFormat(customerWs, r, 4, MONEY);
  }
  customerWs['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, customerWs, 'العملاء');

  // ---- Sheet 5: التقييمات (real reviews) ----
  const reviewRows: (string | number)[][] = [
    ['معرّف التقييم', 'اسم العميل', 'الوجبة', 'عدد النجوم', 'التعليق', 'حالة التقييم', 'تاريخ التقييم'],
  ];
  for (const r of reviewsPage.items) {
    const user = (r.user as { fullName?: string } | null) ?? null;
    const product = (r.product as { name?: string } | null) ?? null;
    reviewRows.push([
      String(r._id ?? ''),
      user?.fullName ?? '',
      product?.name ?? '',
      Number(r.rating) || 0,
      String(r.comment ?? ''),
      REVIEW_STATUS_AR[String(r.status)] ?? String(r.status ?? ''),
      r.createdAt ? fmtDate(new Date(String(r.createdAt))) : '',
    ]);
  }
  const reviewWs = sheetOf(reviewRows);
  for (let r = 1; r < reviewRows.length; r++) setFormat(reviewWs, r, 3, COUNT);
  reviewWs['!cols'] = [{ wch: 40 }, { wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, reviewWs, 'التقييمات');

  // ---- Sheet 6: الإيرادات (daily trend) ----
  const revenueRows: (string | number)[][] = [['التاريخ', 'الإيرادات', 'عدد الطلبات', 'الوحدات المباعة']];
  for (const d of trend) {
    revenueRows.push([String(d._id), Number(d.revenue) || 0, Number(d.orders) || 0, Number(d.unitsSold) || 0]);
  }
  const revenueWs = sheetOf(revenueRows);
  for (let r = 1; r < revenueRows.length; r++) {
    setFormat(revenueWs, r, 1, MONEY);
    setFormat(revenueWs, r, 2, COUNT);
    setFormat(revenueWs, r, 3, COUNT);
  }
  revenueWs['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, revenueWs, 'الإيرادات');

  // ---- Sheet 7: المبيعات (period sales) ----
  const salesRows: (string | number)[][] = [
    ['الفترة', 'الإيرادات', 'الطلبات', 'الوحدات المباعة', 'العملاء'],
    ['كل الفترات', totals.revenue, totals.orders, top.reduce((a, p) => a + Number(p.count), 0), totals.customers],
  ];
  for (const p of periodMap) {
    salesRows.push([p.label, p.stats.revenue, p.stats.orders, p.stats.unitsSold, p.stats.customers]);
  }
  const salesWs = sheetOf(salesRows);
  for (let r = 1; r < salesRows.length; r++) {
    setFormat(salesWs, r, 1, MONEY);
    for (const c of [2, 3, 4]) setFormat(salesWs, r, c, COUNT);
  }
  salesWs['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, salesWs, 'المبيعات');

  // ---- Sheet 8: التحليلات (status + top products + categories) ----
  const statusRows: (string | number)[][] = [['حالة الطلب', 'العدد']];
  for (const s of byStatus) {
    statusRows.push([ORDER_STATUS_LABELS[s._id]?.[0] ?? s._id, s.count]);
  }
  const topRows: (string | number)[][] = [['المنتج', 'الكمية', 'الإيرادات']];
  for (const p of top) {
    topRows.push([String(p._id), Number(p.count) || 0, Number(p.revenue) || 0]);
  }
  const catRows: (string | number)[][] = [['القسم', 'الوحدات', 'الإيرادات']];
  for (const c of categoryData) {
    catRows.push([String(c.name), Number(c.units) || 0, Number(c.revenue) || 0]);
  }

  const analyticsAoa: (string | number)[][] = [...statusRows, [''], ['الأكثر مبيعاً'], ...topRows.slice(1), [''], ['المبيعات حسب القسم'], ...catRows.slice(1)];
  const analyticsWs = XLSX.utils.aoa_to_sheet(analyticsAoa);
  for (let c = 0; c < 3; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (analyticsWs[addr]) analyticsWs[addr].s = headerCell;
  }
  const sectionTitle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '374151' } } };
  const titleRowStatus = statusRows.length;
  const titleRowTop = statusRows.length + 2;
  const titleRowCat = statusRows.length + 2 + topRows.length;
  for (const r of [titleRowStatus, titleRowTop, titleRowCat]) {
    const addr = XLSX.utils.encode_cell({ r, c: 0 });
    if (analyticsWs[addr]) analyticsWs[addr].s = sectionTitle;
  }
  // Format numeric columns: counts in col 1 for status/top, money in col 2 for top/categories.
  for (let r = 1; r < statusRows.length; r++) setFormat(analyticsWs, r, 1, COUNT);
  for (let r = 0; r < topRows.length - 1; r++) {
    const rr = statusRows.length + 2 + r;
    setFormat(analyticsWs, rr, 1, COUNT);
    setFormat(analyticsWs, rr, 2, MONEY);
  }
  for (let r = 0; r < catRows.length - 1; r++) {
    const rr = statusRows.length + 2 + topRows.length + r;
    setFormat(analyticsWs, rr, 1, COUNT);
    setFormat(analyticsWs, rr, 2, MONEY);
  }
  analyticsWs['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, analyticsWs, 'التحليلات');

  // Meaningful dynamic filename: plain date for Today, date range otherwise.
  const filename =
    period === 'today'
      ? `dashboard-report-${selectedDate}.xlsx`
      : `dashboard-report-${iso(period === 'week' ? weekStart : monthStart)}-to-${selectedDate}.xlsx`;
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});
