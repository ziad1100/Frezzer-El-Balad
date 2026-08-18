import { query } from './index';

const ZONE_COLS = `
  z.id::text AS "_id",
  z.name, z."nameEn", z.fee::float8 AS "fee", z."minOrder"::float8 AS "minOrder",
  z."estimatedMinutes", z."isActive", z."createdAt", z."updatedAt"`;

export const list = async (activeOnly: boolean): Promise<Record<string, unknown>[]> =>
  (await query(
    `SELECT ${ZONE_COLS} FROM delivery_zones z
     ${activeOnly ? 'WHERE z."isActive" = true' : ''}
     ORDER BY z.fee, z.id`,
  )) as Record<string, unknown>[];

export const create = async (data: {
  name: string;
  nameEn?: string;
  fee: number;
  minOrder?: number;
  estimatedMinutes?: number;
  isActive?: boolean;
}): Promise<Record<string, unknown> | null> => {
  const r = await query<{ id: string }>(
    `INSERT INTO delivery_zones (name, "nameEn", fee, "minOrder", "estimatedMinutes", "isActive")
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [data.name, data.nameEn ?? '', Number(data.fee) || 0, Number(data.minOrder) || 0,
     Number(data.estimatedMinutes) || 30, data.isActive ?? true],
  );
  if (!r.length) return null;
  const rows = await query(`SELECT ${ZONE_COLS} FROM delivery_zones z WHERE z.id = $1::uuid LIMIT 1`, [r[0].id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};