import type { Response } from 'express';
import * as wishlistsRepo from '../db/wishlists';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import type { AuthRequest } from '../middlewares/auth';

export const getWishlist = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(new ApiResponse(200, await wishlistsRepo.getWishlist(req.user!.id)));
});

export const toggle = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await wishlistsRepo.toggle(req.user!.id, req.params.productId);
  res.json(new ApiResponse(200, result));
});

export const clear = asyncHandler(async (req: AuthRequest, res: Response) => {
  await wishlistsRepo.clear(req.user!.id);
  res.json(new ApiResponse(200, []));
});