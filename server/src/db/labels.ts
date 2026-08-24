import { query, withTransaction } from './index';

const LABEL_COLS = `
  l.id::text AS "_id",
  l.name, l."nameEn", l.color, l.icon,
  l."isActive", l."createdAt", l."updatedAt"`;

/** List all labels (optionally only active ones). */
export const list = async (all = false): Promise<Record<string, unknown>[]> =>
  (await query(
    `SELECT ${LABEL_COLS} FROM labels l
     ${all ? '' : 'WHERE l."isActive" = true'}
     ORDER BY l.name`,
  )) as Record<string, unknown>[];

/** Get a label by ID. */
export const getById = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${LABEL_COLS} FROM labels l WHERE l.id = $1::uuid LIMIT 1`, [id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

/** Create a new label. */
export const create = async (data: { name: string; nameEn?: string; color?: string; icon?: string; isActive?: boolean }): Promise<Record<string, unknown>> => {
  const rows = await query(
    `INSERT INTO labels (name, "nameEn", color, icon, "isActive")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${LABEL_COLS}`,
    [
      data.name,
      data.nameEn ?? '',
      data.color ?? '#38BDF8',
      data.icon ?? '',
      data.isActive ?? true,
    ],
  );
  return rows[0] as Record<string, unknown>;
};

/** Update a label. */
export const update = async (id: string, data: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
  const sets: string[] = [];
  const values: unknown[] = [id];
  const nxt = () => values.length;
  const push = (col: string, v: unknown) => { values.push(v); sets.push(`"${col}" = $${nxt()}`); };

  if (data.name !== undefined) push('name', data.name);
  if (data.nameEn !== undefined) push('nameEn', data.nameEn);
  if (data.color !== undefined) push('color', data.color);
  if (data.icon !== undefined) push('icon', data.icon);
  if (data.isActive !== undefined) push('isActive', Boolean(data.isActive));

  if (!sets.length) return getById(id);
  push('updatedAt', new Date().toISOString());

  const r = await query(`UPDATE labels SET ${sets.join(', ')} WHERE id = $1::uuid RETURNING id`, values);
  if (!r.length) return null;
  return getById(id);
};

/** Delete a label (only if no products use it). */
export const remove = async (id: string): Promise<{ ok: boolean; inUse: boolean }> => {
  const usage = await query('SELECT 1 FROM product_labels WHERE "labelId" = $1::uuid LIMIT 1', [id]);
  if (usage.length) return { ok: false, inUse: true };
  const r = await query('DELETE FROM labels WHERE id = $1::uuid RETURNING id', [id]);
  return { ok: r.length > 0, inUse: false };
};

/** Get labels for a specific product. */
export const getLabelsForProduct = async (productId: string): Promise<Record<string, unknown>[]> =>
  (await query(
    `SELECT ${LABEL_COLS} FROM labels l
     JOIN product_labels pl ON pl."labelId" = l.id
     WHERE pl."productId" = $1::uuid
     ORDER BY l.name`,
    [productId],
  )) as Record<string, unknown>[];

/** Set labels for a product (replace all). */
export const setLabelsForProduct = async (productId: string, labelIds: string[]): Promise<void> => {
  await withTransaction(async (tx) => {
    await tx.query('DELETE FROM product_labels WHERE "productId" = $1::uuid', [productId]);
    for (const labelId of labelIds) {
      await tx.query(
        'INSERT INTO product_labels ("productId", "labelId") VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING',
        [productId, labelId],
      );
    }
  });
};

/** Get all labels with product counts. */
export const listWithCounts = async (): Promise<Record<string, unknown>[]> =>
  (await query(
    `SELECT ${LABEL_COLS},
       (SELECT count(*)::int FROM product_labels pl WHERE pl."labelId" = l.id) AS "productCount"
     FROM labels l
     ORDER BY l.name`,
  )) as Record<string, unknown>[];
