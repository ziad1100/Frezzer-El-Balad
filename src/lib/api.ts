import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { refreshAccessToken } from '@/api/auth';

/**
 * Backend origin for API calls.
 *
 * - Development: unset → relative `/api/v1`, proxied by Vite to localhost:5000.
 * - Production (Vercel frontend + separate API): set `VITE_API_URL` to the
 *   backend origin (e.g. `https://api.example.com`). Never include a trailing
 *   slash; the `/api/v1` prefix is appended here.
 */
export const apiOrigin = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

export const apiBaseUrl = apiOrigin ? `${apiOrigin}/api/v1` : '/api/v1';

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = original?.url ?? '';

    if (error.response?.status === 401 && original && !original._retry && !url.includes('/auth/')) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken()
          .then((token) => {
            setStoredToken(token);
            return token;
          })
          .catch(() => {
            clearStoredToken();
            return null;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      const token = await refreshPromise;
      if (token) {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api.request(original);
      }
    }
    if (error.response?.status === 401 && url.includes('/auth/refresh')) {
      clearStoredToken();
      if (window.location.pathname.startsWith('/admin')) {
        window.location.assign('/login?reason=session');
      }
    }
    return Promise.reject(error);
  },
);

type Envelope<T> = { success: boolean; statusCode: number; message: string; data: T };

export async function unwrap<T>(promise: Promise<{ data: Envelope<T> }>): Promise<T> {
  const { data } = await promise;
  return data.data;
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message ?? error.message;
  }
  return 'Something went wrong';
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem('ph_token', token);
  } catch {
    // storage unavailable
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem('ph_token');
  } catch {
    return null;
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem('ph_token');
  } catch {
    // storage unavailable
  }
}