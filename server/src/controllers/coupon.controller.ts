import type { Request, Response } from 'express';
import * as couponsRepo from '../db/coupons';
import { apiErrorFromPg } from '../db';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { validateCoupon } from '../services/coupon.service';
import type { AuthRequest } from '../middlewares/auth';

export const validate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { code, subtotal } = req.body as { code: string; subtotal?: number };
  const result = await validateCoupon(code, req.user!.id, Number(subtotal) || 0);
  res.json(new ApiResponse(200, result, 'Coupon applied'));
});

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await couponsRepo.list()));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  try {
    const coupon = await couponsRepo.create(req.body as Record<string, unknown>);
    if (!coupon) throw new ApiError(500, 'Coupon creation failed');
    res.status(201).json(new ApiResponse(201, coupon, 'Coupon created'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  try {
    const coupon = await couponsRepo.update(req.params.id, req.body as Record<string, unknown>);
    if (!coupon) throw new ApiError(404, 'Coupon not found');
    res.json(new ApiResponse(200, coupon, 'Coupon updated'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!(await couponsRepo.remove(req.params.id))) throw new ApiError(404, 'Coupon not found');
    res.json(new ApiResponse(200, null, 'Coupon deleted'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});