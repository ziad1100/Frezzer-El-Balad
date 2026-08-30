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

/**
 * POST /api/system/reset-sales
 *
 * Reset sales display — admin only.
 * Sets salesClearedAt so the sales stats query only counts new orders.
 */
export const resetSalesHandler = asyncHandler(async (_req: Request, res: Response) => {
  const result = await systemResetRepo.resetSales();

  res.json(
    new ApiResponse(200, {
      ok: result.ok,
    }, 'Sales reset completed successfully'),
  );
});
