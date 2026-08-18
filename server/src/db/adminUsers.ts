import { query } from './index';

const ADMIN_COLS = `
  u.id::text AS "_id",
  u."fullName", u.email, u.phone, u.role::text, u.avatar,
  u."isVerified", u."isActive", u.addresses, u.provider::text AS "provider",
  r.permissions, u."createdAt", u."updatedAt"`;

const PROFILE_COLS = `
  u.id::text AS "_id",
  u."fullName", u.email, u.phone, u.role::text, u.avatar,
  u."isVerified", u."isActive", u.addresses, u.provider::text AS "provider",
  u."providerId", u."createdAt", u."updatedAt"`;

const ADMIN_FROM = `FROM users u LEFT JOIN roles r ON r.slug = u.role`;

const getByIdAdmin = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${ADMIN_COLS} ${ADMIN_FROM} WHERE u.id = $1::uuid LIMIT 1`, [id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

interface Page<T> {
  items: T[];
  total: number;
  pages: number;
}

export const listUsers = async (
  page: number,
  limit: number,
  search: string,
  role: string,
): Promise<Page<Record<string, unknown>>> => {
  const conds: string[] = [];
  const values: unknown[] = [];
  const nxt = () => values.length;

  if (role) { values.push(role); conds.push(`u.role = $${nxt()}::user_role`); }
  if (search) {
    values.push(search);
    conds.push(`(u."fullName" ILIKE '%' || $${nxt()} || '%' OR u.email::text ILIKE '%' || $${nxt()} || '%')`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = (await query(
    `SELECT count(*) OVER()::int AS __total, ${ADMIN_COLS}
     ${ADMIN_FROM}
     ${where}
     ORDER BY u."createdAt" DESC, u.id
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit],
  )) as unknown as Array<Record<string, unknown>>;
  const total = rows[0] ? (rows[0].__total as number) : 0;
  const items = rows.map(({ __total, ...rest }) => rest) as unknown as Record<string, unknown>[];
  return { items, total, pages: Math.ceil(total / limit) };
};

export const updateUser = async (id: string, sets: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
  const entries = Object.entries(sets);
  if (entries.length) {
    const setSql = entries.map(([k], i) => `"${k}" = $${i + 2}`).join(', ');
    const r = await query(`UPDATE users SET ${setSql} WHERE id = $1::uuid RETURNING id`, [id, ...entries.map(([, v]) => v)]);
    if (!r.length) return null;
  }
  return getByIdAdmin(id);
};

export const deleteUser = async (id: string): Promise<boolean> => {
  const r = await query(`DELETE FROM users WHERE id = $1::uuid RETURNING id`, [id]);
  return r.length > 0;
};

export const getProfile = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${PROFILE_COLS} FROM users u WHERE u.id = $1::uuid LIMIT 1`, [id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const updateProfile = async (id: string, sets: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
  const entries = Object.entries(sets);
  if (entries.length) {
    const setSql = entries.map(([k], i) => `"${k}" = $${i + 2}`).join(', ');
    await query(`UPDATE users SET ${setSql} WHERE id = $1::uuid`, [id, ...entries.map(([, v]) => v)]);
  }
  return getProfile(id);
};