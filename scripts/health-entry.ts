// Bundled by `npm run build:api` into server/dist/health.js — the runtime
// dependency of the Vercel serverless function api/health.js. Serves /health
// (liveness) and /health/ready (readiness — DB + Redis), matching the container
// behaviour. No secrets, no env values, no stack traces.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pool } from '../server/src/db';
import env from '../server/src/config/env';
import { cacheEnabled } from '../server/src/services/cache';

export const config = { maxDuration: 60 };

const send = (res: ServerResponse, status: number, body: unknown): void => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? '';
  if (url.endsWith('/health/ready')) {
    const checks: { database: string; redis: string } = { database: 'down', redis: 'disabled' };
    let ready = true;
    try {
      await pool.query('SELECT 1');
      checks.database = 'up';
    } catch {
      ready = false;
    }
    if (!env.redisUrl) {
      checks.redis = 'disabled';
    } else if (cacheEnabled()) {
      checks.redis = 'up';
    } else {
      checks.redis = 'down';
      ready = false;
    }
    send(res, ready ? 200 : 503, {
      success: ready,
      statusCode: ready ? 200 : 503,
      message: 'OK',
      data: { status: ready ? 'ok' : 'degraded', checks },
    });
    return;
  }
  send(res, 200, { success: true, statusCode: 200, message: 'OK', data: { status: 'ok' } });
}
