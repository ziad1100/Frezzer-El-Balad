import { query, withTransaction } from './index';
import { ApiError } from '../utils/ApiError';

const REVIEW_COLS = `
  r.id::text AS "_id",
  r."userId"::text AS "user",
  r."productId"::text AS "product",
  r."orderId"::text AS "orderId",
  r."reviewType"::text AS "reviewType",
  r.status,
  r.rating, r.comment, r.images,
  r."isVerifiedPurchase" AS "isVerifiedPurchase",
  r."foodQuality" AS "foodQuality", r.delivery, r.packaging, r."service" AS "service", r."overall",
  r."createdAt", r."updatedAt"`;

const REVIEW_USER_JOIN = `
  jsonb_build_object('_id', u.id::text, 'fullName', u."fullName", 'avatar', u.avatar) AS "user"`;

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

const getById = async (id: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(`SELECT ${REVIEW_COLS} FROM reviews r WHERE r.id = $1::uuid LIMIT 1`, [id]);
  return (rows[0] as Record<string, unknown>) ?? null;
};

/** Full review row with the author object, restricted to the given owner (for editing). */
export const getOwned = async (id: string, userId: string): Promise<Record<string, unknown> | null> => {
  const rows = await query(
    `SELECT
       r.id::text AS "_id",
       r."productId"::text AS "product",
       r."orderId"::text AS "orderId",
       r."reviewType"::text AS "reviewType",
       r.status, r.rating, r.comment, r.images,
       r."isVerifiedPurchase" AS "isVerifiedPurchase",
       r."foodQuality" AS "foodQuality", r.delivery, r.packaging, r."service" AS "service", r."overall",
       r."createdAt", r."updatedAt",
       ${REVIEW_USER_JOIN}
     FROM reviews r
     JOIN users u ON u.id = r."userId"
     WHERE r.id = $1::uuid AND r."userId" = $2::uuid
     LIMIT 1`,
    [id, userId],
  );
  return (rows[0] as Record<string, unknown>) ?? null;
};

const summaryAggs = (where: string, values: unknown[]): Promise<Record<string, unknown>> =>
  query<Record<string, unknown>>(
    `SELECT
       count(*)::int AS total,
       COALESCE(AVG(rating), 0)::float8 AS average,
       count(*) FILTER (WHERE rating = 5)::int AS "5",
       count(*) FILTER (WHERE rating = 4)::int AS "4",
       count(*) FILTER (WHERE rating = 3)::int AS "3",
       count(*) FILTER (WHERE rating = 2)::int AS "2",
       count(*) FILTER (WHERE rating = 1)::int AS "1"
     FROM reviews r WHERE ${where}`,
    values,
  ).then((rows) => rows[0] ?? { total: 0, average: 0, '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 });

/** Recompute a product's public rating aggregates (published meal reviews only). */
const refreshProductRating = async (
  productId: string,
  exec: (text: string, params?: unknown[]) => Promise<unknown> = query,
): Promise<void> => {
  await exec(
    `UPDATE products SET
       rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews
                         WHERE "productId" = $1 AND "reviewType" = 'meal' AND status = 'published'), 0),
       "reviewsCount" = (SELECT count(*) FROM reviews
                         WHERE "productId" = $1 AND "reviewType" = 'meal' AND status = 'published')
     WHERE id = $1::uuid`,
    [productId],
  );
};

export const listByProduct = async (
  productId: string,
  page: number,
  limit: number,
): Promise<Page<Record<string, unknown>> & { summary: Record<string, unknown> }> => {
  const [rows, summary] = await Promise.all([
    query(
      `SELECT count(*) OVER()::int AS __total,
         r.id::text AS "_id",
         r."productId"::text AS "product",
         r."orderId"::text AS "orderId",
         r."reviewType"::text AS "reviewType",
         r.status, r.rating, r.comment, r.images,
         r."isVerifiedPurchase" AS "isVerifiedPurchase",
         r."createdAt", r."updatedAt",
         ${REVIEW_USER_JOIN}
       FROM reviews r
       JOIN users u ON u.id = r."userId"
       WHERE r."productId" = $1::uuid AND r."reviewType" = 'meal' AND r.status = 'published'
       ORDER BY r."createdAt" DESC, r.id
       LIMIT $2 OFFSET $3`,
      [productId, limit, (page - 1) * limit],
    ),
    summaryAggs(`r."productId" = $1::uuid AND r."reviewType" = 'meal' AND r.status = 'published'`, [productId]),
  ]) as [Array<Record<string, unknown>>, Record<string, unknown>];
  return { ...toPage(rows, limit), summary };
};

export const restaurantStats = async (): Promise<Record<string, unknown>> => {
  // Overall customer rating = average over EVERY published review (meal quick
  // reviews publish instantly, restaurant experience reviews after moderation).
  // Kept in one aggregated query — no N+1, and new reviews are reflected as
  // soon as they are published (the endpoint cache is invalidated on create).
  const rows = await summaryAggs(`r.status = 'published'`, []);
  return rows;
};

/** Completed orders of a user that still have unreviewed meal items or no experience review yet. */
export const pendingOrders = async (userId: string): Promise<Record<string, unknown>[]> => {
  const rows = await query(
    `SELECT o.id::text AS "orderId", o."orderNo" AS "orderNo", o."createdAt" AS "createdAt",
       (SELECT count(*)::int FROM order_items oi
         WHERE oi."orderId" = o.id AND oi."productId" IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM reviews rv
             WHERE rv."orderId" = o.id AND rv."productId" = oi."productId"
               AND rv."userId" = $1::uuid AND rv."reviewType" = 'meal')) AS "unreviewedItems",
       EXISTS (SELECT 1 FROM reviews rv
         WHERE rv."orderId" = o.id AND rv."userId" = $1::uuid
           AND rv."reviewType" = 'restaurant') AS "hasExperienceReview"
     FROM orders o
     WHERE o."userId" = $1::uuid AND o.status = 'completed'
       AND (EXISTS (SELECT 1 FROM order_items oi
             WHERE oi."orderId" = o.id AND oi."productId" IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM reviews rv
                 WHERE rv."orderId" = o.id AND rv."productId" = oi."productId"
                   AND rv."userId" = $1::uuid AND rv."reviewType" = 'meal'))
            OR NOT EXISTS (SELECT 1 FROM reviews rv
              WHERE rv."orderId" = o.id AND rv."userId" = $1::uuid
                AND rv."reviewType" = 'restaurant'))
     ORDER BY o."createdAt" DESC
     LIMIT 5`,
    [userId],
  );
  return rows;
};

/** Completed orders of a user that contain the product and are not yet reviewed for it. */
export const eligibleOrders = async (
  userId: string,
  productId: string,
): Promise<Record<string, unknown>[]> => {
  const rows = await query(
    `SELECT o.id::text AS "_id", o."orderNo" AS "orderNo", o."createdAt" AS "createdAt"
     FROM orders o
     WHERE o."userId" = $1::uuid AND o.status = 'completed'
       AND EXISTS (SELECT 1 FROM order_items oi
                   WHERE oi."orderId" = o.id AND oi."productId" = $2::uuid)
       AND NOT EXISTS (SELECT 1 FROM reviews r
                       WHERE r."orderId" = o.id AND r."productId" = $2::uuid
                         AND r."userId" = $1::uuid AND r."reviewType" = 'meal')
     ORDER BY o."createdAt" DESC
     LIMIT 20`,
    [userId, productId],
  );
  return rows;
};

/** Eligible products of a completed order + which are already reviewed + existing experience review. */
export const orderReviewState = async (
  userId: string,
  orderId: string,
): Promise<Record<string, unknown> | null> => {
  const order = await query<{ _id: string; status: string; orderNo: string }>(
    `SELECT id::text AS "_id", status::text AS status, "orderNo" FROM orders WHERE id = $1::uuid AND "userId" = $2::uuid LIMIT 1`,
    [orderId, userId],
  );
  if (!order.length) return null;
  const [items, restaurant] = await Promise.all([
    query(
      `SELECT oi."productId"::text AS "productId", p.name, p."nameEn", p.slug, p.images,
              oi.name AS "itemName", oi.qty, oi.size,
              rv.id::text AS "reviewId", rv.rating AS "reviewRating"
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi."productId"
       LEFT JOIN reviews rv ON rv."orderId" = oi."orderId" AND rv."productId" = oi."productId"
          AND rv."reviewType" = 'meal' AND rv."userId" = $1::uuid
       WHERE oi."orderId" = $2::uuid AND oi."productId" IS NOT NULL
       ORDER BY oi."sortOrder"`,
      [userId, orderId],
    ),
    query(
      `SELECT id::text AS "_id", r.rating, r.comment, r."foodQuality" AS "foodQuality", r.delivery,
              r.packaging, r."service" AS "service", r."overall", r."createdAt", r."updatedAt"
       FROM reviews r
       WHERE r."orderId" = $1::uuid AND r."userId" = $2::uuid AND r."reviewType" = 'restaurant'
       LIMIT 1`,
      [orderId, userId],
    ),
  ]);
  return { order: order[0], items, restaurant: (restaurant[0] as Record<string, unknown>) ?? null };
};

export const createMeal = async (
  userId: string,
  orderId: string,
  productId: string,
  rating: number,
  comment: string,
): Promise<Record<string, unknown>> => {
  let reviewId = '';
  try {
    await withTransaction(async (tx) => {
      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO reviews ("userId", "productId", "orderId", "reviewType", rating, comment,
           "isVerifiedPurchase", status)
         SELECT $1::uuid, $2::uuid, o.id, 'meal', $4, $5, true, 'pending'
         FROM orders o
         WHERE o.id = $3::uuid AND o."userId" = $1::uuid AND o.status = 'completed'
           AND EXISTS (SELECT 1 FROM order_items oi
                       WHERE oi."orderId" = o.id AND oi."productId" = $2::uuid)
         RETURNING id`,
        [userId, productId, orderId, rating, comment],
      );
      if (!inserted.rows.length) {
        throw new ApiError(400, 'You can only review meals from your own completed orders');
      }
      reviewId = inserted.rows[0].id;
      await refreshProductRating(productId, (t, p) => tx.query(t, p));
    });
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') {
      throw new ApiError(409, 'You have already reviewed this meal for this order');
    }
    throw err;
  }
  const review = await getById(reviewId);
  if (!review) throw new ApiError(500, 'Review creation failed');
  return review;
};

/**
 * Inline quick review from a meal card: no order required, published
 * immediately. One per user + meal (enforced by the partial unique index in
 * migration 006 for order-less reviews).
 */
export const createQuick = async (
  userId: string,
  productId: string,
  rating: number,
  comment: string,
): Promise<Record<string, unknown>> => {
  let reviewId = '';
  try {
    await withTransaction(async (tx) => {
      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO reviews ("userId", "productId", "reviewType", rating, comment,
           "isVerifiedPurchase", status)
         VALUES ($1::uuid, $2::uuid, 'meal', $3, $4, false, 'published')
         RETURNING id`,
        [userId, productId, rating, comment],
      );
      reviewId = inserted.rows[0].id;
      await refreshProductRating(productId, (t, p) => tx.query(t, p));
    });
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') {
      throw new ApiError(409, 'You have already reviewed this meal');
    }
    throw err;
  }
  const review = await getById(reviewId);
  if (!review) throw new ApiError(500, 'Review creation failed');
  return review;
};

export const createRestaurant = async (
  userId: string,
  orderId: string,
  rating: number,
  comment: string,
  categories: { foodQuality?: number; delivery?: number; packaging?: number; service?: number; overall?: number },
): Promise<Record<string, unknown>> => {
  let reviewId = '';
  try {
    await withTransaction(async (tx) => {
      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO reviews ("userId", "orderId", "reviewType", rating, comment, "isVerifiedPurchase", status,
           "foodQuality", delivery, packaging, service, "overall")
         SELECT $1::uuid, o.id, 'restaurant', $3, $4, true, 'pending', $5, $6, $7, $8, $9
         FROM orders o
         WHERE o.id = $2::uuid AND o."userId" = $1::uuid AND o.status = 'completed'
         RETURNING id`,
        [userId, orderId, rating, comment, categories.foodQuality ?? null, categories.delivery ?? null,
         categories.packaging ?? null, categories.service ?? null, categories.overall ?? null],
      );
      if (!inserted.rows.length) {
        throw new ApiError(400, 'You can only rate your own completed orders');
      }
      reviewId = inserted.rows[0].id;
    });
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') {
      throw new ApiError(409, 'You have already rated this order');
    }
    throw err;
  }
  const review = await getById(reviewId);
  if (!review) throw new ApiError(500, 'Review creation failed');
  return review;
};

export const update = async (
  reviewId: string,
  userId: string,
  rating: number | undefined,
  comment: string | undefined,
  categories?: { foodQuality?: number; delivery?: number; packaging?: number; service?: number; overall?: number },
): Promise<Record<string, unknown> | null> => {
  const r = await query<{ id: string; productId: string; reviewType: string }>(
    `UPDATE reviews SET
       "updatedAt" = now(),
       rating = COALESCE($3::int, rating),
       comment = COALESCE($4::text, comment),
       "foodQuality" = CASE WHEN "reviewType" = 'restaurant' THEN COALESCE($5::smallint, "foodQuality") ELSE "foodQuality" END,
       delivery = CASE WHEN "reviewType" = 'restaurant' THEN COALESCE($6::smallint, delivery) ELSE delivery END,
       packaging = CASE WHEN "reviewType" = 'restaurant' THEN COALESCE($7::smallint, packaging) ELSE packaging END,
       "service" = CASE WHEN "reviewType" = 'restaurant' THEN COALESCE($8::smallint, "service") ELSE "service" END,
       "overall" = CASE WHEN "reviewType" = 'restaurant' THEN COALESCE($9::smallint, "overall") ELSE "overall" END
     WHERE id = $1::uuid AND "userId" = $2::uuid
     RETURNING id, "productId", "reviewType"`,
    [
      reviewId,
      userId,
      rating ?? null,
      comment ?? null,
      categories?.foodQuality ?? null,
      categories?.delivery ?? null,
      categories?.packaging ?? null,
      categories?.service ?? null,
      categories?.overall ?? null,
    ],
  );
  if (!r.length) return null;
  const row = r[0];
  if (row.reviewType === 'meal' && row.productId) {
    await refreshProductRating(row.productId);
  }
  return getById(reviewId);
};

export const remove = async (reviewId: string, userId: string): Promise<boolean> => {
  const r = await query<{ productId: string; reviewType: string }>(
    `DELETE FROM reviews WHERE id = $1::uuid AND "userId" = $2::uuid
     RETURNING "productId", "reviewType"`,
    [reviewId, userId],
  );
  if (!r.length) return false;
  const row = r[0];
  if (row.reviewType === 'meal' && row.productId) {
    await refreshProductRating(row.productId);
  }
  return true;
};

export const adminRemove = async (reviewId: string): Promise<boolean> => {
  const r = await query<{ productId: string; reviewType: string }>(
    `DELETE FROM reviews WHERE id = $1::uuid RETURNING "productId", "reviewType"`,
    [reviewId],
  );
  if (!r.length) return false;
  const row = r[0];
  if (row.reviewType === 'meal' && row.productId) {
    await refreshProductRating(row.productId);
  }
  return true;
};

export const moderate = async (reviewId: string, status: string): Promise<Record<string, unknown> | null> => {
  const r = await query<{ productId: string; reviewType: string }>(
    `UPDATE reviews SET status = $2::review_status WHERE id = $1::uuid
     RETURNING "productId", "reviewType"`,
    [reviewId, status],
  );
  if (!r.length) return null;
  const row = r[0];
  if (row.reviewType === 'meal' && row.productId) {
    await refreshProductRating(row.productId);
  }
  return getById(reviewId);
};

export const myList = async (
  userId: string,
  page: number,
  limit: number,
): Promise<Page<Record<string, unknown>>> => {
  const rows = (await query(
    `SELECT count(*) OVER()::int AS __total,
       r.id::text AS "_id",
       r."userId"::text AS "user",
       r."productId"::text AS "product",
       r."orderId"::text AS "orderId",
       r."reviewType"::text AS "reviewType",
       r.status, r.rating, r.comment, r.images,
       r."isVerifiedPurchase" AS "isVerifiedPurchase",
       r."createdAt", r."updatedAt",
       CASE WHEN p.id IS NULL THEN NULL
            ELSE jsonb_build_object('_id', p.id::text, 'name', p.name, 'nameEn', p."nameEn", 'images', p.images)
       END AS "productRef"
     FROM reviews r
     LEFT JOIN products p ON p.id = r."productId"
     WHERE r."userId" = $1::uuid
     ORDER BY r."createdAt" DESC, r.id
     LIMIT $2 OFFSET $3`,
    [userId, limit, (page - 1) * limit],
  )) as unknown as Array<Record<string, unknown>>;
  return toPage(rows, limit);
};

export const adminList = async (
  page: number,
  limit: number,
  q: string,
  status: string,
  rating: string,
  reviewType: string,
  productId: string,
  sort: string,
  verified: string,
): Promise<Page<Record<string, unknown>>> => {
  const conds: string[] = [];
  const values: unknown[] = [];
  const nxt = () => values.length;

  if (status === 'pending' || status === 'published' || status === 'hidden') {
    values.push(status);
    conds.push(`r.status = $${nxt()}::review_status`);
  }
  if (rating === '1' || rating === '2' || rating === '3' || rating === '4' || rating === '5') {
    values.push(Number(rating));
    conds.push(`r.rating = $${nxt()}`);
  }
  if (reviewType === 'meal' || reviewType === 'restaurant') {
    values.push(reviewType);
    conds.push(`r."reviewType" = $${nxt()}::review_type`);
  }
  if (productId) {
    values.push(productId);
    conds.push(`r."productId" = $${nxt()}::uuid`);
  }
  if (verified === '1' || verified === '0') {
    values.push(verified === '1');
    conds.push(`r."isVerifiedPurchase" = $${nxt()}`);
  }
  if (q) {
    values.push(q, q, q, q);
    conds.push(
      `(EXISTS (SELECT 1 FROM products pp WHERE pp.id = r."productId"
          AND (pp.name ILIKE '%' || $${values.length - 3} || '%' OR pp."nameEn" ILIKE '%' || $${values.length - 2} || '%'))
        OR u."fullName" ILIKE '%' || $${values.length - 1} || '%'
        OR r.comment ILIKE '%' || $${values.length} || '%')`,
    );
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const orderDir = sort === 'oldest' ? 'ASC' : 'DESC';
  const rows = (await query(
    `SELECT count(*) OVER()::int AS __total,
       r.id::text AS "_id",
       r."orderId"::text AS "orderId",
       r."reviewType"::text AS "reviewType",
       r.status, r.rating, r.comment, r.images,
       r."isVerifiedPurchase" AS "isVerifiedPurchase",
       r."createdAt", r."updatedAt",
       jsonb_build_object('_id', u.id::text, 'fullName', u."fullName", 'avatar', u.avatar, 'email', u.email) AS "user",
       CASE WHEN p.id IS NULL THEN NULL
            ELSE jsonb_build_object('_id', p.id::text, 'name', p.name, 'nameEn', p."nameEn", 'images', p.images)
       END AS "product"
     FROM reviews r
     JOIN users u ON u.id = r."userId"
     LEFT JOIN products p ON p.id = r."productId"
     ${where}
     ORDER BY r."createdAt" ${orderDir}, r.id
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit],
  )) as unknown as Array<Record<string, unknown>>;
  return toPage(rows, limit);
};

export const adminStats = async (): Promise<Record<string, unknown>> => {
  const rows = await query(`
    SELECT
      (SELECT count(*)::int FROM reviews) AS "total",
      (SELECT count(*)::int FROM reviews WHERE "reviewType" = 'meal' AND status = 'published') AS "published",
      (SELECT count(*)::int FROM reviews WHERE status = 'pending') AS "pending",
      (SELECT count(*)::int FROM reviews WHERE status = 'hidden') AS "hidden",
      (SELECT count(*)::int FROM reviews WHERE "createdAt"::date = CURRENT_DATE) AS "today",
      (SELECT count(*)::int FROM reviews WHERE "reviewType" = 'meal' AND status = 'published' AND rating = 5) AS "fiveStar",
      (SELECT count(*)::int FROM reviews WHERE "reviewType" = 'meal' AND status = 'published' AND rating = 1) AS "oneStar",
      (SELECT COALESCE(AVG(rating), 0)::float8 FROM reviews WHERE "reviewType" = 'meal' AND status = 'published') AS "average",
      (SELECT count(*)::int FROM reviews WHERE "reviewType" = 'restaurant' AND status = 'published') AS "restaurantTotal",
      (SELECT COALESCE(AVG(rating), 0)::float8 FROM reviews WHERE "reviewType" = 'restaurant' AND status = 'published') AS "restaurantAverage",
      (SELECT COALESCE(jsonb_agg(t ORDER BY reviews DESC), '[]'::jsonb) FROM (
         SELECT p.id::text AS "_id", p.name, p."nameEn", count(*)::int AS reviews
         FROM reviews r JOIN products p ON p.id = r."productId"
         WHERE r."reviewType" = 'meal' AND r.status = 'published'
         GROUP BY p.id) t) AS "mostReviewed",
      (SELECT COALESCE(jsonb_agg(t ORDER BY average DESC, reviews DESC), '[]'::jsonb) FROM (
         SELECT p.id::text AS "_id", p.name, p."nameEn", count(*)::int AS reviews,
                ROUND(AVG(r.rating)::numeric, 2)::float8 AS average
         FROM reviews r JOIN products p ON p.id = r."productId"
         WHERE r."reviewType" = 'meal' AND r.status = 'published'
         GROUP BY p.id) t) AS "highestRated",
      (SELECT COALESCE(jsonb_agg(t ORDER BY average ASC, reviews DESC), '[]'::jsonb) FROM (
         SELECT p.id::text AS "_id", p.name, p."nameEn", count(*)::int AS reviews,
                ROUND(AVG(r.rating)::numeric, 2)::float8 AS average
         FROM reviews r JOIN products p ON p.id = r."productId"
         WHERE r."reviewType" = 'meal' AND r.status = 'published'
         GROUP BY p.id) t) AS "lowestRated"`);
  return rows[0] as Record<string, unknown>;
};
