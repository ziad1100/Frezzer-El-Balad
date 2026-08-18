import { query } from './index';

export const NOTIFICATION_COLS = `
  n.id::text AS "_id",
  n."userId"::text AS "user",
  n.audience::text AS "audience",
  n.role, n.title, n."titleEn", n.body, n."bodyEn", n.link,
  n.type, n."isRead", n."createdAt", n."updatedAt"`;

interface Page<T> {
  items: T[];
  total: number;
  pages: number;
}

const toPage = <T>(rows: Array<Record<string, unknown>>, limit: number): Page<T> => {
  const total = rows[0] ? (rows[0].__total as number) : 0;
  const items = rows.map(({ __total, ...rest }) => rest) as unknown as T[];
  return { items, total, pages: Math.max(1, Math.ceil(total / limit)) };
};

export const listForUser = async (userId: string, role: string, page: number, limit: number):
  Promise<Page<Record<string, unknown>>> => {
  const rows = await query(
    `SELECT count(*) OVER()::int AS __total, ${NOTIFICATION_COLS}
     FROM notifications n
     WHERE n."userId" = $1::uuid
        OR n.audience = 'all'
        OR (n.audience = 'role' AND n.role = $2)
     ORDER BY n."createdAt" DESC, n.id
     LIMIT $3 OFFSET $4`,
    [userId, role, limit, (page - 1) * limit],
  ) as unknown as Array<Record<string, unknown>>;
  return toPage(rows, limit);
};

export const markRead = async (id: string, userId: string): Promise<Record<string, unknown> | null> => {
  const r = await query(
    `UPDATE notifications SET "isRead" = true
     WHERE id = $1::uuid AND ("userId" = $2::uuid OR audience = 'all')
     RETURNING id`,
    [id, userId],
  );
  if (!r.length) return null;
  return getById(id);
};

export const getById = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${NOTIFICATION_COLS} FROM notifications n WHERE n.id = $1::uuid LIMIT 1`, [id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const markAllRead = async (userId: string): Promise<void> => {
  await query(`UPDATE notifications SET "isRead" = true WHERE "userId" = $1::uuid AND "isRead" = false`, [userId]);
};

export const sendToUsers = async (data: {
  userIds: string[];
  title: string;
  titleEn?: string;
  body?: string;
  bodyEn?: string;
  type?: string;
  link?: string;
}): Promise<void> => {
  for (const userId of data.userIds) {
    await query(
      `INSERT INTO notifications ("userId", audience, title, "titleEn", body, "bodyEn", type, link)
       VALUES ($1::uuid, 'user', $2, $3, $4, $5, $6, $7)`,
      [userId, data.title, data.titleEn ?? '', data.body ?? '', data.bodyEn ?? '',
       data.type ?? 'info', data.link ?? ''],
    );
  }
};