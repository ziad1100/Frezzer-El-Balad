import type { NextFunction, RequestHandler } from 'express';

export const asyncHandler =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fn: (...args: any[]) => unknown): RequestHandler =>
  (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next as NextFunction);
  };