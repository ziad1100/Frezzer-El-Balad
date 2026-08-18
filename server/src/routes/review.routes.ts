import { Router } from 'express';
import * as review from '../controllers/review.controller';
import { requireAuth, requirePermission, requireRole } from '../middlewares/auth';
import { logActivity } from '../middlewares/activityLogger';
import { zodBody } from '../middlewares/zod';
import { cached, invalidateCache } from '../middlewares/cache';
import { reviewsLimiter } from '../middlewares/rateLimiter';
import { ROLES } from '../constants';
import {
  quickReviewCreateSchema,
  restaurantReviewCreateSchema,
  reviewCreateSchema,
  reviewModerateSchema,
  reviewUpdateSchema,
} from '../schemas';

const router = Router();

const pageSuffix = (suffix: string) => (req: { url: string }) =>
  `${suffix}:${new URL(req.url, 'http://x').searchParams.get('page') ?? '1'}`;

router.get(
  '/meal/:mealId',
  cached({ resource: 'reviews', ttl: 60, suffix: pageSuffix('meal'), skip: (req) => Boolean(new URL(req.url, 'http://x').searchParams.get('refresh')) }),
  review.listByProduct,
);

router.get(
  '/product/:productId',
  cached({ resource: 'reviews', ttl: 60, suffix: pageSuffix('product'), skip: (req) => Boolean(new URL(req.url, 'http://x').searchParams.get('refresh')) }),
  review.listByProduct,
);

router.get(
  '/restaurant',
  cached({ resource: 'reviews', ttl: 60, suffix: 'restaurant' }),
  review.restaurant,
);

const STAFF = [ROLES.ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE] as const;

router.get('/admin', requireAuth, requireRole(...STAFF), requirePermission('reviews', 'read'), review.adminList);
router.get('/admin/stats', requireAuth, requireRole(...STAFF), requirePermission('reviews', 'read'), review.adminStats);
router.delete('/admin/:id', requireAuth, requireRole(...STAFF), requirePermission('reviews', 'delete'), invalidateCache('products', 'reviews'), review.adminRemove);

router.get('/order/:orderId', requireAuth, review.orderState);
router.get('/pending-orders', requireAuth, review.pendingOrders);
router.get('/eligible/:productId', requireAuth, review.eligible);
router.get('/my', requireAuth, review.myReviews);
router.get('/:id', requireAuth, review.getOne);

router.patch(
  '/:id/moderate',
  requireAuth,
  requireRole(...STAFF),
  requirePermission('reviews', 'update'),
  zodBody(reviewModerateSchema),
  logActivity('moderate', 'reviews'),
  invalidateCache('products', 'reviews'),
  review.moderate,
);

router.post('/quick', requireAuth, reviewsLimiter, zodBody(quickReviewCreateSchema), invalidateCache('products', 'reviews'), review.createQuick);
router.post('/', requireAuth, reviewsLimiter, zodBody(reviewCreateSchema), invalidateCache('products', 'reviews'), review.create);
router.post('/restaurant', requireAuth, reviewsLimiter, zodBody(restaurantReviewCreateSchema), invalidateCache('reviews'), review.createRestaurant);
router.patch('/:id', requireAuth, reviewsLimiter, zodBody(reviewUpdateSchema), invalidateCache('products', 'reviews'), review.update);
router.delete('/:id', requireAuth, reviewsLimiter, invalidateCache('products', 'reviews'), review.remove);

export default router;
