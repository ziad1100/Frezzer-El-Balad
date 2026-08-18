import { Router } from 'express';
import * as contact from '../controllers/contact.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';
import { contactLimiter } from '../middlewares/rateLimiter';
import { zodBody } from '../middlewares/zod';
import { contactSchema } from '../schemas';

const router = Router();

router.post('/', contactLimiter, zodBody(contactSchema), contact.submit);

router.use(requireAuth);
router.use(requirePermission('contacts', 'read'));

router.get('/', contact.list);
router.patch('/:id/read', contact.markRead);
router.delete('/:id', requirePermission('contacts', 'delete'), contact.remove);

export default router;