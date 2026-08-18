import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import env from '../config/env';
import cloudinary, { cloudinaryConfigured } from '../config/cloudinary';
import { uploadsDir, deleteLocalFile } from '../middlewares/upload';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const uploadSingle = asyncHandler(async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw new ApiError(400, 'No file uploaded');

  let url: string;

  if (cloudinaryConfigured) {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'pizza-house',
      transformation: [{ quality: 'auto', fetch_format: 'webp' }],
    });
    url = result.secure_url;
    deleteLocalFile(file.path);
  } else {
    url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
  }

  res.status(201).json(new ApiResponse(201, { url, filename: file.filename }));
});

export const uploadMultiple = asyncHandler(async (req: Request, res: Response) => {
  const files = (req as Request & { files?: Express.Multer.File[] }).files;
  if (!files || files.length === 0) throw new ApiError(400, 'No files uploaded');

  const urls: string[] = [];
  for (const file of files) {
    if (cloudinaryConfigured) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'pizza-house',
        transformation: [{ quality: 'auto', fetch_format: 'webp' }],
      });
      urls.push(result.secure_url);
      deleteLocalFile(file.path);
    } else {
      urls.push(`${req.protocol}://${req.get('host')}/uploads/${file.filename}`);
    }
  }
  res.status(201).json(new ApiResponse(201, { urls }));
});

export const listFiles = asyncHandler(async (_req: Request, res: Response) => {
  if (cloudinaryConfigured) {
    const result = await cloudinary.api.resources({ type: 'upload', prefix: 'pizza-house', max_results: 100 });
    res.json(new ApiResponse(200, result.resources.map((r: { secure_url?: string }) => r.secure_url)));
    return;
  }
  const files = fs.readdirSync(uploadsDir).map((f) => ({
    url: `${env.isProd ? env.clientUrl : `http://localhost:${env.port}`}/uploads/${f}`,
    name: f,
  }));
  res.json(new ApiResponse(200, files));
});

export const removeFile = asyncHandler(async (req: Request, res: Response) => {
  const filename = path.basename(String(req.params.filename || ''));
  if (!filename) throw new ApiError(400, 'Filename is required');
  if (cloudinaryConfigured) {
    await cloudinary.uploader.destroy(`pizza-house/${filename.replace(/\.[^.]+$/, '')}`);
  } else {
    deleteLocalFile(filename);
  }
  res.json(new ApiResponse(200, null, 'File deleted'));
});