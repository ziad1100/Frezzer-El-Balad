import { query } from './index';

const CONTACT_COLS = `
  c.id::text AS "_id",
  c.name, c.phone, c.email, c.message, c."isRead", c."createdAt", c."updatedAt"`;

interface Page<T> {
  items: T[];
  total: number;
  pages: number;
}

const toPage = <T>(rows: Array<Record<string, unknown>>, limit: number): Page<T> => {
  const total = rows[0] ? (rows[0].__total as number) : 0;
  const items = rows.map(({ __total, ...rest }) => rest) as unknown as T[];
  return { items, total, pages: Math.ceil(total / limit) };
};

export const getById = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${CONTACT_COLS} FROM contacts c WHERE c.id = $1::uuid LIMIT 1`, [id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const create = async (data: { name: string; phone: string; email?: string; message: string }):
  Promise<Record<string, unknown> | null> => {
  const r = await query<{ id: string }>(
    `INSERT INTO contacts (name, phone, email, message) VALUES ($1, $2, $3, $4) RETURNING id`,
    [data.name, data.phone, data.email ?? '', data.message],
  );
  if (!r.length) return null;
  return getById(r[0].id);
};

export const list = async (page: number, limit: number): Promise<Page<Record<string, unknown>>> => {
  const rows = await query(
    `SELECT count(*) OVER()::int AS __total, ${CONTACT_COLS}
     FROM contacts c
     ORDER BY c."createdAt" DESC, c.id
     LIMIT $1 OFFSET $2`,
    [limit, (page - 1) * limit],
  ) as unknown as Array<Record<string, unknown>>;
  return toPage(rows, limit);
};

export const markRead = async (id: string): Promise<Record<string, unknown> | null> => {
  const r = await query(
    `UPDATE contacts SET "isRead" = true WHERE id = $1::uuid RETURNING id`,
    [id],
  );
  if (!r.length) return null;
  return getById(id);
};

export const remove = async (id: string): Promise<boolean> => {
  const r = await query('DELETE FROM contacts WHERE id = $1::uuid RETURNING id', [id]);
  return r.length > 0;
};