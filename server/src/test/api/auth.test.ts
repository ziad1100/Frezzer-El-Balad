import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as usersRepo from '../../db/users';
import { enqueueVerificationEmail } from '../../services/email.service';
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
}));

const verificationMock = vi.mocked(enqueueVerificationEmail);

const AUTH = '/api/v1/auth';

const register = () =>
  api.post(`${AUTH}/register`).send({
    fullName: 'Fresh User',
    email: 'fresh@example.com',
    phone: '01012345678',
    password: 'Pizza123!',
  });

describe('register', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('creates a user, returns a token and sets auth cookies', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('fresh@example.com');
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.accessToken).toBeTruthy();
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(' | ')).toContain('refreshToken=');
    expect(cookies.join(' | ')).toContain('accessToken=');
    expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
  });

  it('rejects a duplicate email with 409', async () => {
    await register();
    const res = await register();
    expect(res.status).toBe(409);
  });

  it('rejects a weak password with 422', async () => {
    const res = await api
      .post(`${AUTH}/register`)
      .send({ fullName: 'Weak', email: 'weak@example.com', password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain('at least 8 characters');
  });

  it('rejects an invalid email with 422', async () => {
    const res = await api
      .post(`${AUTH}/register`)
      .send({ fullName: 'Bad', email: 'not-an-email', password: 'Pizza123!' });
    expect(res.status).toBe(422);
  });

  it('never registers an elevated role from the client (role is ignored)', async () => {
    const res = await api
      .post(`${AUTH}/register`)
      .send({ fullName: 'Sneaky', email: 'sneaky@example.com', phone: '01000000001', password: 'Pizza123!', role: 'customer', adminCode: 'wrong' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('customer');
    const stored = await usersRepo.getByEmail('sneaky@example.com');
    expect(stored?.role).toBe('customer');
  });

  it('rejects an invalid admin code with 403', async () => {
    const res = await api
      .post(`${AUTH}/register`)
      .send({ fullName: 'Fake Admin', email: 'fakeadmin@example.com', phone: '01000000002', password: 'Pizza123!', role: 'admin', adminCode: 'wrong' });
    expect(res.status).toBe(403);
  });

  it('registers an admin only with the correct ADMIN_REGISTER_CODE', async () => {
    process.env.ADMIN_REGISTER_CODE = 'p1-secret-code-123';
    try {
      const noCode = await api
        .post(`${AUTH}/register`)
        .send({ fullName: 'No Code', email: 'nocode@example.com', phone: '01000000003', password: 'Pizza123!', role: 'admin', adminCode: 'wrong' });
      expect(noCode.status).toBe(403);
      const ok = await api
        .post(`${AUTH}/register`)
        .send({ fullName: 'Real Admin', email: 'realadmin@example.com', phone: '01000000004', password: 'Pizza123!', role: 'admin', adminCode: 'p1-secret-code-123' });
      expect(ok.status).toBe(201);
      expect(ok.body.data.user.role).toBe('admin');
    } finally {
      delete process.env.ADMIN_REGISTER_CODE;
    }
  });
});

describe('login', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('logs in with valid credentials and returns user + permissions', async () => {
    await createUser({ email: 'customer@pizzahouse.test' });
    const res = await api
      .post(`${AUTH}/login`)
      .send({ email: 'customer@pizzahouse.test', password: 'Pizza123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('customer@pizzahouse.test');
    expect(res.body.data.user.role).toBe('customer');
    expect(res.body.data.user.permissions.orders).toEqual([]);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('rejects a wrong password with 401', async () => {
    await createUser({ email: 'customer@pizzahouse.test' });
    const res = await api
      .post(`${AUTH}/login`)
      .send({ email: 'customer@pizzahouse.test', password: 'WrongPass1' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown email with 401', async () => {
    const res = await api
      .post(`${AUTH}/login`)
      .send({ email: 'nobody@example.com', password: 'Pizza123!' });
    expect(res.status).toBe(401);
  });

  it('rejects a deactivated account with 403', async () => {
    await createUser({ email: 'locked@pizzahouse.test', isActive: false });
    const res = await api
      .post(`${AUTH}/login`)
      .send({ email: 'locked@pizzahouse.test', password: 'Pizza123!' });
    expect(res.status).toBe(403);
  });
});

describe('me', () => {
  beforeEach(async () => {
    await seedRoles();
  });

it('returns the profile with a valid token', async () => {
    const user = await createUser();
    const res = await api.get(`${AUTH}/me`).set(bearer(user.id));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
    expect(res.body.data.permissions).toMatchObject({});
  });

  it('returns 401 without a token', async () => {
    const res = await api.get(`${AUTH}/me`);
    expect(res.status).toBe(401);
  });
});

describe('refresh', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  const login = async () => {
    await createUser({ email: 'session@pizzahouse.test' });
    const loginRes = await api
      .post(`${AUTH}/login`)
      .send({ email: 'session@pizzahouse.test', password: 'Pizza123!' });
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='))!.split(';')[0];
    return refreshCookie;
  };

  it('issues a new access token and rotates the refresh token', async () => {
    const oldCookie = await login();
    await new Promise((r) => setTimeout(r, 1100));
    const first = await api.post(`${AUTH}/refresh`).set('Cookie', oldCookie);
    expect(first.status).toBe(200);
    expect(first.body.data.accessToken).toBeTruthy();
    const user = await usersRepo.getByEmail('session@pizzahouse.test');
    expect(user?.refreshToken).not.toBe(oldCookie.split('=')[1]);
  });

  it('detects reuse of an old refresh token and forces re-login', async () => {
    const oldCookie = await login();
    await new Promise((r) => setTimeout(r, 1100));
    expect((await api.post(`${AUTH}/refresh`).set('Cookie', oldCookie)).status).toBe(200);
    const reuse = await api.post(`${AUTH}/refresh`).set('Cookie', oldCookie);
    expect(reuse.status).toBe(401);
    expect(reuse.body.message).toContain('reused');
  });

  it('returns 401 when no refresh cookie is present', async () => {
    const res = await api.post(`${AUTH}/refresh`);
    expect(res.status).toBe(401);
  });
});

describe('logout', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  const loginAndGetRefreshCookie = async () => {
    await createUser({ email: 'logout@pizzahouse.test' });
    const loginRes = await api
      .post(`${AUTH}/login`)
      .send({ email: 'logout@pizzahouse.test', password: 'Pizza123!' });
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    return cookies.find((c) => c.startsWith('refreshToken='))!.split(';')[0];
  };

  it('clears the auth cookies', async () => {
    const user = await createUser();
    const res = await api.post(`${AUTH}/logout`).set(bearer(toId(user.id)));
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const cleared = cookies.filter((c) => /refreshToken=;|accessToken=;/.test(c));
    expect(cleared.length).toBe(2);
  });

  it('revokes the stored refresh token, so refresh fails after logout', async () => {
    const cookie = await loginAndGetRefreshCookie();
    await new Promise((r) => setTimeout(r, 1100));
    const rotated = await api.post(`${AUTH}/refresh`).set('Cookie', cookie);
    expect(rotated.status).toBe(200);
    const rotatedCookie = (rotated.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('refreshToken='))!.split(';')[0];
    const out = await api.post(`${AUTH}/logout`).set('Cookie', rotatedCookie);
    expect(out.status).toBe(200);
    const reuse = await api.post(`${AUTH}/refresh`).set('Cookie', rotatedCookie);
    expect(reuse.status).toBe(401);
    const user = await usersRepo.getByEmail('logout@pizzahouse.test');
    expect(user?.refreshToken).toBeNull();
  });
});

describe('email verification', () => {
  beforeEach(async () => {
    await seedRoles();
    verificationMock.mockClear();
  });

  it('verifies an email with a valid token, then rejects reuse', async () => {
    await register();
    expect(verificationMock).toHaveBeenCalledTimes(1);
    const token = verificationMock.mock.calls[0]![1];
    const ok = await api.get(`${AUTH}/verify-email`).query({ token });
    expect(ok.status).toBe(200);
    const again = await api.get(`${AUTH}/verify-email`).query({ token });
    expect(again.status).toBe(400);
    const after = await usersRepo.getByEmail('fresh@example.com');
    expect(after?.isVerified).toBe(true);
    expect(after?.emailVerifyToken).toBeNull();
  });

  it('rejects an invalid token', async () => {
    const res = await api.get(`${AUTH}/verify-email`).query({ token: 'bogus' });
    expect(res.status).toBe(400);
  });
});

describe('forgot & reset password', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('responds identically for known and unknown emails (no enumeration)', async () => {
    await createUser({ email: 'known@pizzahouse.test' });
    const known = await api.post(`${AUTH}/forgot-password`).send({ email: 'known@pizzahouse.test' });
    const unknown = await api.post(`${AUTH}/forgot-password`).send({ email: 'ghost@pizzahouse.test' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
  });

  it('sets a reset token for the account', async () => {
    await createUser({ email: 'known@pizzahouse.test' });
    await api.post(`${AUTH}/forgot-password`).send({ email: 'known@pizzahouse.test' });
    const user = await usersRepo.getByEmail('known@pizzahouse.test');
    expect(user?.resetToken).toBeTruthy();
  });

  it('returns a 6-digit OTP code when SMTP is unconfigured', async () => {
    await createUser({ email: 'otp@pizzahouse.test' });
    const res = await api.post(`${AUTH}/forgot-password`).send({ email: 'otp@pizzahouse.test' });
    expect(res.status).toBe(200);
    expect(res.body.data.code).toMatch(/^\d{6}$/);
    expect(res.body.data.link).toContain('reset-password?token=');
  });

  it('resets the password via the emailed OTP code', async () => {
    await createUser({ email: 'otpflow@pizzahouse.test' });
    const sent = await api.post(`${AUTH}/forgot-password`).send({ email: 'otpflow@pizzahouse.test' });
    const code = sent.body.data.code as string;
    const reset = await api.post(`${AUTH}/reset-password`).send({ token: code, password: 'OtpChange99' });
    expect(reset.status).toBe(200);
    const login = await api
      .post(`${AUTH}/login`)
      .send({ email: 'otpflow@pizzahouse.test', password: 'OtpChange99' });
    expect(login.status).toBe(200);
  });

  it('resets the password and allows login with the new one', async () => {
    await createUser({ email: 'resetme@pizzahouse.test', resetToken: 'reset-token-123', resetTokenExpires: new Date(Date.now() + 3600_000) });
    const res = await api
      .post(`${AUTH}/reset-password`)
      .send({ token: 'reset-token-123', password: 'BrandNew99' });
    expect(res.status).toBe(200);
    const after = await api
      .post(`${AUTH}/login`)
      .send({ email: 'resetme@pizzahouse.test', password: 'BrandNew99' });
    expect(after.status).toBe(200);
  });

  it('rejects an invalid or expired reset token', async () => {
    await createUser({ email: 'resetme@pizzahouse.test', resetToken: 'tok', resetTokenExpires: new Date(Date.now() - 1000) });
    const res = await api
      .post(`${AUTH}/reset-password`)
      .send({ token: 'tok', password: 'Changed99' });
    expect(res.status).toBe(400);
  });
});

describe('change password', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('changes the password and allows login with the new one', async () => {
    const user = await createUser({ email: 'changeme@pizzahouse.test' });
    const auth = bearer(toId(user.id));
    const res = await api.post(`${AUTH}/change-password`).set(auth).send({ currentPassword: 'Pizza123!', newPassword: 'Rotated123', newPasswordConfirm: 'Rotated123' });
    expect(res.status).toBe(200);
    const login = await api.post(`${AUTH}/login`).send({ email: 'changeme@pizzahouse.test', password: 'Rotated123' });
    expect(login.status).toBe(200);
  });

  it('rejects a wrong current password', async () => {
    const user = await createUser({ email: 'neweme@pizzahouse.test' });
    const res = await api
      .post(`${AUTH}/change-password`)
      .set(bearer(toId(user.id)))
      .send({ currentPassword: 'WrongPass1', newPassword: 'Rotated123', newPasswordConfirm: 'Rotated123' });
    expect(res.status).toBe(400);
  });

  it('revokes sessions after a password change (refresh fails afterwards)', async () => {
    await createUser({ email: 'revokechangepw@pizzahouse.test' });
    const loginRes = await api
      .post(`${AUTH}/login`)
      .send({ email: 'revokechangepw@pizzahouse.test', password: 'Pizza123!' });
    const cookie = (loginRes.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('refreshToken='))!.split(';')[0];
    const res = await api
      .post(`${AUTH}/change-password`)
      .set(bearer(toId((await usersRepo.getByEmail('revokechangepw@pizzahouse.test'))!.id)))
      .send({ currentPassword: 'Pizza123!', newPassword: 'Rotated123', newPasswordConfirm: 'Rotated123' });
    expect(res.status).toBe(200);
    const reuse = await api.post(`${AUTH}/refresh`).set('Cookie', cookie);
    expect(reuse.status).toBe(401);
  });

  it('revokes sessions when the password is reset via OTP', async () => {
    await createUser({ email: 'revokereset@pizzahouse.test' });
    const loginRes = await api
      .post(`${AUTH}/login`)
      .send({ email: 'revokereset@pizzahouse.test', password: 'Pizza123!' });
    const cookie = (loginRes.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('refreshToken='))!.split(';')[0];
    const sent = await api.post(`${AUTH}/forgot-password`).send({ email: 'revokereset@pizzahouse.test' });
    const code = sent.body.data.code as string;
    await api.post(`${AUTH}/reset-password`).send({ token: code, password: 'AfterReset123' });
    const reuse = await api.post(`${AUTH}/refresh`).set('Cookie', cookie);
    expect(reuse.status).toBe(401);
  });
});