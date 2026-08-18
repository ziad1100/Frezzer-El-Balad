import type { Request, Response } from 'express';
import * as offersRepo from '../db/offers';
import { apiErrorFromPg } from '../db';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const activeOffers = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await offersRepo.activeOffers()));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const offer = await offersRepo.getActiveById(req.params.id);
  if (!offer) throw new ApiError(404, 'Offer not found');
  res.json(new ApiResponse(200, offer));
});

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await offersRepo.list()));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  try {
    const offer = await offersRepo.create(req.body as never);
    if (!offer) throw new ApiError(500, 'Offer creation failed');
    res.status(201).json(new ApiResponse(201, offer, 'Offer created'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  try {
    const offer = await offersRepo.update(req.params.id, req.body as never);
    if (!offer) throw new ApiError(404, 'Offer not found');
    res.json(new ApiResponse(200, offer, 'Offer updated'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!(await offersRepo.remove(req.params.id))) throw new ApiError(404, 'Offer not found');
    res.json(new ApiResponse(200, null, 'Offer deleted'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});