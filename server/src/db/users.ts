import { query } from './index';
import { hashToken } from '../utils/token';

const TOKEN_COLUMNS: readonly string[] = ['refreshToken', 'emailVerifyToken', 'resetToken', 'emailChangeToken'];
const normalize = (sets: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(sets)) {
    out[k] = TOKEN_COLUMNS.includes(k) && typeof v === 'string' && v !== '' ? hashToken(v) : v;
  }
  return out;
};

export interface SafeUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  avatar: string;
  isVerified: boolean;
  addresses: unknown[];
  provider: string;
  providerId: string;
}

export interface UserWithCredentials extends SafeUser {
  passwordHash: string | null;
  refreshToken: string | null;
  emailVerifyToken: string | null;
  emailVerifyExpires: Date | null;
  resetToken: string | null;
  resetTokenExpires: Date | null;
  pendingEmail: string | null;
  emailChangeToken: string | null;
  emailChangeExpires: Date | null;
  isActive: boolean;
  createdAt: string;
}

const PUBLIC_COLS = `u.id::text AS "id", u."fullName", u.email, u.phone, u.role::text, u.avatar,
  u."isVerified", u.addresses, u.provider::text AS "provider", u."providerId"`;

const WITH_CRED_COLS = `${PUBLIC_COLS}, u."passwordHash", u."refreshToken", u."emailVerifyToken",
  u."emailVerifyExpires", u."resetToken", u."resetTokenExpires", u."pendingEmail",
  u."emailChangeToken", u."emailChangeExpires", u."isActive", u."createdAt"`;

export const getById = async (id: string): Promise<UserWithCredentials | null> => {
  const rows = await query(`SELECT ${WITH_CRED_COLS} FROM users u WHERE u.id = $1::uuid LIMIT 1`, [id]);
  return ((rows[0] as unknown) as UserWithCredentials | undefined) ?? null;
};

// email column is citext â†’ equality is case-insensitive by definition.
export const getByEmail = async (email: string): Promise<UserWithCredentials | null> => {
  const rows = await query(`SELECT ${WITH_CRED_COLS} FROM users u WHERE u.email = $1 LIMIT 1`, [email]);
  return ((rows[0] as unknown) as UserWithCredentials | undefined) ?? null;
};

export const countByEmail = async (email: string): Promise<number> => {
  const rows = await query<{ n: string }>(`SELECT count(*) AS n FROM users WHERE email = $1`, [email]);
  return Number(rows[0]?.n ?? 0);
};

export const getByVerifyToken = async (token: string): Promise<UserWithCredentials | null> => {
  const rows = await query(`SELECT ${WITH_CRED_COLS} FROM users u WHERE u."emailVerifyToken" = $1 LIMIT 1`, [hashToken(token)]);
  return ((rows[0] as unknown) as UserWithCredentials | undefined) ?? null;
};

export const getByResetToken = async (token: string): Promise<UserWithCredentials | null> => {
  const rows = await query(`SELECT ${WITH_CRED_COLS} FROM users u WHERE u."resetToken" = $1 LIMIT 1`, [hashToken(token)]);
  return ((rows[0] as unknown) as UserWithCredentials | undefined) ?? null;
};

export const getByEmailChangeToken = async (token: string): Promise<UserWithCredentials | null> => {
  const rows = await query(`SELECT ${WITH_CRED_COLS} FROM users u WHERE u."emailChangeToken" = $1 LIMIT 1`, [hashToken(token)]);
  return ((rows[0] as unknown) as UserWithCredentials | undefined) ?? null;
};

export const create = async (data: {
  fullName: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  role?: string;
  provider?: string;
  providerId?: string;
  avatar?: string;
  isVerified?: boolean;
  isActive?: boolean;
  emailVerifyToken?: string | null;
  emailVerifyExpires?: Date | null;
}): Promise<UserWithCredentials> => {
  const rows = await query<UserWithCredentials>(
    `INSERT INTO users ("fullName", email, phone, "passwordHash", role, provider, "providerId",
       avatar, "isVerified", "isActive", "emailVerifyToken", "emailVerifyExpires")
     VALUES ($1, $2, $3, $4, $5::user_role, $6::auth_provider, $7, $8, $9, $10, $11, $12)
     RETURNING ${WITH_CRED_COLS.replaceAll('u.', '')}`,
    [data.fullName, data.email, data.phone ?? '', data.passwordHash ?? '', data.role ?? 'customer',
     data.provider ?? 'local', data.providerId ?? '', data.avatar ?? '', data.isVerified ?? false,
     data.isActive ?? true,
     data.emailVerifyToken ? hashToken(data.emailVerifyToken) : null,
     data.emailVerifyExpires ?? null],
  );
const created = rows[0];
  // values in the RETURNING list are prefixed with u. — strip and re-map by re-selecting the row
  const full = await getById(created.id);
  return full ?? (created as unknown as UserWithCredentials);
};

export const update = async (id: string, sets: Record<string, unknown>): Promise<UserWithCredentials | null> => {
  sets = normalize(sets);
  if (Object.keys(sets).length === 0) return getById(id);
  const entries = Object.entries(sets);
  const setSql = entries.map(([k], i) => `"${k}" = $${i + 2}`).join(', ');
  const rows = await query(`UPDATE users SET ${setSql} WHERE id = $1::uuid RETURNING id`, [id, ...entries.map(([, v]) => v)]);
  if (!rows.length) return null;
  return getById(id);
};

export const updateByEmail = async (email: string, sets: Record<string, unknown>): Promise<boolean> => {
  sets = normalize(sets);
  const entries = Object.entries(sets);
  if (entries.length === 0) return false;
  const setSql = entries.map(([k], i) => `"${k}" = $${i + 2}`).join(', ');
  const rows = await query(`UPDATE users SET ${setSql} WHERE email = $1 RETURNING id`, [email, ...entries.map(([, v]) => v)]);
  return rows.length > 0;
};

export const rolePermissions = async (slug: string): Promise<Record<string, string[]>> => {
  const rows = await query<{ permissions: Record<string, string[]> }>(
    'SELECT permissions FROM roles WHERE slug = $1::user_role LIMIT 1', [slug],
  );
  return rows[0]?.permissions ?? {};
};