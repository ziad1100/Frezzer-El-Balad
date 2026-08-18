import Redis from 'ioredis';
import env from '../config/env';

const TTL_SECONDS = {
  products: 60,
  categories: 300,
  offers: 60,
  branches: 300,
  settings: 300,
  zones: 300,
  posts: 60,
  banners: 60,
  gallery: 300,
  dashboard: 60,
  reviews: 60,
} as const;

export type CacheResource = keyof typeof TTL_SECONDS;

let client: Redis | null = null;
let available = false;

const buildClient = (): Redis => {
  const redis = new Redis(env.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2_000,
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 1_000)),
  });
  redis.on('ready', () => {
    available = true;
    console.log('[cache] redis connected');
  });
  redis.on('error', (err) => {
    if (available) console.warn(`[cache] redis error: ${err.message}`);
    available = false;
  });
  redis.on('close', () => {
    available = false;
  });
  void redis.connect().catch(() => {
    available = false;
  });
  return redis;
};

const getClient = (): Redis | null => {
  if (!client && env.redisUrl) client = buildClient();
  return available ? client : null;
};

export const cacheEnabled = (): boolean => Boolean(getClient());

export const cache = {
  isEnabled: cacheEnabled,

  async get<T>(key: string): Promise<T | null> {
    const c = getClient();
    if (!c) return null;
    try {
      const raw = await c.get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSec?: number): Promise<void> {
    const c = getClient();
    if (!c) return;
    try {
      await c.set(key, JSON.stringify(value), 'EX', ttlSec ?? TTL_SECONDS.products);
    } catch {
      /* swallow: cache is best-effort */
    }
  },

  async del(...keys: string[]): Promise<void> {
    const c = getClient();
    if (!c) return;
    try {
      await c.del(...keys);
    } catch {
      /* swallow */
    }
  },

  async delPattern(pattern: string): Promise<void> {
    const c = getClient();
    if (!c) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await c.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        if (keys.length) await c.del(...keys);
      } while (cursor !== '0');
    } catch {
      /* swallow */
    }
  },
};

export const resourceKey = (resource: CacheResource, suffix = ''): string =>
  `api:${resource}${suffix ? `:${suffix}` : ''}`;

export const resourceKeys = (resource: CacheResource): string[] => [
  resourceKey(resource),
  `${resourceKey(resource)}:*`,
];

export const ttlFor = (resource: CacheResource): number => TTL_SECONDS[resource];

export const disconnectCache = async (): Promise<void> => {
  if (client) {
    await Promise.resolve(client.disconnect()).catch(() => undefined);
    client = null;
    available = false;
  }
};