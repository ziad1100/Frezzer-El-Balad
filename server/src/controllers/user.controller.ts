import type { Response } from 'express';
import * as adminUsersRepo from '../db/adminUsers';
import { apiErrorFromPg } from '../db';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import type { AuthRequest } from '../middlewares/auth';

export const listUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const search = String(req.query.search || '');
  const role = String(req.query.role || '');
  const result = await adminUsersRepo.listUsers(page, limit, search, role);
  res.json(new ApiResponse(200, { ...result, page }));
});

export const updateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const allowed = ['fullName', 'phone', 'role', 'isActive', 'avatar'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.isActive === false) {
    updates.refreshToken = null;
  }
  try {
    const user = await adminUsersRepo.updateUser(req.params.id, updates);
    if (!user) throw new ApiError(404, 'User not found');
    res.json(new ApiResponse(200, user));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    if (!(await adminUsersRepo.deleteUser(req.params.id))) throw new ApiError(404, 'User not found');
    res.json(new ApiResponse(200, null, 'User deleted'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(new ApiResponse(200, await adminUsersRepo.getProfile(req.user!.id)));
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.user!.id;
  const allowed = ['fullName', 'phone', 'avatar', 'addresses'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const user = await adminUsersRepo.updateProfile(id, updates);
  res.json(new ApiResponse(200, user));
});