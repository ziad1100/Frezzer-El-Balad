import type { ErrorRequestHandler } from 'express';
import env from '../config/env';
import { ApiError } from '../utils/ApiError';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Express only treats 4-arg middleware as an error handler; `_next` is required for arity.
  void _next;
  let error = err as ApiError;

  if (!(error instanceof ApiError)) {
    const raw = error as { message?: string; statusCode?: number; stack?: string };
    error = new ApiError(raw.statusCode || 500, raw.message || 'Something went wrong', false, raw.stack);
  }

  if (env.nodeEnv === 'development') {
     
    console.error('[error]', error);
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(env.nodeEnv === 'development' && !error.isOperational ? { stack: error.stack } : {}),
  });
};
