import { query } from './index';

export const POST_COLS = `
  p.id::text AS "_id",
  p.title, p."titleEn", p.slug, p.excerpt, p."excerptEn",
  p.content, p."contentEn", p.image, p.tags,
  p."publishedAt", p."isPublished", p."createdAt", p."updatedAt"`;

interface Page<T> {
  items: T[];
  total: number;
  pages: number;
}

const toPage = <T>(rows: Array<Record<string, unknown>>, limit: number, maxPages: boolean): Page<T> => {
  const total = rows[0] ? (rows[0].__total as number) : 0;
  const items = rows.map(({ __total, ...rest }) => rest) as unknown as T[];
  return { items, total, pages: maxPages ? Math.max(1, Math.ceil(total / limit)) : Math.ceil(total / limit) };
};

export const listPublished = async (page: number, limit: number): Promise<Page<Record<string, unknown>>> => {
  const rows = await query(
    `SELECT count(*) OVER()::int AS __total, ${POST_COLS}
     FROM posts p
     WHERE p."isPublished" = true
     ORDER BY p."publishedAt" DESC, p.id
     LIMIT $1 OFFSET $2`,
    [limit, (page - 1) * limit],
  ) as unknown as Array<Record<string, unknown>>;
  return toPage(rows, limit, false);
};

export const getBySlug = async (slug: string, publishedOnly = true): Promise<Record<string, unknown> | null> => {
  const rows = await query(
    `SELECT ${POST_COLS} FROM posts p
     WHERE p.slug = $1 ${publishedOnly ? 'AND p."isPublished" = true' : ''} LIMIT 1`,
    [slug],
  );
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const listAll = async (q: string, page: number, limit: number): Promise<Page<Record<string, unknown>>> => {
  const values: unknown[] = [];
  let where = '';
  if (q) {
    values.push(q);
    where = `WHERE (p.title ILIKE '%' || $${values.length} || '%'
             OR p."titleEn" ILIKE '%' || $${values.length} || '%'
             OR p.slug ILIKE '%' || $${values.length} || '%')`;
  }
  const rows = await query(
    `SELECT count(*) OVER()::int AS __total, ${POST_COLS}
     FROM posts p
     ${where}
     ORDER BY p."publishedAt" DESC, p.id
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit],
  ) as unknown as Array<Record<string, unknown>>;
  return toPage(rows, limit, true);
};

export const exists = async (slug: string, excludeId?: string): Promise<boolean> => {
  const rows = await query<{ ok: boolean }>(
    `SELECT true AS ok FROM posts WHERE slug = $1 ${excludeId ? 'AND id <> $2::uuid' : ''} LIMIT 1`,
    excludeId ? [slug, excludeId] : [slug],
  );
  return rows.length > 0;
};

export const getById = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${POST_COLS} FROM posts p WHERE p.id = $1::uuid LIMIT 1`, [id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const create = async (data: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
  const r = await query<{ id: string }>(
    `INSERT INTO posts (title, "titleEn", slug, excerpt, "excerptEn", content, "contentEn",
       image, tags, "publishedAt", "isPublished")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [data.title ?? '', data.titleEn ?? '', data.slug ?? '', data.excerpt ?? '', data.excerptEn ?? '',
     data.content ?? '', data.contentEn ?? '', data.image ?? '', (data.tags as string[] | undefined) ?? [],
     data.publishedAt ?? new Date(), data.isPublished ?? true],
  );
  if (!r.length) return null;
  return getById(r[0].id);
};

export const update = async (id: string, data: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
  const sets: string[] = [];
  const values: unknown[] = [id];
  const nxt = () => values.length;
  const push = (col: string, v: unknown) => { values.push(v); sets.push(`"${col}" = $${nxt()}`); };

  for (const k of ['title', 'titleEn', 'slug', 'excerpt', 'excerptEn', 'content', 'contentEn', 'image', 'tags', 'publishedAt', 'isPublished'] as const) {
    if (data[k] !== undefined) push(k, data[k]);
  }
  if (!sets.length) return getById(id);
  const r = await query(`UPDATE posts SET ${sets.join(', ')} WHERE id = $1::uuid RETURNING id`, values);
  if (!r.length) return null;
  return getById(id);
};

export const remove = async (id: string): Promise<boolean> => {
  const r = await query('DELETE FROM posts WHERE id = $1::uuid RETURNING id', [id]);
  return r.length > 0;
};