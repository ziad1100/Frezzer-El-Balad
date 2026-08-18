import express from 'express';
import request from 'supertest';
import * as XLSX from 'xlsx';
import analyticsRoutes from './src/routes/analytics.routes';
import { signAccessToken } from './src/utils/token';
import { query } from './src/db';

const app = express();
app.use(express.json());
app.use('/api/v1/analytics', analyticsRoutes);

(async () => {
  try {
    const admin = (await query<{ id: string }>(`SELECT id FROM users WHERE email = 'admin@pizzahouse.dev'`))[0];
    const token = signAccessToken(admin.id);
    const exportRes = await request(app)
      .get('/api/v1/analytics/export')
      .query({ period: 'month', date: '2026-08-11' })
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    console.log('status:', exportRes.status, '| bytes:', (exportRes.body as Buffer).length);
    const wb = XLSX.read(exportRes.body as Buffer, { type: 'buffer' });
    console.log('sheets ok:', wb.SheetNames.length === 8);
    console.log('Orders sheet:', JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets['الطلبات'], { header: 1, defval: '' })));
  } catch (e) {
    console.log('SMOKE ERROR:', (e as Error).message);
    process.exitCode = 1;
  } finally {
    process.exit(0);
  }
})();