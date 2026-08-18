import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import env from './config/env';
import { corsOptions } from './config/cors';
import { sanitizeJson } from './middlewares/sanitize';
import { notFound } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';
import { uploadsDir } from './middlewares/upload';
import { requestIdMiddleware, latencyMiddleware } from './middlewares/diagnostics';
import { pool } from './db';
import { cacheEnabled } from './services/cache';
import routes from './routes';
import { asyncHandler } from './utils/asyncHandler';
import { ApiResponse } from './utils/ApiResponse';

const app = express();

app.disable('x-powered-by');

app.use(requestIdMiddleware);
app.use(latencyMiddleware);

app.use(helmet());
const corsHandler = cors(corsOptions);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const host = req.get('host');
  let sameOrigin = false;
  if (origin && host) {
    try {
      sameOrigin = new URL(origin).host === host;
    } catch {
      sameOrigin = false;
    }
  }
  if (!origin || sameOrigin) return next();
  corsHandler(req, res, next);
});
app.options('*', corsHandler);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use('/uploads', express.static(uploadsDir));

app.use(sanitizeJson);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(env.isProd ? 'combined' : 'dev'));
}

const API_WINDOW_MS = Number(process.env.API_WINDOW_MS) || 15 * 60 * 1000;
const API_LIMIT = Number(process.env.API_LIMIT) || 300;
const apiLimiter = rateLimit({
  windowMs: API_WINDOW_MS,
  limit: API_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: () => process.env.DISABLE_RATE_LIMIT === '1',
});
app.use('/api', apiLimiter);

// ---------------------------------------------------------------------------
// Health checks — outside the /api limiter and the SPA catch-all. No secrets,
// no env vars, no stack traces. `/health` = liveness, `/health/ready` =
// readiness (DB + Redis).
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json(new ApiResponse(200, { status: 'ok' }));
});

app.get(
  '/health/ready',
  asyncHandler(async (_req, res) => {
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

    res.status(ready ? 200 : 503).json(new ApiResponse(ready ? 200 : 503, { status: ready ? 'ok' : 'degraded', checks }));
  }),
);

app.use('/api/v1', routes);

const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist');
const clientIndex = path.join(clientDist, 'index.html');
if (process.env.NODE_ENV === 'production' && fs.existsSync(clientIndex)) {
  app.use(express.static(clientDist, { maxAge: '7d', immutable: true, setHeaders: (res, filePath) => {
    const normalized = filePath.replace(/\\/g, '/');
    if (normalized.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    else if (normalized.includes('/images/')) res.setHeader('Cache-Control', 'public, max-age=3600');
  } }));
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
    res.sendFile(clientIndex);
  });
  console.log(`[client] serving production build from ${clientDist}`);
}

app.use(notFound);
app.use(errorHandler);

export default app;