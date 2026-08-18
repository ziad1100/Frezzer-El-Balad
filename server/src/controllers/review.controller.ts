import type { Request, Response } from 'express';
import * as reviewsRepo from '../db/reviews';
import * as productsRepo from '../db/products';
import { apiErrorFromPg } from '../db';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import type { AuthRequest } from '../middlewares/auth';

const parsePage = (raw: unknown): number => Math.max(1, Number(raw) || 1);
const parseLimit = (raw: unknown): number => Math.min(50, Math.max(1, Number(raw) || 10));
const str = (raw: unknown): string => (typeof raw === 'string' ? raw.trim() : '');

export const listByProduct = asyncHandler(async (req: Request, res: Response) => {
  const productId = str(req.params.mealId || req.params.productId);
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const result = await reviewsRepo.listByProduct(productId, page, limit);
  res.json(new ApiResponse(200, { ...result, page, limit }));
});

export const restaurant = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await reviewsRepo.restaurantStats()));
});

export const orderState = asyncHandler(async (req: AuthRequest, res: Response) => {
  const state = await reviewsRepo.orderReviewState(req.user!.id, req.params.orderId);
  if (!state) throw new ApiError(404, 'Order not found');
  res.json(new ApiResponse(200, state));
});

export const eligible = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const orders = await reviewsRepo.eligibleOrders(req.user!.id, str(req.params.productId));
    res.json(new ApiResponse(200, orders));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const pendingOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(new ApiResponse(200, await reviewsRepo.pendingOrders(req.user!.id)));
});

export const myReviews = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const result = await reviewsRepo.myList(req.user!.id, page, limit);
  res.json(new ApiResponse(200, { ...result, page, limit }));
});

export const getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
  const review = await reviewsRepo.getOwned(req.params.id, req.user!.id);
  if (!review) throw new ApiError(404, 'Review not found');
  res.json(new ApiResponse(200, review));
});

export const adminList = asyncHandler(async (req: Request, res: Response) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const result = await reviewsRepo.adminList(
    page,
    limit,
    str(req.query.q),
    str(req.query.status),
    str(req.query.rating),
    str(req.query.type),
    str(req.query.product),
    str(req.query.sort),
    str(req.query.verified),
  );
  res.json(new ApiResponse(200, { ...result, page, limit }));
});

export const adminStats = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await reviewsRepo.adminStats()));
});

export const adminRemove = asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!(await reviewsRepo.adminRemove(req.params.id))) throw new ApiError(404, 'Review not found');
    res.json(new ApiResponse(200, null, 'Review deleted'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const createQuick = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { product, rating, comment } = req.body;
  if (!(await productsRepo.exists(product))) throw new ApiError(404, 'Product not found');
  try {
    const review = await reviewsRepo.createQuick(req.user!.id, product, rating, comment ?? '');
    res.status(201).json(new ApiResponse(201, review, 'Review published'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { product, orderId, rating, comment } = req.body;
  if (!(await productsRepo.exists(product))) throw new ApiError(404, 'Product not found');
  try {
    const review = await reviewsRepo.createMeal(req.user!.id, orderId, product, rating, comment ?? '');
    res.status(201).json(new ApiResponse(201, review, 'Review submitted successfully'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const createRestaurant = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { orderId, rating, comment, foodQuality, delivery, packaging, service, overall } = req.body;
  try {
    const review = await reviewsRepo.createRestaurant(req.user!.id, orderId, rating, comment ?? '', {
      foodQuality,
      delivery,
      packaging,
      service,
      overall,
    });
    res.status(201).json(new ApiResponse(201, review, 'Review submitted successfully'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { rating, comment, foodQuality, delivery, packaging, service, overall } = req.body;
  try {
    const review = await reviewsRepo.update(req.params.id, req.user!.id, rating, comment, {
      foodQuality,
      delivery,
      packaging,
      service,
      overall,
    });
    if (!review) throw new ApiError(404, 'Review not found');
    res.json(new ApiResponse(200, review, 'Review updated'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    if (!(await reviewsRepo.remove(req.params.id, req.user!.id))) throw new ApiError(404, 'Review not found');
    res.json(new ApiResponse(200, null, 'Review deleted'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const moderate = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  const review = await reviewsRepo.moderate(req.params.id, status);
  if (!review) throw new ApiError(404, 'Review not found');
  res.json(new ApiResponse(200, review));
});
