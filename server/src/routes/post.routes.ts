import { Router } from 'express';
import * as post from '../controllers/post.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';
import { logActivity } from '../middlewares/activityLogger';
import { zodBody } from '../middlewares/zod';
import { cached, invalidateCache } from '../middlewares/cache';
import { postCreateSchema, postUpdateSchema } from '../schemas';

const router = Router();

router.get('/', cached({ resource: 'posts', ttl: 60, suffix: (req) => new URL(req.url, 'http://x').searchParams.get('page') ?? '1' }), post.listPublished);
router.get('/:slug', cached({ resource: 'posts', ttl: 60, suffix: (req) => `slug:${req.params.slug}` }), post.getBySlug);

router.use(requireAuth);
router.use(requirePermission('posts', 'read'));

router.get('/all/admin', post.listAll);
router.post('/', requirePermission('posts', 'create'), zodBody(postCreateSchema), logActivity('create', 'posts'), invalidateCache('posts'), post.create);
router.patch('/:id', requirePermission('posts', 'update'), zodBody(postUpdateSchema), logActivity('update', 'posts'), invalidateCache('posts'), post.update);
router.delete('/:id', requirePermission('posts', 'delete'), logActivity('delete', 'posts'), invalidateCache('posts'), post.remove);

export default router;