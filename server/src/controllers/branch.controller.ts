import type { Request, Response } from 'express';
import * as branchesRepo from '../db/branches';
import { apiErrorFromPg } from '../db';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await branchesRepo.list(true)));
});

export const listAll = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await branchesRepo.list(false)));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  try {
    const branch = await branchesRepo.create(req.body as Record<string, unknown>);
    if (!branch) throw new ApiError(500, 'Branch creation failed');
    res.status(201).json(new ApiResponse(201, branch, 'Branch created'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  try {
    const branch = await branchesRepo.update(req.params.id, req.body as Record<string, unknown>);
    if (!branch) throw new ApiError(404, 'Branch not found');
    res.json(new ApiResponse(200, branch, 'Branch updated'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!(await branchesRepo.remove(req.params.id))) throw new ApiError(404, 'Branch not found');
    res.json(new ApiResponse(200, null, 'Branch deleted'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});