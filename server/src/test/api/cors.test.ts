import { describe, expect, it } from 'vitest';
import { api } from '../helpers';

const preflight = (origin: string) =>
  api
    .options('/api/v1/auth/login')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type,authorization');

describe('CORS', () => {
  it('allows the configured CLIENT_URL origin', async () => {
    const res = await preflight('http://localhost:5173').expect(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows loopback and private-network (LAN) origins so the admin works from other devices', async () => {
    const origins = [
      'http://127.0.0.1:5173',
      'http://192.168.100.49:5173',
      'http://192.168.1.10:5000',
      'http://10.0.0.5:5173',
      'http://172.16.3.9:3000',
      'http://169.254.10.20:5000',
    ];
    for (const origin of origins) {
      const res = await preflight(origin).expect(204);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    }
  });

  it('rejects public-internet origins', async () => {
    await preflight('https://evil.example.com').expect(500);
    await preflight('https://admin.example.com').expect(500);
  });
});
