import type { Request, Response } from 'express';
import * as inventoryRepo from '../db/inventory';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

/** Get inventory statistics for admin dashboard */
export const getInventoryStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await inventoryRepo.getInventoryStats();
  res.json(new ApiResponse(200, stats));
});

/** Get sales/outgoing statistics */
export const getSalesStats = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const stats = await inventoryRepo.getSalesStats(startDate, endDate);
  res.json(new ApiResponse(200, stats));
});

/** Update stock quantity for a product or size */
export const updateStock = asyncHandler(async (req: Request, res: Response) => {
  const { productId, sizeId, stockQuantity } = req.body;
  if (!productId) throw new ApiError(400, 'Product ID is required');
  if (typeof stockQuantity !== 'number' || stockQuantity < 0) {
    throw new ApiError(400, 'Stock quantity must be a non-negative number');
  }
  await inventoryRepo.updateStock(productId, stockQuantity, sizeId || null);
  res.json(new ApiResponse(200, null, 'Stock updated'));
});

/** Enable/disable inventory tracking for a product */
export const setTrackInventory = asyncHandler(async (req: Request, res: Response) => {
  const { productId, track } = req.body;
  if (!productId) throw new ApiError(400, 'Product ID is required');
  await inventoryRepo.setTrackInventory(productId, Boolean(track));
  res.json(new ApiResponse(200, null, 'Inventory tracking updated'));
});

/** Get stock for a specific product */
export const getStock = asyncHandler(async (req: Request, res: Response) => {
  const { productId, sizeId } = req.query as { productId?: string; sizeId?: string };
  if (!productId) throw new ApiError(400, 'Product ID is required');
  const stock = await inventoryRepo.getStock(productId, sizeId);
  res.json(new ApiResponse(200, stock));
});
