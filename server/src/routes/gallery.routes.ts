import { Router } from 'express';
import * as gallery from '../controllers/gallery.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';
import { logActivity } from '../middlewares/activityLogger';
import { zodBody } from '../middlewares/zod';
import { cached, invalidateCache } from '../middlewares/cache';
import { galleryCreateSchema, galleryUpdateSchema } from '../schemas';

const router = Router();

// Public: visible gallery images only (cached).
router.get('/public', cached({ resource: 'gallery', ttl: 300, suffix: 'public' }), gallery.publicList);

// Admin: full CRUD, permission-checked server-side.
router.use(requireAuth);
router.use(requirePermission('gallery', 'read'));

router.get('/', gallery.list);
router.post('/', requirePermission('gallery', 'create'), zodBody(galleryCreateSchema), logActivity('create', 'gallery'), invalidateCache('gallery'), gallery.create);
router.patch('/:id', requirePermission('gallery', 'update'), zodBody(galleryUpdateSchema), logActivity('update', 'gallery'), invalidateCache('gallery'), gallery.update);
router.patch('/:id/toggle', requirePermission('gallery', 'update'), invalidateCache('gallery'), gallery.toggle);
router.delete('/:id', requirePermission('gallery', 'delete'), logActivity('delete', 'gallery'), invalidateCache('gallery'), gallery.remove);

export default router;
