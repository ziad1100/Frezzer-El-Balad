import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { z, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';

export const objectId = (message = 'Invalid id') =>
  z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, message);

export const zodBody =
  <T>(schema: ZodType<T>): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      req.body = result.data;
      next();
      return;
    }
    if (result.error instanceof ZodError) {
      const messages = result.error.issues.map((i) => i.message);
      next(new ApiError(422, messages.join(' | ')));
      return;
    }
    next(new ApiError(422, 'Invalid request body'));
  };