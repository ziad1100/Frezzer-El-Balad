import type { Request, Response } from 'express';
import * as bannersRepo from '../db/banners';
import { apiErrorFromPg } from '../db';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const active = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await bannersRepo.active()));
});

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await bannersRepo.list()));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  try {
    const banner = await bannersRepo.create(req.body as never);
    if (!banner) throw new ApiError(500, 'Banner creation failed');
    res.status(201).json(new ApiResponse(201, banner, 'Banner created'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  try {
    const banner = await bannersRepo.update(req.params.id, req.body as Record<string, unknown>);
    if (!banner) throw new ApiError(404, 'Banner not found');
    res.json(new ApiResponse(200, banner, 'Banner updated'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const toggle = asyncHandler(async (req: Request, res: Response) => {
  const banner = await bannersRepo.toggle(req.params.id);
  if (!banner) throw new ApiError(404, 'Banner not found');
  res.json(new ApiResponse(200, banner));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!(await bannersRepo.remove(req.params.id))) throw new ApiError(404, 'Banner not found');
    res.json(new ApiResponse(200, null, 'Banner deleted'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});