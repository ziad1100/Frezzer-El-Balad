import type { Request, Response } from 'express';
import * as contactsRepo from '../db/contacts';
import { apiErrorFromPg } from '../db';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const submit = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { name?: string; phone?: string; email?: string; message?: string };
  if (!body.name || !body.phone || !body.message) {
    throw new ApiError(400, 'Name, phone and message are required');
  }
  try {
    const contact = await contactsRepo.create({
      name: body.name,
      phone: body.phone,
      email: body.email,
      message: body.message,
    });
    if (!contact) throw new ApiError(500, 'Message not saved');
    res.status(201).json(new ApiResponse(201, contact, 'Message sent'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const result = await contactsRepo.list(page, limit);
  res.json(new ApiResponse(200, { ...result, page }));
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const contact = await contactsRepo.markRead(req.params.id);
  if (!contact) throw new ApiError(404, 'Message not found');
  res.json(new ApiResponse(200, contact));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!(await contactsRepo.remove(req.params.id))) throw new ApiError(404, 'Message not found');
    res.json(new ApiResponse(200, null, 'Message deleted'));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});