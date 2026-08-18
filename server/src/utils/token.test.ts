import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import {
  generateEmailToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './token';

describe('token utils', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken('user-1');
    const payload = verifyAccessToken(token) as jwt.JwtPayload;
    expect(payload.sub).toBe('user-1');
    expect(payload.type).toBe('access');
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken('user-1');
    const payload = verifyRefreshToken(token) as jwt.JwtPayload;
    expect(payload.sub).toBe('user-1');
    expect(payload.type).toBe('refresh');
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ sub: 'x' }, env.jwtAccessSecret, { expiresIn: -1 });
    expect(() => verifyAccessToken(expired)).toThrow();
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign({ sub: 'x' }, 'other_secret');
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it('generates a 64-char hex email token', () => {
    const token = generateEmailToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});
