import { Router } from 'express';
import * as wishlist from '../controllers/wishlist.controller';
import { requireAuth } from '../middlewares/auth';

const router = Router();
router.use(requireAuth);

router.get('/', wishlist.getWishlist);
router.post('/toggle/:productId', wishlist.toggle);
router.delete('/', wishlist.clear);

export default router;