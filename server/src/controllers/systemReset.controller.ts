import type { Request, Response } from 'express';
import * as systemResetRepo from '../db/systemReset';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * POST /api/system/reset
 *
 * Safe system reset — admin only.
 * Clears orders, carts, offers, coupon redemptions, analytics.
 * Resets product/variant prices to 0.
 * Preserves users, products, categories, variants, reviews, coupons (structure).
 */
export const systemResetHandler = asyncHandler(async (_req: Request, res: Response) => {
  const result = await systemResetRepo.systemReset();

  res.json(
    new ApiResponse(200, {
      ok: true,
      summary: {
        ordersDeleted: result.ordersDeleted,
        cartsCleared: result.cartsCleared,
        offersDeleted: result.offersDeleted,
        productsReset: result.productsReset,
        sizesReset: result.sizesReset,
        extrasReset: result.extrasReset,
      },
    }, 'System reset completed successfully'),
  );
});
