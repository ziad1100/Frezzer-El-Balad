import { describe, expect, it } from 'vitest';
import { query } from '../../db';
import { api, bearer, createUser, seedRoles } from '../helpers';
import * as XLSX from 'xlsx';

const EXPORT = '/api/v1/analytics/export';

const parseXlsx = (res: { on: (e: string, c: (c: Buffer) => void) => void }, cb: (err: Error | null, data: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

const getXlsx = (headers: Record<string, string>) =>
  api.get(EXPORT).set(headers).buffer(true).parse((res, cb) => parseXlsx(res, cb));

const getXlsxQuery = (query: Record<string, string>, headers: Record<string, string>) =>
  api.get(EXPORT).query(query).set(headers).buffer(true).parse((res, cb) => parseXlsx(res, cb));

describe('analytics export', () => {
  it('returns a valid xlsx workbook for admins', async () => {
    await seedRoles();
    const admin = await createUser({ role: 'admin' });
    const customer = await createUser({ role: 'customer' });

    const res = await api.get(EXPORT).set(bearer(customer.id)).expect(403);
    expect(res.status).toBe(403);

    const ok = await getXlsx(bearer(admin.id)).expect(200);
    expect(ok.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(String(ok.headers['content-disposition'])).toMatch(/dashboard-report-.*\.xlsx/);

    const body = ok.body as Buffer;
    expect(body.length).toBeGreaterThan(100);
    expect(body.subarray(0, 2).toString('latin1')).toBe('PK');

    const wb = XLSX.read(body, { type: 'buffer' });
    const sheets = wb.SheetNames;
    expect(sheets).toContain('ملخص لوحة التحكم');
    expect(sheets).toContain('الطلبات');
    expect(sheets).toContain('المنتجات');
    expect(sheets).toContain('العملاء');
    expect(sheets).toContain('التقييمات');
    expect(sheets).toContain('الإيرادات');
    expect(sheets).toContain('المبيعات');
    expect(sheets).toContain('التحليلات');

    const summary = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['ملخص لوحة التحكم']);
    const metrics = summary.map((r) => Object.values(r)[0]);
    expect(metrics).toContain('الإيرادات الإجمالية');
    expect(metrics).toContain('إجمالي الطلبات');
    expect(metrics).toContain('إجمالي العملاء');
    expect(metrics).toContain('إجمالي المنتجات');
  });

  it('rejects invalid date and period', async () => {
    await seedRoles();
    const admin = await createUser({ role: 'admin' });
    await api.get(EXPORT).query({ date: 'not-a-date' }).set(bearer(admin.id)).expect(400);
    await api.get(EXPORT).query({ period: 'year' }).set(bearer(admin.id)).expect(400);
  });

  it('exports data on a fresh database without orders', async () => {
    await seedRoles();
    const admin = await createUser({ role: 'admin' });
    await query('DELETE FROM orders');
    await query('DELETE FROM reviews');
    const res = await getXlsx(bearer(admin.id)).expect(200);
    const wb = XLSX.read(res.body as Buffer, { type: 'buffer' });
    const summary = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['ملخص لوحة التحكم']);
    const rev = summary.find((r) => Object.values(r)[0] === 'الإيرادات الإجمالية');
    expect(rev ? Object.values(rev)[1] : 0).toBe(0);
  });

  it('matches the dashboard period values (calendar windows) and uses dated filenames', async () => {
    await seedRoles();
    const admin = await createUser({ role: 'admin' });
    await query('DELETE FROM orders');
    // A single completed order created now (inside every calendar period window).
    await query(
      `INSERT INTO orders ("orderNo", "userId", status, subtotal, "deliveryFee", discount, total, "paymentMethod", "paymentStatus", phone)
       VALUES ($1, $2::uuid, 'completed', 100, 10, 0, 110, 'cash', 'paid', '01000000000')`,
      [`EXP-${Date.now()}`, admin.id],
    );

    const dash = await api.get('/api/v1/analytics/dashboard').set(bearer(admin.id)).expect(200);
    const periodOverview = dash.body.data.periodOverview as Record<string, { revenue: number; orders: number }>;

    // Week: range-form filename + values equal to the dashboard's calendar week.
    const res = await getXlsxQuery({ period: 'week' }, bearer(admin.id)).expect(200);
    expect(String(res.headers['content-disposition'])).toMatch(
      /dashboard-report-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.xlsx/,
    );
    const wb = XLSX.read(res.body as Buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['المبيعات']);
    const weekRow = rows.find((r) => Object.values(r)[0] === 'هذا الأسبوع');
    expect(Number(Object.values(weekRow ?? {})[1])).toBe(periodOverview.week.revenue);
    expect(Number(Object.values(weekRow ?? {})[2])).toBe(periodOverview.week.orders);
    const todayRow = rows.find((r) => Object.values(r)[0] === 'اليوم');
    expect(Number(Object.values(todayRow ?? {})[1])).toBe(periodOverview.today.revenue);

    // Today: plain date filename.
    const res2 = await getXlsxQuery({ period: 'today' }, bearer(admin.id)).expect(200);
    expect(String(res2.headers['content-disposition'])).toMatch(/dashboard-report-\d{4}-\d{2}-\d{2}\.xlsx/);
  });
});