import type { Request, Response } from 'express';
import * as purchasesRepo from '../db/purchases';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import type { AuthRequest } from '../middlewares/auth';

/** Create a new purchase */
export const createPurchase = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { productId, sizeId, productName, productSize, quantity, unitCost, supplier, notes, purchaseDate, weightGrams, weightMode, weightDisplay, categoryId } = req.body;

  if (!productId) throw new ApiError(400, 'Product is required');
  if (!productName) throw new ApiError(400, 'Product name is required');
  if (typeof quantity !== 'number' || quantity <= 0) throw new ApiError(400, 'Quantity must be greater than 0');
  if (typeof unitCost !== 'number' || unitCost < 0) throw new ApiError(400, 'Unit cost must be a non-negative number');

  const totalCost = quantity * unitCost;

  const purchase = await purchasesRepo.createPurchase({
    productId,
    sizeId: sizeId || null,
    productName,
    productSize: productSize || '',
    quantity,
    unitCost,
    totalCost,
    supplier: supplier || '',
    notes: notes || '',
    purchaseDate: purchaseDate || new Date().toISOString(),
    createdBy: req.user!.id,
    weightGrams: typeof weightGrams === 'number' ? weightGrams : 0,
    weightMode: weightMode || 'fixed',
    weightDisplay: weightDisplay || '',
    categoryId: categoryId || null,
  });

  res.status(201).json(new ApiResponse(201, purchase, 'Purchase recorded successfully'));
});

/** List purchases */
export const listPurchases = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const { startDate, endDate, productId } = req.query as { startDate?: string; endDate?: string; productId?: string };

  const result = await purchasesRepo.listPurchases(page, limit, startDate, endDate, productId);
  res.json(new ApiResponse(200, { ...result, page, limit }));
});

/** Get purchase statistics */
export const getPurchaseStats = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const stats = await purchasesRepo.getPurchaseStats(startDate, endDate);
  res.json(new ApiResponse(200, stats));
});

/** Delete a purchase (and reverse inventory) */
export const deletePurchase = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await purchasesRepo.deletePurchase(req.params.id);
  if (!deleted) throw new ApiError(404, 'Purchase not found');
  res.json(new ApiResponse(200, null, 'Purchase deleted'));
});

/** Get product-level report */
export const getProductReport = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.query as { productId?: string };
  if (!productId) throw new ApiError(400, 'Product ID is required');
  const report = await purchasesRepo.getProductReport(productId);
  if (!report) throw new ApiError(404, 'Product not found');
  res.json(new ApiResponse(200, report));
});
