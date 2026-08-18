import rateLimit from 'express-rate-limit';

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const skipDisabled = () => process.env.DISABLE_RATE_LIMIT === '1';

export const authLimiter = rateLimit({
  windowMs: num(process.env.AUTH_WINDOW_MS, 15 * 60 * 1000),
  limit: num(process.env.AUTH_LIMIT, 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
  skip: skipDisabled,
});

export const subscribeLimiter = rateLimit({
  windowMs: num(process.env.SUBSCRIBE_WINDOW_MS, 15 * 60 * 1000),
  limit: num(process.env.SUBSCRIBE_LIMIT, 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: skipDisabled,
});

export const contactLimiter = rateLimit({
  windowMs: num(process.env.CONTACT_WINDOW_MS, 60 * 60 * 1000),
  limit: num(process.env.CONTACT_LIMIT, 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: skipDisabled,
});

export const adminApiLimiter = rateLimit({
  windowMs: num(process.env.ADMIN_WINDOW_MS, 15 * 60 * 1000),
  limit: num(process.env.ADMIN_API_LIMIT, 200),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: skipDisabled,
});

export const reviewsLimiter = rateLimit({
  windowMs: num(process.env.REVIEW_WINDOW_MS, 10 * 60 * 1000),
  limit: num(process.env.REVIEW_LIMIT, 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many review requests, please try again later.' },
  skip: skipDisabled,
});