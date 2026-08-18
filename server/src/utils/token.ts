import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import env from '../config/env';

export const signAccessToken = (userId: string): string => {
  return jwt.sign({ sub: userId, type: 'access' }, env.jwtAccessSecret, {
    expiresIn: env.accessTokenExpires,
  } as SignOptions);
};

export const signRefreshToken = (userId: string): string => {
  // A unique `jti` guarantees every issued refresh token differs — even two
  // signs within the same `iat` second (e.g. login then an immediate password
  // or email change) — so session rotation genuinely invalidates old tokens.
  return jwt.sign({ sub: userId, type: 'refresh', jti: crypto.randomUUID() }, env.jwtRefreshSecret, {
    expiresIn: env.refreshTokenExpires,
  } as SignOptions);
};

export const verifyAccessToken = (token: string): JwtPayload | string => {
  return jwt.verify(token, env.jwtAccessSecret);
};

export const verifyRefreshToken = (token: string): JwtPayload | string => {
  return jwt.verify(token, env.jwtRefreshSecret);
};

export const generateEmailToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const generateEmailCode = (): string => crypto.randomInt(100000, 1000000).toString();

export const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');
