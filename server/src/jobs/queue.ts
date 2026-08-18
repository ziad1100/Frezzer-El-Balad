import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import env from '../config/env';

export const EMAIL_QUEUE = 'orabi-email';
export const ANALYTICS_QUEUE = 'orabi-analytics';

export const buildRedisConnection = (): Redis => {
  const redis = new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 2_000,
    retryStrategy: (times: number) => (times > 5 ? null : Math.min(times * 500, 2_000)),
  });
  return redis;
};

let emailQueue: Queue | null = null;
let analyticsQueue: Queue | null = null;

export const getEmailQueue = (): Queue | null => {
  if (!env.redisUrl) return null;
  if (!emailQueue) emailQueue = new Queue(EMAIL_QUEUE, { connection: buildRedisConnection() });
  return emailQueue;
};

export const getAnalyticsQueue = (): Queue | null => {
  if (!env.redisUrl) return null;
  if (!analyticsQueue) analyticsQueue = new Queue(ANALYTICS_QUEUE, { connection: buildRedisConnection() });
  return analyticsQueue;
};

export const closeQueues = async (): Promise<void> => {
  await Promise.allSettled(
    [emailQueue, analyticsQueue].filter(Boolean).map((q) => (q as Queue).close()),
  );
  emailQueue = null;
  analyticsQueue = null;
};