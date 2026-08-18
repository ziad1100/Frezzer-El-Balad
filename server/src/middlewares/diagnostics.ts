import type { NextFunction, Request, RequestHandler, Response } from 'express';
import crypto from 'node:crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

interface Slice {
  count: number;
  totalMs: number;
  samples: number[];
  maxMs: number;
}

const slices = new Map<string, Slice>();
const MAX_SAMPLES_PER_ROUTE = 2000;
const SLICE_WINDOW_MS = 60_000;

let lastWindow = Date.now();

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

export const recordLatency = (route: string, ms: number): void => {
  const now = Date.now();
  if (now - lastWindow > SLICE_WINDOW_MS) {
    slices.clear();
    lastWindow = now;
  }
  let slice = slices.get(route);
  if (!slice) {
    slice = { count: 0, totalMs: 0, samples: [], maxMs: 0 };
    slices.set(route, slice);
  }
  slice.count += 1;
  slice.totalMs += ms;
  if (ms > slice.maxMs) slice.maxMs = ms;
  if (slice.samples.length < MAX_SAMPLES_PER_ROUTE) slice.samples.push(ms);
};

export const requestIdMiddleware: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  req.id = crypto.randomUUID();
  next();
};

export const latencyMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const started = performance.now();
  res.on('finish', () => {
    const ms = performance.now() - started;
    recordLatency(`${req.method} ${req.route?.path ?? req.path}`, ms);
  });
  next();
};

export const reportLatencies = (): string => {
  if (slices.size === 0) return '[perf] no latency data recorded yet';
  const lines = ['[perf] route latency (avg / p50 / p90 / p95 / p99 ms)'];
  const entries = [...slices.entries()].sort((a, b) => b[1].totalMs - a[1].totalMs);
  for (const [route, slice] of entries) {
    const sorted = [...slice.samples].sort((a, b) => a - b);
    const avg = slice.totalMs / slice.count;
    const pad = route.length < 60 ? 60 - route.length : 1;
    lines.push(
      `  ${route}${' '.repeat(pad)}n=${String(slice.count).padStart(5)} avg=${avg.toFixed(1)} p50=${percentile(sorted, 50).toFixed(1)} p90=${percentile(sorted, 90).toFixed(1)} p95=${percentile(sorted, 95).toFixed(1)} p99=${percentile(sorted, 99).toFixed(1)} max=${slice.maxMs.toFixed(1)}`,
    );
  }
  return lines.join('\n');
};

export const perfSummaryTimer = (intervalMs = 60_000, logger: (line: string) => void): void => {
  const timer = setInterval(() => logger(reportLatencies()), intervalMs);
  timer.unref();
  return undefined;
};