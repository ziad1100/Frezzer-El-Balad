import type { Request, Response } from 'express';
import * as systemResetRepo from '../db/systemReset';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * POST /api/system/reset
 *
 * Safe system reset — admin only.
 * Clears orders, carts, offers, coupon redemptions, analytics.
 * Preserves users, products (including prices), categories, variants, reviews, coupons (structure).
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
      },
    }, 'System reset completed successfully'),
  );
});

/**
 * POST /api/system/reset-purchases
 *
 * Reset only purchase records — admin only.
 * Clears all rows in the purchases table.
 */
export const resetPurchasesHandler = asyncHandler(async (_req: Request, res: Response) => {
  const result = await systemResetRepo.resetPurchases();

  res.json(
    new ApiResponse(200, {
      ok: true,
      summary: {
        purchasesDeleted: result.purchasesDeleted,
      },
    }, 'Purchases reset completed successfully'),
  );
});
