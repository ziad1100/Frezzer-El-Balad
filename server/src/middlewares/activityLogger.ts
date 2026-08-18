import type { RequestHandler } from 'express';
import * as activityLogsRepo from '../db/activityLogs';
import type { AuthRequest } from './auth';

const SENSITIVE_KEYS = /password|token|authorization|cookie|secret/i;

export const redactBody = (body: unknown): Record<string, unknown> | undefined => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.test(key)) {
      out[key] = '[REDACTED]';
    } else if (Array.isArray(value)) {
      out[key] = value.map((v) => redactBody(v) ?? '[REDACTED]');
    } else if (value && typeof value === 'object') {
      out[key] = redactBody(value) ?? {};
    } else {
      out[key] = value;
    }
  }
  return out;
};

export const logActivity =
  (action: string, resource: string): RequestHandler =>
  async (req, res, next): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      await activityLogsRepo.create({
        actorId: authReq.user?.id,
        role: authReq.user?.role,
        action,
        resource,
        targetId: String(req.params.id ?? ''),
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        changes: req.body && Object.keys(req.body).length ? redactBody(req.body) : undefined,
      });
    } catch {
      // logging must never break the request
    }
    next();
  };