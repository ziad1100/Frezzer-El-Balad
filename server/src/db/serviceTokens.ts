import crypto from 'node:crypto';
import { query } from './index';

export interface ServiceToken {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  scope: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

/** Generate a new service token and store its hash. Returns { id, rawToken }. */
export const createToken = async (
  userId: string,
  name: string,
  scope: string[] = ['print'],
): Promise<{ id: string; rawToken: string }> => {
  const rawToken = `fps_${crypto.randomBytes(32).toString('hex')}`;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const rows = await query<{ id: string }>(
    `INSERT INTO service_tokens ("userId", name, "tokenHash", scope)
     VALUES ($1::uuid, $2, $3, $4) RETURNING id`,
    [userId, name, tokenHash, scope],
  );
  return { id: rows[0].id, rawToken };
};

/** Verify a service token by its raw value. Returns the token record if valid. */
export const verifyToken = async (rawToken: string): Promise<ServiceToken | null> => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const rows = await query<ServiceToken>(
    `SELECT id, "userId", name, "tokenHash", scope, "isActive", "lastUsedAt", "createdAt"
     FROM service_tokens WHERE "tokenHash" = $1 AND "isActive" = true`,
    [tokenHash],
  );
  if (!rows[0]) return null;
  // Update lastUsedAt (fire-and-forget)
  query(`UPDATE service_tokens SET "lastUsedAt" = now() WHERE id = $1::uuid`, [rows[0].id]).catch(() => {});
  return rows[0];
};

/** List all service tokens for a user (never returns the raw token). */
export const listByUser = async (userId: string): Promise<Omit<ServiceToken, 'tokenHash'>[]> => {
  return query(
    `SELECT id, "userId", name, scope, "isActive", "lastUsedAt", "createdAt"
     FROM service_tokens WHERE "userId" = $1::uuid ORDER BY "createdAt" DESC`,
    [userId],
  );
};

/** Revoke (deactivate) a service token. */
export const revoke = async (id: string, userId: string): Promise<boolean> => {
  const r = await query(
    `UPDATE service_tokens SET "isActive" = false WHERE id = $1::uuid AND "userId" = $2::uuid RETURNING id`,
    [id, userId],
  );
  return r.length > 0;
};
