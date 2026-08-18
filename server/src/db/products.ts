import { ApiError } from '../utils/ApiError';
import { query, withTransaction } from './index';

export interface ProductSize {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  isAvailable: boolean;
}

export interface ProductExtra {
  id: string;
  name: string;
  nameEn: string;
  price: number;
}

const SIZES_JSON = `(SELECT COALESCE(jsonb_agg(jsonb_build_object('_id', ps.id::text, 'name', ps.name, 'nameEn', ps."nameEn", 'price', ps.price::float8, 'isAvailable', ps."isAvailable") ORDER BY ps."sortOrder"), '[]'::jsonb) FROM product_sizes ps WHERE ps."productId" = p.id)`;
const EXTRAS_JSON = `(SELECT COALESCE(jsonb_agg(jsonb_build_object('_id', pe.id::text, 'name', pe.name, 'nameEn', pe."nameEn", 'price', pe.price::float8) ORDER BY pe."sortOrder"), '[]'::jsonb) FROM product_extras pe WHERE pe."productId" = p.id)`;

/** Public product projection — category emitted as a bare id string (matches Mongoose lean). */
export const PUBLIC_COLS = `
  p.id::text AS "_id",
  p.name, p."nameEn", p.slug, p.description, p."descriptionEn",
  p."basePrice"::float8 AS "basePrice", p.images, p.ingredients, p."ingredientsEn", p.tags,
  p."categoryId"::text AS "category",
  p."isAvailable", p."isBestSeller", p."isOffer", p.discount::float8 AS "discount",
  p.rating::float8 AS "rating", p."reviewsCount", p."preparationTime", p.calories,
  p."createdAt", p."updatedAt", ${SIZES_JSON} AS "sizes", ${EXTRAS_JSON} AS "extras"`;

/** Admin projection — category emitted as a populated object {_id,name,nameEn}. */
export const ADMIN_COLS = `
  p.id::text AS "_id",
  p.name, p."nameEn", p.slug, p.description, p."descriptionEn",
  p."basePrice"::float8 AS "basePrice", p.images, p.ingredients, p."ingredientsEn", p.tags,
  CASE WHEN c.id IS NULL THEN NULL
       ELSE jsonb_build_object('_id', c.id::text, 'name', c.name, 'nameEn', c."nameEn") END AS "category",
  p."isAvailable", p."isBestSeller", p."isOffer", p.discount::float8 AS "discount",
  p.rating::float8 AS "rating", p."reviewsCount", p."preparationTime", p.calories,
  p."createdAt", p."updatedAt", ${SIZES_JSON} AS "sizes", ${EXTRAS_JSON} AS "extras"`;

interface ListFilter {
  search?: string;
  category?: string;
  section?: string;
  tags?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
  isBestSeller?: string;
  isOffer?: string;
}

const SEARCH_CLAUSE = (i: number): string => `
  (p.name ILIKE '%' || $${i} || '%'
   OR p."nameEn" ILIKE '%' || $${i} || '%'
   OR p.description ILIKE '%' || $${i} || '%'
   OR p."searchVector" @@ plainto_tsquery('simple', $${i})
   OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE '%' || $${i} || '%')
   OR EXISTS (SELECT 1 FROM unnest(p.ingredients) t WHERE t ILIKE '%' || $${i} || '%'))`;

// Products must belong to an ACTIVE category chain — an active sub under an
// active section, or a direct product of an active section. A hidden category
// hides its products consistently everywhere (menu, search, best sellers,
// offers), so the menu grouping and the APIs can never disagree.
const ACTIVE_CATEGORY_CLAUSE = `
  EXISTS (
    SELECT 1 FROM categories c
     WHERE c.id = p."categoryId"
       AND c."isActive" = true
       AND (c.type = 'section'
            OR EXISTS (SELECT 1 FROM categories s WHERE s.id = c."parentId" AND s."isActive" = true))
  )`;

const SORTS: Record<string, string> = {
  newest: 'p."createdAt" DESC, p.id',
  price_asc: 'p."basePrice" ASC, p."createdAt" DESC',
  price_desc: 'p."basePrice" DESC, p."createdAt" DESC',
  rating: 'p.rating DESC, p."createdAt" DESC',
  bestseller: 'p."sortOrder" ASC, p."isBestSeller" DESC, p.rating DESC, p."createdAt" DESC',
};

interface Page<T> {
  items: T[];
  total: number;
  pages: number;
}

const toPage = <T>(rows: Array<Record<string, unknown>>, limit: number): Page<T> => {
  const total = rows[0] ? (rows[0].__total as number) : 0;
  const items = rows.map(({ __total, ...rest }) => rest) as unknown as T[];
  return { items, total, pages: Math.max(1, Math.ceil(total / limit)) };
};

export const listProducts = async (f: ListFilter, sort: string, page: number, limit: number): Promise<Page<Record<string, unknown>>> => {
  const conds: string[] = ['p."isAvailable" = true', ACTIVE_CATEGORY_CLAUSE];
  const values: unknown[] = [];
  const nxt = () => values.length;

  if (f.search) { values.push(f.search); conds.push(SEARCH_CLAUSE(nxt())); }
  if (f.category) { values.push(f.category); conds.push(`p."categoryId" = $${nxt()}::uuid`); }
  if (f.section) { values.push(f.section); conds.push(`p."categoryId" IN (SELECT id FROM categories WHERE "parentId" = $${nxt()}::uuid)`); }
  if (f.tags) {
    values.push(f.tags.split(',').map((t) => t.trim()).filter(Boolean));
    conds.push(`p.tags && $${nxt()}::text[]`);
  }
  if (f.minPrice) { values.push(Number(f.minPrice)); conds.push(`p."basePrice" >= $${nxt()}`); }
  if (f.maxPrice) { values.push(Number(f.maxPrice)); conds.push(`p."basePrice" <= $${nxt()}`); }
  if (f.minRating) { values.push(Number(f.minRating)); conds.push(`p.rating >= $${nxt()}`); }
  if (f.isBestSeller === 'true') conds.push('p."isBestSeller" = true');
  if (f.isOffer === 'true') conds.push('p."isOffer" = true');

  const order = SORTS[sort] ?? SORTS.bestseller;
  const sql = `SELECT count(*) OVER()::int AS __total, ${PUBLIC_COLS}
    FROM products p
    WHERE ${conds.join(' AND ')}
    ORDER BY ${order}
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  const rows = (await query(sql, [...values, limit, (page - 1) * limit])) as Array<Record<string, unknown>>;
  return toPage(rows, limit);
};

export const adminList = async (
  page: number, limit: number, q: string, availability: string, category: string,
): Promise<Page<Record<string, unknown>>> => {
  const conds: string[] = [];
  const values: unknown[] = [];
  const nxt = () => values.length;

  if (availability === 'available') conds.push('p."isAvailable" = true');
  if (availability === 'hidden') conds.push('p."isAvailable" = false');
  if (category) { values.push(category); conds.push(`p."categoryId" = $${nxt()}::uuid`); }
  if (q) {
    values.push(q);
    conds.push(`(p.name ILIKE '%' || $${nxt()} || '%' OR p."nameEn" ILIKE '%' || $${nxt()} || '%')`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const sql = `SELECT count(*) OVER()::int AS __total, ${ADMIN_COLS}
    FROM products p
    LEFT JOIN categories c ON c.id = p."categoryId"
    ${where}
    ORDER BY p."sortOrder", p."createdAt" DESC, p.id
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  const rows = (await query(sql, [...values, limit, (page - 1) * limit])) as Array<Record<string, unknown>>;
  return toPage(rows, limit);
};

// Best sellers are grouped by section following the admin-controlled category
// display order (categories."sortOrder" — the same order the menu uses), so the
// home-page widget and the menu can never disagree. Within each section the
// best sellers are ordered by rating. Unassigned products fall back to the
// category's own sortOrder, then to the end.
const BEST_SELLER_ORDER = `
  COALESCE(
    (SELECT s."sortOrder" FROM categories sub JOIN categories s ON s.id = sub."parentId" WHERE sub.id = p."categoryId"),
    (SELECT c."sortOrder" FROM categories c WHERE c.id = p."categoryId"),
    9999
  )`;

export const bestSellers = async (): Promise<Record<string, unknown>[]> =>
  (await query(`SELECT ${PUBLIC_COLS} FROM products p
    WHERE p."isAvailable" = true AND ${ACTIVE_CATEGORY_CLAUSE} AND p."isBestSeller" = true
    ORDER BY ${BEST_SELLER_ORDER} ASC, p.rating DESC, p."createdAt" DESC LIMIT 10`)) as Record<string, unknown>[];

export const offers = async (): Promise<Record<string, unknown>[]> =>
  (await query(`SELECT ${PUBLIC_COLS} FROM products p
    WHERE p."isAvailable" = true AND ${ACTIVE_CATEGORY_CLAUSE} AND p."isOffer" = true
    ORDER BY p.discount DESC, p."createdAt" DESC LIMIT 10`)) as Record<string, unknown>[];

export const getBySlug = async (slug: string): Promise<Record<string, unknown> | null> =>
  ((await query(`SELECT ${PUBLIC_COLS} FROM products p WHERE p.slug = $1 LIMIT 1`, [slug]))[0] as Record<string, unknown>) ?? null;

export const getById = async (id: string): Promise<Record<string, unknown> | null> =>
  ((await query(`SELECT ${PUBLIC_COLS} FROM products p WHERE p.id = $1::uuid LIMIT 1`, [id]))[0] as Record<string, unknown>) ?? null;

export const getByIdAdmin = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${ADMIN_COLS} FROM products p LEFT JOIN categories c ON c.id = p."categoryId" WHERE p.id = $1::uuid LIMIT 1`, [id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

export const exists = async (id: string): Promise<boolean> => {
  const rows = await query<{ ok: boolean }>('SELECT true AS ok FROM products WHERE id = $1::uuid LIMIT 1', [id]);
  return rows.length > 0;
};

const syncSizes = async (client: typeof query, productId: string, sizes: Array<{ name: string; nameEn?: string; price: number; isAvailable?: boolean }> | undefined) => {
  await client('DELETE FROM product_sizes WHERE "productId" = $1', [productId]);
  for (const [i, s] of (sizes ?? []).entries()) {
    await client(
      `INSERT INTO product_sizes ("productId", "sortOrder", name, "nameEn", price, "isAvailable")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, i, s.name, s.nameEn ?? '', Number(s.price) || 0, s.isAvailable ?? true],
    );
  }
};

const syncExtras = async (client: typeof query, productId: string, extras: Array<{ name: string; nameEn?: string; price: number }> | undefined) => {
  await client('DELETE FROM product_extras WHERE "productId" = $1', [productId]);
  for (const [i, e] of (extras ?? []).entries()) {
    await client(
      `INSERT INTO product_extras ("productId", "sortOrder", name, "nameEn", price)
       VALUES ($1, $2, $3, $4, $5)`,
      [productId, i, e.name, e.nameEn ?? '', Number(e.price) || 0],
    );
  }
};

export const create = async (data: {
  name: string;
  nameEn?: string;
  slug: string;
  description?: string;
  descriptionEn?: string;
  basePrice: number;
  images?: string[];
  ingredients?: string[];
  ingredientsEn?: string[];
  tags?: string[];
  category?: string;
  isAvailable?: boolean;
  isBestSeller?: boolean;
  isOffer?: boolean;
  discount?: number;
  preparationTime?: number;
  calories?: number;
  sizes?: Array<{ name: string; nameEn?: string; price: number; isAvailable?: boolean }>;
  extras?: Array<{ name: string; nameEn?: string; price: number }>;
  sortOrder?: number;
}): Promise<Record<string, unknown>> => {
  let id = '';
  await withTransaction(async (tx) => {
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO products (name, "nameEn", slug, description, "descriptionEn", "basePrice", images,
        ingredients, "ingredientsEn", tags, "categoryId", "isAvailable", "isBestSeller", "isOffer",
        discount, "preparationTime", calories, "sortOrder")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [data.name, data.nameEn ?? '', data.slug, data.description ?? '', data.descriptionEn ?? '',
       Number(data.basePrice) || 0, data.images ?? [], data.ingredients ?? [], data.ingredientsEn ?? [],
       data.tags ?? [], data.category ?? null, data.isAvailable ?? true, data.isBestSeller ?? false,
       data.isOffer ?? false, Number(data.discount) || 0, Number(data.preparationTime) || 20,
       Number(data.calories) || 0, Number(data.sortOrder) || 0],
    );
    id = inserted.rows[0].id;
    await syncSizes(tx.query.bind(tx), id, data.sizes);
    await syncExtras(tx.query.bind(tx), id, data.extras);
  });
  const created = await getByIdAdmin(id);
  if (!created) throw new ApiError(500, 'Product creation failed');
  return created;
};

export const update = async (
  id: string,
  data: {
    name?: string; nameEn?: string; description?: string; descriptionEn?: string;
    basePrice?: number; images?: string[]; ingredients?: string[]; ingredientsEn?: string[]; tags?: string[];
    category?: string; isAvailable?: boolean; isBestSeller?: boolean; isOffer?: boolean;
    discount?: number; preparationTime?: number; calories?: number;
    sizes?: Array<{ name: string; nameEn?: string; price: number; isAvailable?: boolean }>;
    extras?: Array<{ name: string; nameEn?: string; price: number }>;
  },
): Promise<Record<string, unknown> | null> => {
  let updated = false;
  await withTransaction(async (tx) => {
    const sets: string[] = [];
    const values: unknown[] = [id];
    const nxt = () => values.length;
    const push = (col: string, v: unknown) => { values.push(v); sets.push(`"${col}" = $${nxt()}`); };

    if (data.name !== undefined) push('name', data.name);
    if (data.nameEn !== undefined) push('nameEn', data.nameEn);
    if (data.description !== undefined) push('description', data.description);
    if (data.descriptionEn !== undefined) push('descriptionEn', data.descriptionEn);
    if (data.basePrice !== undefined) push('basePrice', Number(data.basePrice));
    if (data.images !== undefined) push('images', data.images);
    if (data.ingredients !== undefined) push('ingredients', data.ingredients);
    if (data.ingredientsEn !== undefined) push('ingredientsEn', data.ingredientsEn);
    if (data.tags !== undefined) push('tags', data.tags);
    if (data.category !== undefined) push('categoryId', data.category ?? null);
    if (data.isAvailable !== undefined) push('isAvailable', data.isAvailable);
    if (data.isBestSeller !== undefined) push('isBestSeller', data.isBestSeller);
    if (data.isOffer !== undefined) push('isOffer', data.isOffer);
    if (data.discount !== undefined) push('discount', Number(data.discount));
    if (data.preparationTime !== undefined) push('preparationTime', Number(data.preparationTime));
    if (data.calories !== undefined) push('calories', Number(data.calories));

    if (sets.length) {
      const result = await tx.query(`UPDATE products SET ${sets.join(', ')} WHERE id = $1 RETURNING id`, values);
      updated = result.rowCount !== null && result.rowCount > 0;
    }
    if (data.sizes !== undefined) await syncSizes(tx.query.bind(tx), id, data.sizes);
    if (data.extras !== undefined) await syncExtras(tx.query.bind(tx), id, data.extras);
  });
  if (!updated) return null;
  return getByIdAdmin(id);
};

export const remove = async (id: string): Promise<boolean> => {
  const r = await query('DELETE FROM products WHERE id = $1::uuid RETURNING id', [id]);
  return r.length > 0;
};

export const toggleAvailable = async (id: string): Promise<Record<string, unknown> | null> => {
  const r = await query(
    'UPDATE products SET "isAvailable" = NOT "isAvailable" WHERE id = $1::uuid RETURNING id', [id],
  );
  if (!r.length) return null;
  return getByIdAdmin(id);
};