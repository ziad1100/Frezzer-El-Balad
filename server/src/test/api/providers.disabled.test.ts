import { afterEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

afterEach(() => {
  vi.unstubAllEnvs();
});

it('reports disabled providers and hides their routes when env vars are unset', async () => {
  vi.stubEnv('GOOGLE_CLIENT_ID', '');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
  vi.stubEnv('FACEBOOK_CLIENT_ID', '');
  vi.stubEnv('FACEBOOK_CLIENT_SECRET', '');
  const { default: app } = (await import('../../app')) as { default: Express };
  const api = request(app);
  const providers = await api.get('/api/v1/auth/providers');
  expect(providers.status).toBe(200);
  expect(providers.body).toEqual({ google: false, facebook: false });
  expect((await api.get('/api/v1/auth/google')).status).toBe(404);
  expect((await api.get('/api/v1/auth/facebook')).status).toBe(404);
});
