import { Router } from 'express';
import { listUsers, updateUser, deleteUser } from '../controllers/user.controller';
import { requireAuth, requirePermission } from '../middlewares/auth';
import { logActivity } from '../middlewares/activityLogger';
import { zodBody } from '../middlewares/zod';
import { adminUpdateUserSchema } from '../schemas';
import * as activityLogsRepo from '../db/activityLogs';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('users', 'read'), listUsers);
router.patch('/:id', requirePermission('users', 'update'), zodBody(adminUpdateUserSchema), logActivity('update', 'users'), updateUser);
router.delete('/:id', requirePermission('users', 'delete'), logActivity('delete', 'users'), deleteUser);

router.get(
  '/logs/activity',
  requirePermission('activity', 'read'),
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const result = await activityLogsRepo.list(page, limit);
    res.json(new ApiResponse(200, { ...result, page }));
  }),
);

export default router;