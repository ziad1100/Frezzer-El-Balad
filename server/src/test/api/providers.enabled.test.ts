import { afterEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

afterEach(() => {
  vi.unstubAllEnvs();
});

it('registers and reports enabled providers when env vars are set', async () => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
  vi.stubEnv('FACEBOOK_CLIENT_ID', '');
  vi.stubEnv('FACEBOOK_CLIENT_SECRET', '');
  const { default: app } = (await import('../../app')) as { default: Express };
  const api = request(app);
  const providers = await api.get('/api/v1/auth/providers');
  expect(providers.status).toBe(200);
  expect(providers.body).toEqual({ google: true, facebook: false });
  const google = await api.get('/api/v1/auth/google');
  expect(google.status).toBe(302);
  expect(google.headers.location).toContain('accounts.google.com');
  expect((await api.get('/api/v1/auth/facebook')).status).toBe(404);
});