import { api, unwrap } from '@/lib/api';
import type { ApiEnvelope, AuthResponse, AuthUser } from '@/types';

export const login = (email: string, password: string): Promise<AuthResponse> =>
  unwrap(api.post<ApiEnvelope<AuthResponse>>('/auth/login', { email, password }));

export const register = (payload: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role?: 'admin' | 'customer';
  adminCode?: string;
}): Promise<AuthResponse> => unwrap(api.post<ApiEnvelope<AuthResponse>>('/auth/register', payload));

export const logout = (): Promise<void> =>
  unwrap(api.post<ApiEnvelope<null>>('/auth/logout')).then(() => undefined);

export const refreshAccessToken = (): Promise<string> =>
  unwrap(api.post<ApiEnvelope<{ accessToken: string }>>('/auth/refresh')).then((r) => r.accessToken);

export const getMe = (): Promise<AuthUser> =>
  unwrap(api.get<ApiEnvelope<AuthUser>>('/auth/me'));

export const getSocialProviders = (): Promise<{ google: boolean; facebook: boolean }> =>
  api.get<{ google: boolean; facebook: boolean }>('/auth/providers').then((r) => r.data);

export const verifyEmail = (token: string): Promise<void> =>
  unwrap(api.get<ApiEnvelope<null>>('/auth/verify-email', { params: { token } })).then(() => undefined);

export interface DevResetPayload {
  code: string;
  link: string;
}

export const forgotPassword = (email: string): Promise<DevResetPayload | null> =>
  unwrap(api.post<ApiEnvelope<DevResetPayload | null>>('/auth/forgot-password', { email }));

export const resetPassword = (token: string, password: string): Promise<void> =>
  unwrap(api.post<ApiEnvelope<null>>('/auth/reset-password', { token, password })).then(() => undefined);

export const changePassword = (payload: {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
}): Promise<{ accessToken: string }> =>
  unwrap(api.post<ApiEnvelope<{ accessToken: string }>>('/auth/change-password', payload));

export const changeEmail = (payload: {
  email: string;
  confirmEmail: string;
  currentPassword: string;
}): Promise<{ pending: boolean; email?: string }> =>
  unwrap(api.post<ApiEnvelope<{ pending: boolean; email?: string }>>('/auth/change-email', payload));

export const verifyEmailChange = (token: string): Promise<{ email: string }> =>
  unwrap(api.get<ApiEnvelope<{ email: string }>>('/auth/verify-email-change', { params: { token } }));