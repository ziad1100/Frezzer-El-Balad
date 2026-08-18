import { query } from './index';

export const create = async (data: {
  actorId?: string;
  role?: string;
  action: string;
  resource: string;
  targetId?: string;
  method?: string;
  path?: string;
  ip?: string;
  changes?: unknown;
}): Promise<void> => {
  await query(
    `INSERT INTO activity_logs ("actorId", role, action, resource, "targetId", method, path, ip, changes)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [data.actorId ?? null, data.role ?? '', data.action, data.resource,
     data.targetId ?? '', data.method ?? '', data.path ?? '', data.ip ?? '', data.changes ?? {}],
  );
};

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

export const list = async (page: number, limit: number): Promise<Page<Record<string, unknown>>> => {
  const rows = (await query(
    `SELECT count(*) OVER()::int AS __total,
       l.id::text AS "_id",
       CASE WHEN u.id IS NULL THEN NULL
            ELSE jsonb_build_object('_id', u.id::text, 'fullName', u."fullName", 'email', u.email)
       END AS "actor",
       l.role, l.action, l.resource, l."targetId", l.method, l.path, l.ip, l.changes,
       l."createdAt"
     FROM activity_logs l
     LEFT JOIN users u ON u.id = l."actorId"
     ORDER BY l."createdAt" DESC, l.id
     LIMIT $1 OFFSET $2`,
    [limit, (page - 1) * limit],
  )) as unknown as Array<Record<string, unknown>>;
  return toPage(rows, limit);
};