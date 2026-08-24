import type { Request, Response } from 'express';
import * as labelsRepo from '../db/labels';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

/** GET /labels — list all labels (public, active only). */
export const list = asyncHandler(async (_req: Request, res: Response) => {
  const all = _req.query.all === 'true';
  const labels = await labelsRepo.list(all);
  res.json(new ApiResponse(200, labels));
});

/** GET /labels/admin — list labels with product counts. */
export const adminList = asyncHandler(async (_req: Request, res: Response) => {
  const labels = await labelsRepo.listWithCounts();
  res.json(new ApiResponse(200, labels));
});

/** GET /labels/:id — get single label. */
export const getById = asyncHandler(async (req: Request, res: Response) => {
  const label = await labelsRepo.getById(req.params.id);
  if (!label) throw new ApiError(404, 'Label not found');
  res.json(new ApiResponse(200, label));
});

/** POST /labels — create a new label. */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const { name, nameEn, color, icon, isActive } = req.body;
  if (!name || !String(name).trim()) throw new ApiError(400, 'Label name is required');
  const label = await labelsRepo.create({
    name: String(name).trim(),
    nameEn: nameEn ? String(nameEn).trim() : '',
    color: color ? String(color) : undefined,
    icon: icon ? String(icon) : undefined,
    isActive: isActive !== undefined ? Boolean(isActive) : undefined,
  });
  res.status(201).json(new ApiResponse(201, label, 'Label created'));
});

/** PATCH /labels/:id — update a label. */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const label = await labelsRepo.update(req.params.id, req.body);
  if (!label) throw new ApiError(404, 'Label not found');
  res.json(new ApiResponse(200, label, 'Label updated'));
});

/** DELETE /labels/:id — delete a label (if unused). */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const result = await labelsRepo.remove(req.params.id);
  if (!result.ok) {
    if (result.inUse) throw new ApiError(400, 'Cannot delete label that is in use by products');
    throw new ApiError(404, 'Label not found');
  }
  res.json(new ApiResponse(200, null, 'Label deleted'));
});

/** GET /labels/product/:productId — get labels for a product. */
export const getProductLabels = asyncHandler(async (req: Request, res: Response) => {
  const labels = await labelsRepo.getLabelsForProduct(req.params.productId);
  res.json(new ApiResponse(200, labels));
});

/** PUT /labels/product/:productId — set labels for a product. */
export const setProductLabels = asyncHandler(async (req: Request, res: Response) => {
  const { labelIds } = req.body;
  if (!Array.isArray(labelIds)) throw new ApiError(400, 'labelIds must be an array');
  await labelsRepo.setLabelsForProduct(req.params.productId, labelIds.map(String));
  const labels = await labelsRepo.getLabelsForProduct(req.params.productId);
  res.json(new ApiResponse(200, labels, 'Product labels updated'));
});
