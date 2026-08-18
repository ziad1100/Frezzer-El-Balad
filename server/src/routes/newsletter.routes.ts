import { Router } from 'express';
import * as newsletter from '../controllers/newsletter.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';
import { subscribeLimiter } from '../middlewares/rateLimiter';
import { zodBody } from '../middlewares/zod';
import { newsletterSubscribeSchema, newsletterUnsubscribeSchema } from '../schemas';

const router = Router();

router.post('/subscribe', subscribeLimiter, zodBody(newsletterSubscribeSchema), newsletter.subscribe);
router.post('/unsubscribe', subscribeLimiter, zodBody(newsletterUnsubscribeSchema), newsletter.unsubscribe);

router.use(requireAuth);
router.use(requirePermission('newsletter', 'read'));

router.get('/', newsletter.list);

export default router;