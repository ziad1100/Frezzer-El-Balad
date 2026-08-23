import type { Response } from 'express';
import * as serviceTokensRepo from '../db/serviceTokens';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import type { AuthRequest } from '../middlewares/auth';

/** Generate a new service token. The raw token is returned ONCE. */
export const generateToken = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, scope } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ApiError(400, 'Token name is required');
  }
  const tokenScope = Array.isArray(scope) ? scope : ['print'];
  const { id, rawToken } = await serviceTokensRepo.createToken(req.user!.id, name.trim(), tokenScope);
  res.status(201).json(new ApiResponse(201, { id, name: name.trim(), scope: tokenScope, rawToken },
    'Token created — copy it now, it will not be shown again'));
});

/** List all service tokens for the current user. */
export const listTokens = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tokens = await serviceTokensRepo.listByUser(req.user!.id);
  res.json(new ApiResponse(200, tokens));
});

/** Revoke a service token. */
export const revokeToken = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ok = await serviceTokensRepo.revoke(req.params.id, req.user!.id);
  if (!ok) throw new ApiError(404, 'Token not found');
  res.json(new ApiResponse(200, null, 'Token revoked'));
});
