import { Router } from 'express';
import * as user from '../controllers/user.controller';
import { requireAuth } from '../middlewares/auth';
import { zodBody } from '../middlewares/zod';
import { updateProfileSchema } from '../schemas';

const router = Router();
router.use(requireAuth);

router.get('/profile', user.getProfile);
router.patch('/profile', zodBody(updateProfileSchema), user.updateProfile);

export default router;