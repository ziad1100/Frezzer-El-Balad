import type { Request, Response } from 'express';
import * as productsRepo from '../db/products';
import { apiErrorFromPg, query } from '../db';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { slugifyText } from '../utils/slugify';

interface ListQuery {
  page?: string;
  limit?: string;
  search?: string;
  category?: string;
  section?: string;
  tags?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
  isBestSeller?: string;
  isOffer?: string;
}

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListQuery;
  const page = Math.max(1, Number(q.page) || 1);
  // Cap generous enough for the whole catalog in one request — the menu page
  // fetches everything once and groups/sorts client-side (no N+1 requests).
  const limit = Math.min(300, Math.max(1, Number(q.limit) || 12));
  try {
    const result = await productsRepo.listProducts(
      {
        search: q.search,
        category: q.category,
        section: q.section,
        tags: q.tags,
        minPrice: q.minPrice,
        maxPrice: q.maxPrice,
        minRating: q.minRating,
        isBestSeller: q.isBestSeller,
        isOffer: q.isOffer,
      },
      q.sort ?? 'bestseller',
      page,
      limit,
    );
    res.json(new ApiResponse(200, { ...result, page, limit }));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const adminList = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
  try {
    const result = await productsRepo.adminList(
      page,
      limit,
      String(req.query.q || ''),
      String(req.query.availability || ''),
      String(req.query.category || ''),
    );
    res.json(new ApiResponse(200, { ...result, page, limit }));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const getBestSellers = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await productsRepo.bestSellers()));
});

export const getOffers = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await productsRepo.offers()));
});

const REVIEWS_ROW_COLS = `
  r.id::text AS "_id",
  r.rating,
  r.comment,
  r.images,
  r.status,
  r."reviewType"::text AS "reviewType",
  r."isVerifiedPurchase" AS "isVerifiedPurchase",
  r."createdAt",
  jsonb_build_object('_id', u.id::text, 'fullName', u."fullName", 'avatar', u.avatar) AS "user"`;

export const getProductBySlug = asyncHandler(async (req: Request, res: Response) => {
  const product = await productsRepo.getBySlug(req.params.slug);
  if (!product || product.isAvailable !== true) throw new ApiError(404, 'Product not found');
  const reviews = await query(
    `SELECT ${REVIEWS_ROW_COLS}
     FROM reviews r
     JOIN users u ON u.id = r."userId"
     WHERE r."productId" = $1::uuid AND r."reviewType" = 'meal' AND r.status = 'published'
     ORDER BY r."createdAt" DESC
     LIMIT 20`,
    [product._id],
  );
  res.json(new ApiResponse(200, { ...product, reviews }));
});

export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const product = await productsRepo.getById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  res.json(new ApiResponse(200, product));
});

export const toggleProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productsRepo.toggleAvailable(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  res.json(new ApiResponse(200, product));
});

const TEXT_FIELDS = ['name', 'nameEn', 'description', 'descriptionEn'] as const;
const ARRAY_FIELDS = ['ingredients', 'ingredientsEn', 'tags'] as const;

const sanitizeBody = (body: Record<string, unknown>) => {
  const clean: Record<string, unknown> = {};
  for (const f of TEXT_FIELDS) if (body[f] !== undefined) clean[f] = body[f];
  for (const f of ARRAY_FIELDS) {
    if (body[f] !== undefined) clean[f] = Array.isArray(body[f]) ? body[f] : String(body[f]).split(',').map((s) => s.trim());
  }
  if (body.category) clean.category = body.category;
  if (body.images !== undefined) clean.images = body.images;
  if (body.sizes !== undefined) clean.sizes = body.sizes;
  if (body.extras !== undefined) clean.extras = body.extras;
  for (const f of ['basePrice', 'discount', 'preparationTime', 'calories'] as const) {
    if (body[f] !== undefined) clean[f] = Number(body[f]);
  }
  for (const f of ['isAvailable', 'isBestSeller', 'isOffer'] as const) {
    if (body[f] !== undefined) clean[f] = Boolean(body[f]);
  }
  return clean;
};

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const body = sanitizeBody(req.body);
  if (!body.name) throw new ApiError(400, 'Product name is required');
  const slug = slugifyText((body.nameEn as string) || (body.name as string));
  body.slug = `${slug}-${Date.now().toString(36)}`;
  try {
    const product = await productsRepo.create(body as never);
    res.status(201).json(new ApiResponse(201, product, 'Product created'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const body = sanitizeBody(req.body);
  try {
    const product = await productsRepo.update(req.params.id, body as never);
    if (!product) throw new ApiError(404, 'Product not found');
    res.json(new ApiResponse(200, product, 'Product updated'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!(await productsRepo.remove(req.params.id))) throw new ApiError(404, 'Product not found');
    res.json(new ApiResponse(200, null, 'Product deleted'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});