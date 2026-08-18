import { describe, expect, it } from 'vitest';
import { api, seedRoles } from '../helpers';

const NEWSLETTER = '/api/v1/newsletter';

describe('newsletter rate limiting (P6)', () => {
  it('returns 429 after the 10th subscription attempt within the window', async () => {
    await seedRoles();
    let last = 0;
    for (let i = 0; i < 12; i += 1) {
      const res = await api
        .post(`${NEWSLETTER}/subscribe`)
        .send({ email: `spam${i}@example.test`, name: 'Spam' });
      expect([200, 201, 429]).toContain(res.status);
      last = res.status;
    }
    expect(last).toBe(429);
  });
});