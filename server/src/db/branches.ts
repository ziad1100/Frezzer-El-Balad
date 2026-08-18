import { query } from './index';

const BRANCH_COLS = `
  b.id::text AS "_id",
  b.name, b."nameEn", b.address, b."addressEn", b.phone, b.whatsapp,
  b."workHours", b."workHoursEn", b."googleMapsUrl", b.image,
  b.lat::float8 AS "lat", b.lng::float8 AS "lng",
  b."isActive", b."createdAt", b."updatedAt"`;

export const list = async (activeOnly: boolean): Promise<Record<string, unknown>[]> =>
  (await query(
    `SELECT ${BRANCH_COLS} FROM branches b
     ${activeOnly ? 'WHERE b."isActive" = true' : ''}
     ORDER BY b."createdAt" DESC, b.id`,
  )) as Record<string, unknown>[];

export const getById = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${BRANCH_COLS} FROM branches b WHERE b.id = $1::uuid LIMIT 1`, [id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const create = async (data: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
  const r = await query<{ id: string }>(
    `INSERT INTO branches (name, "nameEn", address, "addressEn", phone, whatsapp,
       "workHours", "workHoursEn", "googleMapsUrl", image, lat, lng, "isActive")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [String(data.name ?? ''), data.nameEn ?? '', data.address ?? '', data.addressEn ?? '',
     data.phone ?? '', data.whatsapp ?? '', data.workHours ?? '', data.workHoursEn ?? '',
     data.googleMapsUrl ?? '', data.image ?? '', Number(data.lat) || 0, Number(data.lng) || 0,
     data.isActive ?? true],
  );
  if (!r.length) return null;
  return getById(r[0].id);
};

export const update = async (id: string, data: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
  const sets: string[] = [];
  const values: unknown[] = [id];
  const nxt = () => values.length;
  const push = (col: string, v: unknown) => { values.push(v); sets.push(`"${col}" = $${nxt()}`); };

  for (const k of ['name', 'nameEn', 'address', 'addressEn', 'phone', 'whatsapp', 'workHours', 'workHoursEn', 'googleMapsUrl', 'image'] as const) {
    if (data[k] !== undefined) push(k, data[k]);
  }
  if (data.lat !== undefined) push('lat', Number(data.lat));
  if (data.lng !== undefined) push('lng', Number(data.lng));
  if (data.isActive !== undefined) push('isActive', Boolean(data.isActive));

  if (!sets.length) return getById(id);
  const r = await query(`UPDATE branches SET ${sets.join(', ')} WHERE id = $1::uuid RETURNING id`, values);
  if (!r.length) return null;
  return getById(id);
};

export const remove = async (id: string): Promise<boolean> => {
  const r = await query('DELETE FROM branches WHERE id = $1::uuid RETURNING id', [id]);
  return r.length > 0;
};