import type { Response } from 'express';
import env from '../config/env';
import { signAccessToken, signRefreshToken } from './token';

const REFRESH_COOKIE = 'refreshToken';
const ACCESS_COOKIE = 'accessToken';

// SameSite=None is only honored by browsers when the cookie is Secure (HTTPS).
const cookieOptions = {
  httpOnly: true,
  secure: env.cookieSameSite === 'none' ? true : env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: '/',
};

export const setAuthCookies = (res: Response, userId: string): { accessToken: string; refreshToken: string } => {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return { accessToken, refreshToken };
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie(ACCESS_COOKIE, cookieOptions);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
};

export const REFRESH_COOKIE_NAME = REFRESH_COOKIE;