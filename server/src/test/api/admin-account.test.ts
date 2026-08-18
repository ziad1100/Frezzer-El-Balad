import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as usersRepo from '../../db/users';
import { enqueueEmailChangeVerification } from '../../services/email.service';
import { api, bearer, createUser, seedRoles, toId } from '../helpers';

vi.mock('../../middlewares/rateLimiter', () => {
  const pass = (_req: unknown, _res: unknown, next: () => void) => next();
  return {
    authLimiter: pass,
    subscribeLimiter: pass,
    contactLimiter: pass,
    adminApiLimiter: pass,
    reviewsLimiter: pass,
  };
});

vi.mock('../../services/email.service', () => ({
  enqueueVerificationEmail: vi.fn(),
  enqueuePasswordResetOtp: vi.fn(),
  enqueueEmailChangeVerification: vi.fn(),
}));

const emailChangeMock = vi.mocked(enqueueEmailChangeVerification);

const AUTH = '/api/v1/auth';

const loginCookie = async (email: string, password: string): Promise<string> => {
  const res = await api.post(`${AUTH}/login`).send({ email, password });
  const cookies = res.headers['set-cookie'] as unknown as string[];
  return cookies.find((c) => c.startsWith('refreshToken='))!.split(';')[0];
};

describe('change email (admin account settings)', () => {
  beforeEach(async () => {
    await seedRoles();
    emailChangeMock.mockClear();
  });

  it('requires authentication', async () => {
    const res = await api
      .post(`${AUTH}/change-email`)
      .send({ email: 'new@example.com', confirmEmail: 'new@example.com', currentPassword: 'Pizza123!' });
    expect(res.status).toBe(401);
  });

  it('rejects non-admin roles with 403', async () => {
    const user = await createUser({ role: 'customer' });
    const res = await api
      .post(`${AUTH}/change-email`)
      .set(bearer(toId(user.id)))
      .send({ email: 'new@example.com', confirmEmail: 'new@example.com', currentPassword: 'Pizza123!' });
    expect(res.status).toBe(403);
  });

  it('rejects mismatching confirmation emails with 422', async () => {
    const user = await createUser({ role: 'admin' });
    const res = await api
      .post(`${AUTH}/change-email`)
      .set(bearer(toId(user.id)))
      .send({ email: 'new@example.com', confirmEmail: 'other@example.com', currentPassword: 'Pizza123!' });
    expect(res.status).toBe(422);
  });

  it('rejects a wrong current password with 400', async () => {
    const user = await createUser({ role: 'admin' });
    const res = await api
      .post(`${AUTH}/change-email`)
      .set(bearer(toId(user.id)))
      .send({ email: 'new@example.com', confirmEmail: 'new@example.com', currentPassword: 'WrongPass1' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Current password is incorrect');
  });

  it('rejects an email that is already registered with 409', async () => {
    const admin = await createUser({ role: 'admin' });
    await createUser({ role: 'admin', email: 'taken@example.com' });
    const res = await api
      .post(`${AUTH}/change-email`)
      .set(bearer(toId(admin.id)))
      .send({ email: 'taken@example.com', confirmEmail: 'taken@example.com', currentPassword: 'Pizza123!' });
    expect(res.status).toBe(409);
  });

  it('applies the change immediately when SMTP is not configured', async () => {
    const user = await createUser({ role: 'admin' });
    const res = await api
      .post(`${AUTH}/change-email`)
      .set(bearer(toId(user.id)))
      .send({ email: 'fresh-admin@example.com', confirmEmail: 'fresh-admin@example.com', currentPassword: 'Pizza123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.pending).toBe(false);
    expect(emailChangeMock).not.toHaveBeenCalled();

    const stored = await usersRepo.getByEmail('fresh-admin@example.com');
    expect(stored?.id).toBe(user.id);
    // Old login no longer works, new one does.
    expect((await api.post(`${AUTH}/login`).send({ email: user.email, password: 'Pizza123!' })).status).toBe(401);
    expect((await api.post(`${AUTH}/login`).send({ email: 'fresh-admin@example.com', password: 'Pizza123!' })).status).toBe(200);
  });

  it('invalidates other sessions after an email change (old refresh token rejected)', async () => {
    const user = await createUser({ role: 'admin' });
    const oldCookie = await loginCookie(user.email, 'Pizza123!');
    const res = await api
      .post(`${AUTH}/change-email`)
      .set(bearer(toId(user.id)))
      .send({ email: 'rotated@example.com', confirmEmail: 'rotated@example.com', currentPassword: 'Pizza123!' });
    expect(res.status).toBe(200);
    const reuse = await api.post(`${AUTH}/refresh`).set('Cookie', oldCookie);
    expect(reuse.status).toBe(401);
  });
});

describe('verify email change (pending flow)', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  const setupPending = async (overrides: { expiresInMs?: number; token?: string } = {}) => {
    const user = await createUser({ role: 'admin' });
    await usersRepo.update(user.id, {
      pendingEmail: 'pending-new@example.com',
      emailChangeToken: overrides.token ?? 'change-token-abc',
      emailChangeExpires: new Date(Date.now() + (overrides.expiresInMs ?? 3600_000)),
    });
    return user;
  };

  it('applies the pending email with a valid token and clears the tokens', async () => {
    const user = await setupPending();
    const res = await api.get(`${AUTH}/verify-email-change`).query({ token: 'change-token-abc' });
    expect(res.status).toBe(200);
    const stored = await usersRepo.getById(user.id);
    expect(stored?.email).toBe('pending-new@example.com');
    expect(stored?.pendingEmail).toBeNull();
    expect(stored?.emailChangeToken).toBeNull();
    expect(stored?.emailChangeExpires).toBeNull();
  });

  it('rejects an invalid token with 400', async () => {
    const res = await api.get(`${AUTH}/verify-email-change`).query({ token: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('rejects an expired token with 400', async () => {
    await setupPending({ expiresInMs: -1000 });
    const res = await api.get(`${AUTH}/verify-email-change`).query({ token: 'change-token-abc' });
    expect(res.status).toBe(400);
  });

  it('rejects a token whose target email is already taken with 409', async () => {
    await createUser({ role: 'admin', email: 'pending-new@example.com' });
    await setupPending();
    const res = await api.get(`${AUTH}/verify-email-change`).query({ token: 'change-token-abc' });
    expect(res.status).toBe(409);
  });
});

describe('change password (admin account settings)', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('rejects a mismatching confirmation with 422', async () => {
    const user = await createUser({ role: 'admin' });
    const res = await api
      .post(`${AUTH}/change-password`)
      .set(bearer(toId(user.id)))
      .send({ currentPassword: 'Pizza123!', newPassword: 'Rotated123', newPasswordConfirm: 'Different99' });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain('Passwords do not match');
  });

  it('rejects a weak new password with 422', async () => {
    const user = await createUser({ role: 'admin' });
    const res = await api
      .post(`${AUTH}/change-password`)
      .set(bearer(toId(user.id)))
      .send({ currentPassword: 'Pizza123!', newPassword: 'short', newPasswordConfirm: 'short' });
    expect(res.status).toBe(422);
  });

  it('changes the password; the old one no longer works and sessions are revoked', async () => {
    const user = await createUser({ role: 'admin' });
    const oldCookie = await loginCookie(user.email, 'Pizza123!');
    const res = await api
      .post(`${AUTH}/change-password`)
      .set(bearer(toId(user.id)))
      .send({ currentPassword: 'Pizza123!', newPassword: 'Rotated123', newPasswordConfirm: 'Rotated123' });
    expect(res.status).toBe(200);
    expect((await api.post(`${AUTH}/login`).send({ email: user.email, password: 'Pizza123!' })).status).toBe(401);
    expect((await api.post(`${AUTH}/login`).send({ email: user.email, password: 'Rotated123' })).status).toBe(200);
    const reuse = await api.post(`${AUTH}/refresh`).set('Cookie', oldCookie);
    expect(reuse.status).toBe(401);
  });

  it('rotates the current session so the acting admin stays signed in', async () => {
    const user = await createUser({ role: 'admin' });
    const res = await api
      .post(`${AUTH}/change-password`)
      .set(bearer(toId(user.id)))
      .send({ currentPassword: 'Pizza123!', newPassword: 'Rotated123', newPasswordConfirm: 'Rotated123' });
    expect(res.status).toBe(200);
    const newCookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('refreshToken='))!.split(';')[0];
    const refresh = await api.post(`${AUTH}/refresh`).set('Cookie', newCookie);
    expect(refresh.status).toBe(200);
  });
});
