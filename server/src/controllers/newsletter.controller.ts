import type { Request, Response } from 'express';
import * as newslettersRepo from '../db/newsletters';
import { apiErrorFromPg } from '../db';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { email?: string; name?: string };
  if (!body.email) throw new ApiError(400, 'Email is required');
  const existing = await newslettersRepo.getByEmail(body.email);
  if (existing) {
    if (existing.isSubscribed !== true) {
      await newslettersRepo.reconnect(body.email);
    }
    res.json(new ApiResponse(200, null, 'You are already subscribed'));
    return;
  }
  try {
    await newslettersRepo.create({ email: body.email, name: body.name });
    res.status(201).json(new ApiResponse(201, null, 'Subscribed successfully'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const unsubscribe = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) throw new ApiError(400, 'Email is required');
  try {
    const ok = await newslettersRepo.unsubscribe(email);
    res.json(new ApiResponse(200, null, ok ? 'Unsubscribed' : 'Email not found'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await newslettersRepo.list()));
});