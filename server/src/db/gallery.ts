import { query } from './index';

const GALLERY_COLS = `
  g.id::text AS "_id",
  g.title, g."titleEn", g.image,
  g."sortOrder" AS "order",
  g."isVisible", g."createdAt", g."updatedAt"`;

export const visible = async (): Promise<Record<string, unknown>[]> =>
  (await query(
    `SELECT ${GALLERY_COLS} FROM gallery_images g WHERE g."isVisible" = true ORDER BY g."sortOrder", g.id`,
  )) as Record<string, unknown>[];

export const list = async (): Promise<Record<string, unknown>[]> =>
  (await query(
    `SELECT ${GALLERY_COLS} FROM gallery_images g ORDER BY g."sortOrder", g.id`,
  )) as Record<string, unknown>[];

export const getById = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${GALLERY_COLS} FROM gallery_images g WHERE g.id = $1::uuid LIMIT 1`, [id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const create = async (data: {
  title: string;
  titleEn?: string;
  image: string;
  order?: number;
  isVisible?: boolean;
}): Promise<Record<string, unknown> | null> => {
  const r = await query<{ id: string }>(
    `INSERT INTO gallery_images (title, "titleEn", image, "sortOrder", "isVisible")
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [data.title, data.titleEn ?? '', data.image, Number(data.order) || 0, data.isVisible ?? true],
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
  if (data.titleEn !== undefined) push('titleEn', data.titleEn);
  if (data.image !== undefined) push('image', data.image);
  if (data.order !== undefined) push('sortOrder', Number(data.order));
  if (data.isVisible !== undefined) push('isVisible', Boolean(data.isVisible));

  if (!sets.length) return getById(id);
  const r = await query(
    `UPDATE gallery_images SET ${sets.join(', ')} WHERE id = $1::uuid RETURNING id`,
    values,
  );
  if (!r.length) return null;
  return getById(id);
};

export const toggle = async (id: string): Promise<Record<string, unknown> | null> => {
  const r = await query(
    'UPDATE gallery_images SET "isVisible" = NOT "isVisible" WHERE id = $1::uuid RETURNING id',
    [id],
  );
  if (!r.length) return null;
  return getById(id);
};

export const remove = async (id: string): Promise<boolean> => {
  const r = await query('DELETE FROM gallery_images WHERE id = $1::uuid RETURNING id', [id]);
  return r.length > 0;
};
