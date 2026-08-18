import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../services/cache', () => {
  const store = new Map<string, string>();
  return {
    cache: {
      isEnabled: vi.fn(() => true),
      get: vi.fn(async (key: string) => {
        const raw = store.get(key);
        return raw === undefined ? null : JSON.parse(raw);
      }),
      set: vi.fn(async (key: string, value: unknown) => {
        store.set(key, JSON.stringify(value));
      }),
      del: vi.fn(async (...keys: string[]) => {
        for (const k of keys) store.delete(k);
      }),
      delPattern: vi.fn(async (pattern: string) => {
        const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
        for (const k of [...store.keys()]) {
          if (k.startsWith(prefix)) store.delete(k);
        }
      }),
    },
    resourceKey: (resource: string, suffix = '') => `api:${resource}${suffix ? `:${suffix}` : ''}`,
    resourceKeys: (resource: string) => [`api:${resource}`, `api:${resource}:*`],
    ttlFor: () => 60,
  };
});

import { cached, invalidateCache } from '../../middlewares/cache';

const buildApp = () => {
  const app = express();
  app.get('/', cached({ resource: 'products' }), (_req, res) => res.json({ id: 'p1', name: 'Pizza' }));
  app.post('/writers', invalidateCache('products', 'categories'), (_req, res) => res.status(200).json({ ok: true }));
  return app;
};

describe('cache middleware', () => {
  it('serves MISS then HIT on repeated requests', async () => {
    const app = buildApp();
    const first = await request(app).get('/');
    expect(first.status).toBe(200);
    expect(first.headers['x-cache']).toBe('MISS');
    expect(first.headers['cache-control']).toBe('public, max-age=60');
    expect(first.body).toEqual({ id: 'p1', name: 'Pizza' });

    const second = await request(app).get('/');
    expect(second.status).toBe(200);
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.body).toEqual({ id: 'p1', name: 'Pizza' });
  });

  it('does not cache when disabled', async () => {
    const { cache } = await import('../../services/cache');
    vi.mocked(cache.isEnabled).mockReturnValue(false);
    const app = buildApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['x-cache']).toBeUndefined();
  });

  it('invalidates cached resources after a controller ends the response', async () => {
    const { cache } = await import('../../services/cache');
    const app = buildApp();
    await request(app).post('/writers').expect(200);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(cache.del).toHaveBeenCalledWith('api:products');
    expect(cache.del).toHaveBeenCalledWith('api:categories');
    expect(cache.delPattern).toHaveBeenCalledWith('api:products:*');
    expect(cache.delPattern).toHaveBeenCalledWith('api:categories:*');
  });
});