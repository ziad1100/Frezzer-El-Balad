import { beforeEach, describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { ROLES } from '../constants';
import { ApiError } from '../utils/ApiError';
import { signAccessToken } from '../utils/token';
import { createUser, seedRoles } from '../test/helpers';
import { requireAuth, requirePermission, requireRole, type AuthRequest } from './auth';

const nextFn = (): { next: (err?: unknown) => void; getErr: () => unknown } => {
  let err: unknown = null;
  return {
    next: (e?: unknown) => {
      err = e ?? null;
    },
    getErr: () => err,
  };
};

const mockRes = (): Response => ({}) as Response;

describe('requirePermission', () => {
  const req = (permissions: Record<string, string[]>): AuthRequest =>
    ({ user: { id: 'user-1', role: ROLES.CUSTOMER, permissions } }) as AuthRequest;

  it('passes when the action is granted', () => {
    const { next, getErr } = nextFn();
    requirePermission('orders', 'read')(req({ orders: ['read'] }), mockRes(), next);
    expect(getErr()).toBeNull();
  });

  it('denies with 403 when the action is missing', () => {
    const { next, getErr } = nextFn();
    requirePermission('orders', 'delete')(req({ orders: ['read'] }), mockRes(), next);
    const err = getErr();
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(403);
  });

  it('denies when the resource has no permissions at all', () => {
    const { next, getErr } = nextFn();
    requirePermission('coupons', 'create')(req({}), mockRes(), next);
    expect((getErr() as ApiError).statusCode).toBe(403);
  });
});

describe('requireRole', () => {
  it('passes for a matching role', () => {
    const { next, getErr } = nextFn();
    requireRole(ROLES.ADMIN, ROLES.MANAGER)({ user: { id: 'u', role: ROLES.ADMIN, permissions: {} } } as AuthRequest, mockRes(), next);
    expect(getErr()).toBeNull();
  });

  it('denies with 403 for a non-matching role', () => {
    const { next, getErr } = nextFn();
    requireRole(ROLES.ADMIN)({ user: { id: 'u', role: ROLES.CUSTOMER, permissions: {} } } as AuthRequest, mockRes(), next);
    expect((getErr() as ApiError).statusCode).toBe(403);
  });

  it('denies when no user is attached', () => {
    const { next, getErr } = nextFn();
    requireRole(ROLES.ADMIN)({} as Request, mockRes(), next);
    expect((getErr() as ApiError).statusCode).toBe(403);
  });
});

describe('requireAuth', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('attaches id, role and permissions from a valid token', async () => {
    const user = await createUser({ role: ROLES.ADMIN });
    const req = { headers: { authorization: `Bearer ${signAccessToken(user.id)}` } } as unknown as AuthRequest;
    const { next, getErr } = nextFn();
    await requireAuth(req, mockRes(), next);
    expect(getErr()).toBeNull();
    expect(req.user).toMatchObject({ id: user.id, role: ROLES.ADMIN });
    expect(req.user?.permissions.orders).toContain('create');
    expect(req.user?.permissions.settings).toContain('delete');
  });

  it('denies with 401 when the header is missing', async () => {
    const req = { headers: {} } as unknown as AuthRequest;
    const { next, getErr } = nextFn();
    await requireAuth(req, mockRes(), next);
    expect((getErr() as ApiError).statusCode).toBe(401);
  });

  it('denies with 401 for a malformed header', async () => {
    const req = { headers: { authorization: 'Basic abc' } } as unknown as AuthRequest;
    const { next, getErr } = nextFn();
    await requireAuth(req, mockRes(), next);
    expect((getErr() as ApiError).statusCode).toBe(401);
  });

  it('denies with 401 for an invalid token', async () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } } as unknown as AuthRequest;
    const { next, getErr } = nextFn();
    await requireAuth(req, mockRes(), next);
    expect((getErr() as ApiError).statusCode).toBe(401);
  });

  it('denies with 401 for a deactivated account', async () => {
    const user = await createUser({ role: ROLES.CUSTOMER, isActive: false });
    const req = { headers: { authorization: `Bearer ${signAccessToken(user.id)}` } } as unknown as AuthRequest;
    const { next, getErr } = nextFn();
    await requireAuth(req, mockRes(), next);
    expect((getErr() as ApiError).statusCode).toBe(401);
  });
});
