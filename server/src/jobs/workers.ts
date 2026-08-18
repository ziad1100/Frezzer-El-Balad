import { Worker } from 'bullmq';
import env from '../config/env';
import { getAnalyticsQueue, buildRedisConnection, ANALYTICS_QUEUE, EMAIL_QUEUE } from './queue';
import { dispatchEmailJob } from '../services/email.service';
import * as analyticsRepo from '../db/analytics';
import { cache, resourceKey, resourceKeys } from '../services/cache';

const ROLLUP_DAYS = 30;
const ROLLUP_CRON = '*/15 * * * *';
const ROLLUP_TZ = 'UTC';

let emailWorker: Worker | null = null;
let analyticsWorker: Worker | null = null;
let started = false;

export const startWorkers = async (): Promise<void> => {
  if (started) return;
  if (!env.redisUrl) {
    console.log('[jobs] REDIS_URL not configured; workers disabled (emails send inline)');
    return;
  }

  emailWorker = new Worker(
    EMAIL_QUEUE,
    async (job) => {
      if (job.name.startsWith('notification.')) {
        await dispatchEmailJob({ name: job.name, data: job.data as Record<string, unknown> });
      }
    },
    { connection: buildRedisConnection(), concurrency: 3 },
  );

  analyticsWorker = new Worker(
    ANALYTICS_QUEUE,
    async (job) => {
      if (job.name === 'rollup') {
        const days = Number((job.data as { days?: number })?.days) || ROLLUP_DAYS;
        await analyticsRepo.rollupDailyStats(days);
        await cache.del(...resourceKeys('dashboard'), resourceKey('dashboard', 'dashboard'));
        await cache.delPattern(`${resourceKey('dashboard')}:*`);
        console.log(`[jobs] analytics rollup complete (last ${days} days)`);
      }
    },
    { connection: buildRedisConnection(), concurrency: 1 },
  );

  emailWorker.on('failed', (job, err) => {
    console.error(`[jobs] email job ${job?.id} failed: ${err.message}`);
  });
  analyticsWorker.on('failed', (job, err) => {
    console.error(`[jobs] analytics job ${job?.id} failed: ${err.message}`);
  });

  await Promise.all([emailWorker.waitUntilReady(), analyticsWorker.waitUntilReady()]);

  const queue = getAnalyticsQueue();
  if (queue) {
    await queue.upsertJobScheduler(
      'analytics-rolling',
      { pattern: ROLLUP_CRON, tz: ROLLUP_TZ },
      { name: 'rollup', data: { days: ROLLUP_DAYS } },
    );
    await queue.add('rollup', { days: ROLLUP_DAYS }, { jobId: 'rollup-boot' });
  }

  started = true;
  console.log(`[jobs] workers ready (email, analytics ${ROLLUP_CRON} ${ROLLUP_TZ})`);
};

export const stopWorkers = async (): Promise<void> => {
  if (!started) return;
  started = false;
  await Promise.allSettled(
    [emailWorker, analyticsWorker].filter(Boolean).map((w) => (w as Worker).close()),
  );
  emailWorker = null;
  analyticsWorker = null;
};