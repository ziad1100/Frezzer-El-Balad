import { query, withTransaction } from './index';

export const CATEGORY_COLS = `
  c.id::text AS "_id",
  c.name, c."nameEn", c.slug, c.type::text AS "type",
  c."parentId"::text AS "parentId",
  c.image, c.icon, c.description, c."descriptionEn",
  c."sortOrder" AS "order",
  c."isActive", c."createdAt", c."updatedAt"`;

export const tree = async (): Promise<Record<string, unknown>[]> => {
  const sections = (await query(`SELECT ${CATEGORY_COLS} FROM categories c WHERE c.type = 'section' AND c."isActive" = true ORDER BY c."sortOrder", c.id`)) as Record<string, unknown>[];
  const subs = (await query(`SELECT ${CATEGORY_COLS} FROM categories c WHERE c.type = 'sub' AND c."isActive" = true ORDER BY c."sortOrder", c.id`)) as Record<string, unknown>[];
  return sections.map((s) => ({
    ...s,
    children: subs.filter((x) => x.parentId === s._id),
  }));
};

export const list = async (all: boolean): Promise<Record<string, unknown>[]> =>
  (await query(
    `SELECT ${CATEGORY_COLS} FROM categories c
     ${all ? '' : 'WHERE c."isActive" = true'}
     ORDER BY c."sortOrder", c.id`,
  )) as Record<string, unknown>[];

export const getById = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${CATEGORY_COLS} FROM categories c WHERE c.id = $1::uuid LIMIT 1`, [id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const create = async (data: {
  name: string;
  nameEn?: string;
  slug: string;
  type?: string;
  icon?: string;
  image?: string;
  description?: string;
  descriptionEn?: string;
  order?: number;
  isActive?: boolean;
  parentId?: string | null;
}): Promise<Record<string, unknown>> => {
  let id = '';
  await withTransaction(async (tx) => {
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO categories (name, "nameEn", slug, type, "parentId", icon, image,
         description, "descriptionEn", "sortOrder", "isActive")
       VALUES ($1, $2, $3, $4::category_type, $5::uuid, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [data.name, data.nameEn ?? '', data.slug, data.type ?? 'section', data.parentId ?? null,
       data.icon ?? '', data.image ?? '', data.description ?? '', data.descriptionEn ?? '',
       Number(data.order) || 0, data.isActive ?? true],
    );
    id = inserted.rows[0].id;
  });
  const created = await getById(id);
  return created as Record<string, unknown>;
};

export const update = async (
  id: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown> | null> => {
  const sets: string[] = [];
  const values: unknown[] = [id];
  const nxt = () => values.length;
  const push = (col: string, v: unknown) => { values.push(v); sets.push(`"${col}" = $${nxt()}`); };

  if (data.name !== undefined) push('name', data.name);
  if (data.nameEn !== undefined) push('nameEn', data.nameEn);
  if (data.icon !== undefined) push('icon', data.icon);
  if (data.image !== undefined) push('image', data.image);
  if (data.description !== undefined) push('description', data.description);
  if (data.descriptionEn !== undefined) push('descriptionEn', data.descriptionEn);
  if (data.order !== undefined) push('sortOrder', Number(data.order));
  if (data.isActive !== undefined) push('isActive', Boolean(data.isActive));
  if (data.type !== undefined) push('type', data.type as string);
  if (data.parentId !== undefined) push('parentId', data.parentId ?? null);

  if (!sets.length) return getById(id);
  const r = await query(
    `UPDATE categories SET ${sets.join(', ')} WHERE id = $1::uuid RETURNING id`,
    values,
  );
  if (!r.length) return null;
  return getById(id);
};

export const toggle = async (id: string): Promise<Record<string, unknown> | null> => {
  const r = await query(
    'UPDATE categories SET "isActive" = NOT "isActive" WHERE id = $1::uuid RETURNING id',
    [id],
  );
  if (!r.length) return null;
  return getById(id);
};

export const remove = async (id: string): Promise<boolean> => {
  const r = await query('DELETE FROM categories WHERE id = $1::uuid RETURNING id', [id]);
  return r.length > 0;
};