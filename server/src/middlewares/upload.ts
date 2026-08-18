import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import env from '../config/env';
import { cloudinaryConfigured } from '../config/cloudinary';
import { ApiError } from '../utils/ApiError';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Serverless (Vercel): the function filesystem is ephemeral, so stage uploads
// in the writable temp dir. Persistent hosts keep the repo-relative uploads dir.
export const uploadsDir = process.env.VERCEL === '1'
  ? path.join(os.tmpdir(), 'orabi-uploads')
  : path.resolve(__dirname, '../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const IMAGE_EXTENSIONS: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};
const CLIENT_MIME_TYPES = Object.values(IMAGE_EXTENSIONS);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (IMAGE_EXTENSIONS[ext] && CLIENT_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only image files are allowed'));
  }
};

/** Magic-byte sniff — rejects files whose first bytes do not match the claimed image type. */
const signatureMatches = (ext: string, buffer: Buffer): boolean => {
  const hex = buffer.toString('hex');
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return hex.startsWith('ffd8ff');
    case '.png':
      return hex.startsWith('89504e470d0a1a0a');
    case '.gif':
      return hex.startsWith('4749463837') || hex.startsWith('4749463839');
    case '.webp':
      return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    case '.avif': {
      const brand = buffer.toString('ascii', 8, 12);
      return buffer.toString('ascii', 4, 8) === 'ftyp' && /^(avif|avis|av01)/.test(brand);
    }
    default:
      return false;
  }
};

/**
 * Post-save verification: reads the stored file and deletes it if the bytes are
 * not a real image of the saved extension. Runs after multer has written the file.
 */
export const validateUploadedImage = (mode: 'single' | 'multiple'): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const files = mode === 'single' ? (req.file ? [req.file] : []) : (req.files as Express.Multer.File[]) ?? (req.file ? [req.file] : []);
    for (const file of files) {
      const ext = path.extname(file.filename).toLowerCase();
      let buffer: Buffer;
      try {
        buffer = fs.readFileSync(path.join(uploadsDir, file.filename));
      } catch {
        next(new ApiError(400, 'Uploaded file is not readable'));
        return;
      }
      if (!signatureMatches(ext, buffer)) {
        fs.unlinkSync(path.join(uploadsDir, file.filename));
        next(new ApiError(400, 'File content does not match its image type'));
        return;
      }
    }
    next();
  };
};

export const uploadSingle = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
}).single('image');

export const uploadMultiple = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
}).array('images', 10);

export const deleteLocalFile = (filePath: string): void => {
  const full = filePath.startsWith('/') ? filePath : path.join(uploadsDir, filePath);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
  }
};

export const localFileUrl = (fileName: string): string => {
  return `${env.isProd ? env.clientUrl : `http://localhost:${env.port}`}/uploads/${fileName}`;
};

export const isCloudinaryActive = cloudinaryConfigured;