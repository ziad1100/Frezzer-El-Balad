import { describe, expect, it } from 'vitest';
import { redactBody } from './activityLogger';

describe('redactBody (S5)', () => {
  it('redacts sensitive values at any depth and keeps safe data', () => {
    const out = redactBody({
      email: 'a@b.test',
      password: 'p1',
      newToken: 'jwt-1',
      profile: { fullName: 'Ali', passwordHash: 'h', favorites: 3 },
      items: [{ name: 'Pepperoni', resetToken: 'rz' }],
    })!;
    expect(out.email).toBe('a@b.test');
    expect(out.password).toBe('[REDACTED]');
    expect(out.newToken).toBe('[REDACTED]');
    expect(out.profile).toEqual({ fullName: 'Ali', passwordHash: '[REDACTED]', favorites: 3 });
    expect(out.items).toEqual([{ name: 'Pepperoni', resetToken: '[REDACTED]' }]);
  });

  it('returns undefined for empty or non-object bodies', () => {
    expect(redactBody(undefined)).toBeUndefined();
    expect(redactBody('text')).toBeUndefined();
  });
});