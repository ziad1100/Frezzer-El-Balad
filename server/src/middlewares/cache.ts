import type { NextFunction, Request, Response } from 'express';
import { cache, resourceKey, resourceKeys, ttlFor, type CacheResource } from '../services/cache';

interface CacheOptions {
  resource: CacheResource;
  ttl?: number;
  suffix?: string | ((req: Request) => string);
  vary?: string[];
  skip?: (req: Request) => boolean;
}

export const cached = ({ resource, ttl, suffix, vary, skip }: CacheOptions) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!cache.isEnabled() || skip?.(req)) {
      next();
      return;
    }

    const resolvedSuffix = typeof suffix === 'function' ? suffix(req) : (suffix ?? '');
    const key = resourceKey(resource, resolvedSuffix);
    const ttlSec = ttl ?? ttlFor(resource);
    res.setHeader('Cache-Control', `public, max-age=${ttlSec}`);

    try {
      const hit = await cache.get<unknown>(key);
      if (hit !== null) {
        res.setHeader('X-Cache', 'HIT');
        res.json(hit);
        return;
      }
    } catch {
      next();
      return;
    }

    res.setHeader('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void cache.set(key, body, ttlSec);
      }
      return originalJson(body);
    }) as Response['json'];

    if (vary?.length) {
      const current = res.getHeader('Vary');
      res.setHeader('Vary', current ? [current, ...vary].join(', ') : vary.join(', '));
    }

    next();
  };
};

export const setCacheControl = (maxAgeSeconds: number) => {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Cache-Control', `public, max-age=${maxAgeSeconds}`);
    next();
  };
};

/**
 * Invalidates all cache entries for the given resources after a successful write.
 * Place after route handlers; async so it never blocks the response on a slow Redis.
 */
export const invalidateCache = (...resources: CacheResource[]) => {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    const onFinish = async (): Promise<void> => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await Promise.all(
          resources.flatMap((r) => {
            const [exact, pattern] = resourceKeys(r);
            return [cache.del(exact), cache.delPattern(pattern)];
          }),
        );
      }
    };
    res.on('finish', () => {
      void onFinish();
    });
    next();
  };
};