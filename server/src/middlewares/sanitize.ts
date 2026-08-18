import type { RequestHandler } from 'express';

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.')) continue; // drop Mongo operators / dotted keys
    out[key] = sanitizeValue(v);
  }
  return out;
};

/** Strips "$"-prefixed (query-operator) and dotted keys from JSON bodies — Mongo-sanitize equivalent. */
export const sanitizeJson: RequestHandler = (req, _res, next) => {
  if (isPlainObject(req.body)) req.body = sanitizeValue(req.body);
  next();
};