import type { Request, Response } from 'express';
import * as notificationsRepo from '../db/notifications';
import { apiErrorFromPg } from '../db';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import type { AuthRequest } from '../middlewares/auth';

export const getForUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const result = await notificationsRepo.listForUser(req.user!.id, req.user!.role, page, limit);
  res.json(new ApiResponse(200, { ...result, page, limit }));
});

export const markRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const notification = await notificationsRepo.markRead(req.params.id, req.user!.id);
  if (!notification) throw new ApiError(404, 'Notification not found');
  res.json(new ApiResponse(200, notification));
});

export const markAllRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  await notificationsRepo.markAllRead(req.user!.id);
  res.json(new ApiResponse(200, null, 'All marked as read'));
});

export const sendToUsers = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { userIds?: string[]; title?: string; titleEn?: string; body?: string; bodyEn?: string; type?: string; link?: string };
  if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
    throw new ApiError(400, 'userIds are required');
  }
  if (!body.title) throw new ApiError(400, 'Notification title is required');
  try {
    await notificationsRepo.sendToUsers({
      userIds: body.userIds,
      title: body.title,
      titleEn: body.titleEn,
      body: body.body,
      bodyEn: body.bodyEn,
      type: body.type,
      link: body.link,
    });
    res.status(201).json(new ApiResponse(201, null, 'Notifications sent'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});