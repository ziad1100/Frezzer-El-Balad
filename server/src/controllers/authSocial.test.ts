import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import * as auth from './auth.controller';
import * as usersRepo from '../db/users';
import { createUser, seedRoles } from '../test/helpers';

interface MockRes {
  cookie: ReturnType<typeof vi.fn>;
  redirect: ReturnType<typeof vi.fn>;
}

const callSocialAuth = async (provider: 'google' | 'facebook', profile: unknown) => {
  const res: MockRes = { cookie: vi.fn(), redirect: vi.fn() };
  const handler = auth.socialAuthCallback(provider) as unknown as (
    req: Request,
    _res: Response,
    next: (err?: unknown) => void,
  ) => void;
  handler({ user: profile } as unknown as Request, res as unknown as Response, () => undefined);
  await vi.waitFor(() => {
    expect(res.redirect).toHaveBeenCalledTimes(1);
  });
  return res;
};

const googleProfile = {
  id: 'google-123',
  displayName: 'Gina Google',
  emails: [{ value: 'gina@example.com' }],
  photos: [{ value: 'https://example.com/gina.jpg' }],
};

describe('socialAuthCallback', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('creates a new user for an unknown google profile and redirects with a token', async () => {
    const res = await callSocialAuth('google', googleProfile);
    const user = await usersRepo.getByEmail('gina@example.com');
    expect(user).not.toBeNull();
    expect(user).toMatchObject({ provider: 'google', providerId: 'google-123', isVerified: true, avatar: 'https://example.com/gina.jpg', role: 'customer' });
    const redirectUrl = res.redirect.mock.calls[0][0] as string;
    expect(redirectUrl).toContain('/auth/callback#accessToken=');
    expect(res.cookie).toHaveBeenCalled();
  });

  it('reuses an existing user with the same email', async () => {
    const existing = await createUser({ email: 'gina@example.com' });
    await callSocialAuth('google', googleProfile);
    expect(await usersRepo.countByEmail('gina@example.com')).toBe(1);
    const user = await usersRepo.getByEmail('gina@example.com');
    expect(user?.id).toBe(existing.id);
  });

  it('links the google provider onto an existing account and keeps its role', async () => {
    await createUser({ email: 'boss@example.com', role: 'admin', avatar: '' });
    const res = await callSocialAuth('google', {
      ...googleProfile,
      id: 'google-boss',
      emails: [{ value: 'boss@example.com' }],
    });
    const user = await usersRepo.getByEmail('boss@example.com');
    expect(user).toMatchObject({ provider: 'google', providerId: 'google-boss', role: 'admin', avatar: 'https://example.com/gina.jpg' });
    expect(res.redirect.mock.calls[0][0] as string).toContain('/auth/callback#accessToken=');
  });

  it('redirects deactivated accounts to login with an error', async () => {
    await createUser({ email: 'locked@example.com', isActive: false });
    const res = await callSocialAuth('google', {
      ...googleProfile,
      emails: [{ value: 'locked@example.com' }],
    });
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.redirect.mock.calls[0][0] as string).toContain('/login?error=deactivated');
  });

  it('falls back to a synthetic email for providers without one (facebook)', async () => {
    const res = await callSocialAuth('facebook', {
      id: 'fb-456',
      displayName: 'Fadi Facebook',
      emails: [],
      photos: [],
    });
    const user = await usersRepo.getByEmail('fb-456@facebook.local');
    expect(user).not.toBeNull();
    expect(user).toMatchObject({ provider: 'facebook', providerId: 'fb-456' });
    expect(res.redirect.mock.calls[0][0] as string).toContain('/auth/callback#accessToken=');
  });
});
