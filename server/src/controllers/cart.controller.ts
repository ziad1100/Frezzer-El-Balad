import type { Response } from 'express';
import * as cartsRepo from '../db/carts';
import * as productsRepo from '../db/products';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import type { AuthRequest } from '../middlewares/auth';

export const getCart = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(new ApiResponse(200, await cartsRepo.getCart(req.user!.id)));
});

export const addItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { product: productId, size, sizeName, extras, qty } = req.body;
  const product = await productsRepo.getById(productId);
  if (!product) throw new ApiError(404, 'Product not found');
  if (product.isAvailable !== true) throw new ApiError(400, 'Product is not available');

  const sizes = (product.sizes as Array<{ _id: string; price: number; name: string }>) ?? [];
  const selectedSize = sizes.find((s) => String(s._id) === String(size));
  const unitPrice = selectedSize?.price ?? (product.basePrice as number);

  await cartsRepo.addItem(req.user!.id, {
    product: productId,
    size: size ?? null,
    sizeName: sizeName ?? selectedSize?.name ?? '',
    extras: extras ?? [],
    qty: Number(qty) || 1,
    unitPrice,
  });
  res.json(new ApiResponse(200, await cartsRepo.getCart(req.user!.id), 'Added to cart'));
});

export const updateItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data: { qty?: number; extras?: unknown[] } = {};
  if (req.body.qty !== undefined) data.qty = Math.max(1, Number(req.body.qty));
  if (req.body.extras !== undefined) data.extras = req.body.extras as unknown[];
  const ok = await cartsRepo.updateItem(req.user!.id, req.params.itemId, data);
  if (!ok) throw new ApiError(404, 'Cart item not found');
  res.json(new ApiResponse(200, await cartsRepo.getCart(req.user!.id)));
});

export const removeItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  await cartsRepo.removeItem(req.user!.id, req.params.itemId);
  res.json(new ApiResponse(200, await cartsRepo.getCart(req.user!.id)));
});

export const applyCoupon = asyncHandler(async (req: AuthRequest, res: Response) => {
  await cartsRepo.applyCoupon(req.user!.id, String(req.body.code ?? '').toUpperCase());
  res.json(new ApiResponse(200, await cartsRepo.getCart(req.user!.id)));
});

export const clearCart = asyncHandler(async (req: AuthRequest, res: Response) => {
  await cartsRepo.clearCart(req.user!.id);
  res.json(new ApiResponse(200, { items: [] }));
});