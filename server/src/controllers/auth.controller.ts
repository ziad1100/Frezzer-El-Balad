import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as usersRepo from '../db/users';
import { apiErrorFromPg } from '../db';
import env from '../config/env';
import { smtpConfigured } from '../config/mailer';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { clearAuthCookies, setAuthCookies, REFRESH_COOKIE_NAME } from '../utils/cookies';
import { generateEmailCode, generateEmailToken, hashToken, verifyRefreshToken } from '../utils/token';
import { enqueueEmailChangeVerification, enqueuePasswordResetOtp, enqueueVerificationEmail } from '../services/email.service';
import { ROLES } from '../constants';

export const getUserWithRole = async (id: string) => {
  const user = await usersRepo.getById(id);
  if (!user) throw new ApiError(404, 'User not found');
  const permissions = await usersRepo.rolePermissions(user.role);
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatar: user.avatar,
    isVerified: user.isVerified,
    addresses: user.addresses,
    provider: user.provider,
    permissions,
  };
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { fullName, email, phone, password, role: requestedRole, adminCode } = req.body;
  const exists = await usersRepo.getByEmail(email);
  if (exists) throw new ApiError(409, 'Email already registered');

  // A client-supplied role is never trusted: only the validated admin self-registration
  // path (correct ADMIN_REGISTER_CODE) may yield an elevated role.
  let role: string = ROLES.CUSTOMER;
  if (requestedRole === ROLES.ADMIN) {
    const expectedCode = process.env.ADMIN_REGISTER_CODE;
    if (!expectedCode) throw new ApiError(403, 'Admin registration is disabled');
    if (adminCode !== expectedCode) throw new ApiError(403, 'Invalid admin code');
    role = ROLES.ADMIN;
  }

  const hashed = await bcrypt.hash(password, 10);
  const emailVerifyToken = generateEmailToken();
  let user;
  try {
    user = await usersRepo.create({
      fullName,
      email,
      phone,
      role,
      passwordHash: hashed,
      emailVerifyToken,
      emailVerifyExpires: new Date(Date.now() + 24 * 3600 * 1000),
      provider: 'local',
    });
  } catch (err) {
    throw apiErrorFromPg(err);
  }

  await enqueueVerificationEmail(email, emailVerifyToken);

  const { accessToken, refreshToken } = setAuthCookies(res, user.id);
  await usersRepo.update(user.id, { refreshToken });
  res.status(201).json(
    new ApiResponse(
      201,
      {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          isVerified: user.isVerified,
          addresses: user.addresses,
          provider: user.provider,
        },
        accessToken,
      },
      'Registered successfully',
    ),
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await usersRepo.getByEmail(email);
  if (!user) throw new ApiError(401, 'Invalid email or password');
  const ok = await bcrypt.compare(password, user.passwordHash ?? '');
  if (!ok) throw new ApiError(401, 'Invalid email or password');
  if (!user.isActive) throw new ApiError(403, 'Account is deactivated');

  const { accessToken, refreshToken } = setAuthCookies(res, user.id);
  await usersRepo.update(user.id, { refreshToken });
  res.json(new ApiResponse(200, { user: await getUserWithRole(user.id), accessToken }, 'Logged in'));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (token) {
    try {
      const payload = verifyRefreshToken(token) as { sub: string };
      await usersRepo.update(payload.sub, { refreshToken: null });
    } catch {
      /* invalid/expired token: nothing to revoke */
    }
  }
  clearAuthCookies(res);
  res.json(new ApiResponse(200, null, 'Logged out'));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!token) throw new ApiError(401, 'No refresh token');
  let payload;
  try {
    payload = verifyRefreshToken(token) as { sub: string };
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }
  const user = await usersRepo.getById(payload.sub);
  if (!user || !user.isActive) throw new ApiError(401, 'Account not found');
  // No stored hash or a mismatching one means the session was revoked, rotated or reused
  if (user.refreshToken !== hashToken(token)) {
    clearAuthCookies(res);
    throw new ApiError(401, 'Refresh token reused — please login again');
  }
  const { accessToken, refreshToken } = setAuthCookies(res, user.id);
  await usersRepo.update(user.id, { refreshToken });
  res.json(new ApiResponse(200, { accessToken }, 'Token refreshed'));
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.query as { token: string };
  const user = await usersRepo.getByVerifyToken(token);
  if (!user || !user.emailVerifyExpires || user.emailVerifyExpires < new Date()) {
    throw new ApiError(400, 'Invalid or expired verification token');
  }
  await usersRepo.update(user.id, { isVerified: true, emailVerifyToken: null, emailVerifyExpires: null });
  res.json(new ApiResponse(200, null, 'Email verified'));
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await usersRepo.getByEmail(email);
  let devPayload: { code: string; link: string } | null = null;
  if (user) {
    const token = generateEmailCode();
    // Never leak the OTP/link through the API in production (S9); dev/test may
    // receive it inline so local flows work without an SMTP server.
    if (!smtpConfigured && !env.isProd) {
      devPayload = { code: token, link: `${env.clientUrl}/reset-password?token=${token}` };
    }
    await usersRepo.update(user.id, {
      resetToken: token,
      resetTokenExpires: new Date(Date.now() + 15 * 60 * 1000),
    });
    await enqueuePasswordResetOtp(email, token);
  }
  // Always respond the same to avoid user enumeration
  res.json(new ApiResponse(200, devPayload, 'If the email exists, a reset link was sent'));
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;
  const user = await usersRepo.getByResetToken(token);
  if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
    throw new ApiError(400, 'Invalid or expired reset token');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await usersRepo.update(user.id, {
    passwordHash,
    resetToken: null,
    resetTokenExpires: null,
    refreshToken: null,
  });
  res.json(new ApiResponse(200, null, 'Password reset successfully'));
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const id = (req as { user?: { id: string } }).user?.id;
  const user = await usersRepo.getById(id ?? '');
  if (!user) throw new ApiError(404, 'User not found');
  const ok = await bcrypt.compare(currentPassword, user.passwordHash ?? '');
  if (!ok) throw new ApiError(400, 'Current password is incorrect');
  const passwordHash = await bcrypt.hash(newPassword, 10);
  // Invalidate every stored refresh token (all other sessions), then rotate a
  // fresh session for the current one so the admin stays signed in here.
  await usersRepo.update(user.id, { passwordHash, refreshToken: null });
  const { accessToken, refreshToken } = setAuthCookies(res, user.id);
  await usersRepo.update(user.id, { refreshToken });
  res.json(new ApiResponse(200, { accessToken }, 'Password changed'));
});

export const changeEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email, currentPassword } = req.body;
  const id = (req as { user?: { id: string } }).user?.id as string;
  const user = await usersRepo.getById(id);
  if (!user) throw new ApiError(404, 'User not found');
  const ok = await bcrypt.compare(currentPassword, user.passwordHash ?? '');
  if (!ok) throw new ApiError(400, 'Current password is incorrect');
  if (email === user.email.toLowerCase()) throw new ApiError(400, 'New email is the same as the current email');
  if ((await usersRepo.countByEmail(email)) > 0) throw new ApiError(409, 'Email already registered');

  // Email delivery configured → verify the new address first (single-use token,
  // 24h expiry, stored hashed). No SMTP → apply immediately (dev fallback).
  if (smtpConfigured) {
    const token = generateEmailToken();
    await usersRepo.update(user.id, {
      pendingEmail: email,
      emailChangeToken: token,
      emailChangeExpires: new Date(Date.now() + 24 * 3600 * 1000),
    });
    await enqueueEmailChangeVerification(email, token);
    res.json(new ApiResponse(200, { pending: true }, 'Verification email sent to the new address'));
    return;
  }

  await usersRepo.update(user.id, { email, refreshToken: null });
  const { accessToken, refreshToken } = setAuthCookies(res, user.id);
  await usersRepo.update(user.id, { refreshToken });
  res.json(new ApiResponse(200, { pending: false, email, accessToken }, 'Email updated'));
});

export const verifyEmailChange = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };
  if (!token) throw new ApiError(400, 'Invalid or expired verification token');
  const user = await usersRepo.getByEmailChangeToken(token);
  if (!user || !user.pendingEmail || !user.emailChangeExpires || user.emailChangeExpires < new Date()) {
    throw new ApiError(400, 'Invalid or expired verification token');
  }
  if ((await usersRepo.countByEmail(user.pendingEmail)) > 0) {
    throw new ApiError(409, 'Email already registered');
  }
  const newEmail = user.pendingEmail;
  await usersRepo.update(user.id, {
    email: newEmail,
    pendingEmail: null,
    emailChangeToken: null,
    emailChangeExpires: null,
    refreshToken: null,
  });
  res.json(new ApiResponse(200, { email: newEmail }, 'Email updated'));
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const id = (req as { user?: { id: string } }).user?.id as string;
  res.json(new ApiResponse(200, await getUserWithRole(id)));
});

export const socialAuthCallback = (provider: 'google' | 'facebook') =>
  asyncHandler(async (req: Request, res: Response) => {
    const profile = req.user as { id: string; displayName: string; emails?: { value: string }[]; photos?: { value: string }[] };
    const email = profile.emails?.[0]?.value ?? `${profile.id}@${provider}.local`;
    let user = await usersRepo.getByEmail(email);
    if (user) {
      if (!user.isActive) {
        return res.redirect(`${env.clientUrl}/login?error=deactivated`);
      }
      const sets: Record<string, unknown> = { provider, providerId: profile.id };
      if (!user.avatar && profile.photos?.[0]?.value) sets.avatar = profile.photos[0].value;
      await usersRepo.update(user.id, sets);
    } else {
      try {
        user = await usersRepo.create({
          fullName: profile.displayName,
          email,
          provider,
          providerId: profile.id,
          avatar: profile.photos?.[0]?.value ?? '',
          isVerified: true,
        });
      } catch (err) {
        throw apiErrorFromPg(err);
      }
    }
    const { accessToken, refreshToken } = setAuthCookies(res, user.id);
    await usersRepo.update(user.id, { refreshToken });
    const redirect = `${env.clientUrl}/auth/callback#accessToken=${accessToken}`;
    res.redirect(redirect);
  });