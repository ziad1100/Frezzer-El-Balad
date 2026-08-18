import type { Request, Response } from 'express';
import * as categoriesRepo from '../db/categories';
import { apiErrorFromPg } from '../db';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { slugifyText } from '../utils/slugify';

export const tree = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await categoriesRepo.tree()));
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const all = req.query.all === 'true';
  res.json(new ApiResponse(200, await categoriesRepo.list(all)));
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const cat = await categoriesRepo.getById(req.params.id);
  if (!cat) throw new ApiError(404, 'Category not found');
  res.json(new ApiResponse(200, cat));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    name?: string;
    nameEn?: string;
    type?: string;
    icon?: string;
    image?: string;
    description?: string;
    descriptionEn?: string;
    order?: number;
    isActive?: boolean;
    parentId?: string | null;
  };
  if (!body.name) throw new ApiError(400, 'Category name is required');
  const slug = slugifyText((body.nameEn || body.name) as string);
  try {
    const cat = await categoriesRepo.create({
      name: body.name,
      nameEn: body.nameEn,
      slug: `${body.type ?? 'section'}-${slug}-${Date.now().toString(36)}`,
      type: body.type ?? 'section',
      icon: body.icon,
      image: body.image,
      description: body.description,
      descriptionEn: body.descriptionEn,
      order: Number(body.order) || 0,
      isActive: body.isActive ?? true,
      parentId: body.parentId ?? null,
    });
    if (!cat) throw new ApiError(500, 'Category creation failed');
    res.status(201).json(new ApiResponse(201, cat, 'Category created'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const allowed = ['name', 'nameEn', 'icon', 'image', 'description', 'descriptionEn', 'order', 'isActive', 'parentId', 'type'];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
  try {
    const cat = await categoriesRepo.update(req.params.id, updates);
    if (!cat) throw new ApiError(404, 'Category not found');
    res.json(new ApiResponse(200, cat, 'Category updated'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const toggle = asyncHandler(async (req: Request, res: Response) => {
  const cat = await categoriesRepo.toggle(req.params.id);
  if (!cat) throw new ApiError(404, 'Category not found');
  res.json(new ApiResponse(200, cat));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!(await categoriesRepo.remove(req.params.id))) throw new ApiError(404, 'Category not found');
    res.json(new ApiResponse(200, null, 'Category deleted'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});