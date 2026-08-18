import { Pool, type PoolClient } from 'pg';
import env from '../config/env';
import { ApiError } from '../utils/ApiError';

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.pgMaxPoolSize,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  application_name: 'orabi-api',
});

pool.on('error', (err) => {
  console.error(`[pg] idle client error: ${err.message}`);
});

export const query = async <T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> => {
  const { rows } = await pool.query(text, params);
  return rows as T[];
};

export const row = async <T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> => {
  const result = await query<T>(text, params);
  return result[0] ?? null;
};

export const rowCount = async (text: string, params: unknown[] = []): Promise<number> => {
  const r = await pool.query<{ n: string }>(text, params);
  return Number(r.rows[0]?.n ?? '0');
};

export type ReadClient = Pick<Pool, 'query'>;

/**
 * Executes `fn` inside a single database transaction (BEGIN/COMMIT/ROLLBACK).
 * The callback receives a client-like object whose `query` runs inside the tx.
 */
export const withTransaction = async <T>(fn: (client: ReadClient) => Promise<T>): Promise<T> => {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
};

/** idempotent kv helper for partial updates: present values only. */
export const buildSetClause = (data: Record<string, unknown>, offset = 1): { setSql: string; values: unknown[] } => {
  const entries = Object.entries(data);
  if (entries.length === 0) return { setSql: '', values: [] };
  const setSql = entries.map(([k], i) => `"${k}" = $${i + offset}`).join(', ');
  return { setSql, values: entries.map(([, v]) => v) };
};

export const apiErrorFromPg = (err: unknown): ApiError => {
  const code = (err as { code?: string } | undefined)?.code;
  if (code === '23505') return new ApiError(409, 'A record with the same key already exists');
  if (code === '23503') return new ApiError(400, 'Referenced record does not exist');
  if (code === '23502') return new ApiError(400, 'A required field is missing');
  if (code === '22P02' || code === '22003' || code === '22P03') return new ApiError(400, 'Invalid id or number format');
  if (err instanceof ApiError) return err;
  return new ApiError(500, 'Database error');
};

export const disconnectDb = async (): Promise<void> => {
  try {
    await pool.end();
  } catch {
    /* already closed */
  }
};