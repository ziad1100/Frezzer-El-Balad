import type { Request, Response } from 'express';
import * as postsRepo from '../db/posts';
import { apiErrorFromPg } from '../db';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { slugifyText, uniqueSlug } from '../utils/slugify';

const resolveSlug = async (raw: string, excludeId?: string): Promise<string> =>
  uniqueSlug(slugifyText(String(raw || ''), 'ar'), (slug) => postsRepo.exists(slug, excludeId));

export const listPublished = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 9;
  const result = await postsRepo.listPublished(page, limit);
  res.json(new ApiResponse(200, { ...result, page }));
});

export const getBySlug = asyncHandler(async (req: Request, res: Response) => {
  const post = await postsRepo.getBySlug(req.params.slug, true);
  if (!post) throw new ApiError(404, 'Post not found');
  res.json(new ApiResponse(200, post));
});

export const listAll = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const result = await postsRepo.listAll(q, page, limit);
  res.json(new ApiResponse(200, { ...result, page, limit }));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  try {
    const base = (req.body as { slug?: string; titleEn?: string; title?: string }).slug
      || (req.body as { titleEn?: string }).titleEn
      || (req.body as { title?: string }).title;
    const slug = await resolveSlug(String(base));
    const post = await postsRepo.create({ ...(req.body as Record<string, unknown>), slug });
    if (!post) throw new ApiError(500, 'Post creation failed');
    res.status(201).json(new ApiResponse(201, post, 'Post created'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = { ...(req.body as Record<string, unknown>) };
    if (req.body.slug !== undefined || req.body.titleEn !== undefined || req.body.title !== undefined) {
      body.slug = await resolveSlug(String(req.body.slug || req.body.titleEn || req.body.title || body.slug), req.params.id);
    }
    const post = await postsRepo.update(req.params.id, body);
    if (!post) throw new ApiError(404, 'Post not found');
    res.json(new ApiResponse(200, post, 'Post updated'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!(await postsRepo.remove(req.params.id))) throw new ApiError(404, 'Post not found');
    res.json(new ApiResponse(200, null, 'Post deleted'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});