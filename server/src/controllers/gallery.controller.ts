import type { Request, Response } from 'express';
import * as galleryRepo from '../db/gallery';
import { apiErrorFromPg } from '../db';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const publicList = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await galleryRepo.visible()));
});

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await galleryRepo.list()));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  try {
    const item = await galleryRepo.create(req.body as never);
    if (!item) throw new ApiError(500, 'Gallery image creation failed');
    res.status(201).json(new ApiResponse(201, item, 'Gallery image added'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  try {
    const item = await galleryRepo.update(req.params.id, req.body as Record<string, unknown>);
    if (!item) throw new ApiError(404, 'Gallery image not found');
    res.json(new ApiResponse(200, item, 'Gallery image updated'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const toggle = asyncHandler(async (req: Request, res: Response) => {
  const item = await galleryRepo.toggle(req.params.id);
  if (!item) throw new ApiError(404, 'Gallery image not found');
  res.json(new ApiResponse(200, item));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!(await galleryRepo.remove(req.params.id))) throw new ApiError(404, 'Gallery image not found');
    res.json(new ApiResponse(200, null, 'Gallery image deleted'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
