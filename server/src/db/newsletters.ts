import { query } from './index';

const NEWSLETTER_COLS = `
  n.id::text AS "_id",
  n.email, n.name, n.source, n."isSubscribed", n."unsubscribedAt",
  n."createdAt", n."updatedAt"`;

export const getByEmail = async (email: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${NEWSLETTER_COLS} FROM newsletters n WHERE n.email = $1 LIMIT 1`, [email]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const create = async (data: { email: string; name?: string; source?: string }): Promise<boolean> => {
  const r = await query<{ id: string }>(
    `INSERT INTO newsletters (email, name, source) VALUES ($1, $2, $3) RETURNING id`,
    [data.email, data.name ?? '', data.source ?? 'footer'],
  );
  return r.length > 0;
};

export const reconnect = async (email: string): Promise<boolean> => {
  const r = await query(
    `UPDATE newsletters SET "isSubscribed" = true, "unsubscribedAt" = NULL WHERE email = $1 RETURNING id`,
    [email],
  );
  return r.length > 0;
};

export const unsubscribe = async (email: string): Promise<boolean> => {
  const r = await query(
    `UPDATE newsletters SET "isSubscribed" = false, "unsubscribedAt" = now() WHERE email = $1 RETURNING id`,
    [email],
  );
  return r.length > 0;
};

export const list = async (): Promise<Record<string, unknown>[]> =>
  (await query(
    `SELECT ${NEWSLETTER_COLS} FROM newsletters n
     WHERE n."isSubscribed" = true ORDER BY n."createdAt" DESC, n.id`,
  )) as Record<string, unknown>[];