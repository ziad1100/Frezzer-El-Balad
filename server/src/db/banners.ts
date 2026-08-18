import { query } from './index';

const BANNER_COLS = `
  b.id::text AS "_id",
  b.title, b.subtitle, b.image, b."buttonText", b."buttonLink",
  b.position::text AS "position",
  b."sortOrder" AS "order",
  b."isActive", b."createdAt", b."updatedAt"`;

export const active = async (): Promise<Record<string, unknown>[]> =>
  (await query(
    `SELECT ${BANNER_COLS} FROM banners b WHERE b."isActive" = true ORDER BY b."sortOrder", b.id`,
  )) as Record<string, unknown>[];

export const list = async (): Promise<Record<string, unknown>[]> =>
  (await query(`SELECT ${BANNER_COLS} FROM banners b ORDER BY b."sortOrder", b.id`)) as Record<string, unknown>[];

export const getById = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${BANNER_COLS} FROM banners b WHERE b.id = $1::uuid LIMIT 1`, [id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const create = async (data: {
  title: string;
  subtitle?: string;
  image?: string;
  buttonText?: string;
  buttonLink?: string;
  position?: string;
  order?: number;
  isActive?: boolean;
}): Promise<Record<string, unknown> | null> => {
  const r = await query<{ id: string }>(
    `INSERT INTO banners (title, subtitle, image, "buttonText", "buttonLink", position, "sortOrder", "isActive")
     VALUES ($1, $2, $3, $4, $5, $6::banner_position, $7, $8) RETURNING id`,
    [data.title, data.subtitle ?? '', data.image ?? '', data.buttonText ?? '', data.buttonLink ?? '',
     data.position ?? 'home', Number(data.order) || 0, data.isActive ?? true],
  );
  if (!r.length) return null;
  return getById(r[0].id);
};

export const update = async (id: string, data: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
  const sets: string[] = [];
  const values: unknown[] = [id];
  const nxt = () => values.length;
  const push = (col: string, v: unknown) => { values.push(v); sets.push(`"${col}" = $${nxt()}`); };

  if (data.title !== undefined) push('title', data.title);
  if (data.subtitle !== undefined) push('subtitle', data.subtitle);
  if (data.image !== undefined) push('image', data.image);
  if (data.buttonText !== undefined) push('buttonText', data.buttonText);
  if (data.buttonLink !== undefined) push('buttonLink', data.buttonLink);
  if (data.position !== undefined) push('position', data.position as string);
  if (data.order !== undefined) push('sortOrder', Number(data.order));
  if (data.isActive !== undefined) push('isActive', Boolean(data.isActive));

  if (!sets.length) return getById(id);
  const r = await query(
    `UPDATE banners SET ${sets.join(', ')} WHERE id = $1::uuid RETURNING id`,
    values,
  );
  if (!r.length) return null;
  return getById(id);
};

export const toggle = async (id: string): Promise<Record<string, unknown> | null> => {
  const r = await query('UPDATE banners SET "isActive" = NOT "isActive" WHERE id = $1::uuid RETURNING id', [id]);
  if (!r.length) return null;
  return getById(id);
};

export const remove = async (id: string): Promise<boolean> => {
  const r = await query('DELETE FROM banners WHERE id = $1::uuid RETURNING id', [id]);
  return r.length > 0;
};