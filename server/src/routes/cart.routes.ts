import { Router } from 'express';
import * as cart from '../controllers/cart.controller';
import { requireAuth } from '../middlewares/auth';
import { zodBody } from '../middlewares/zod';
import { addItemSchema, applyCouponSchema, updateItemSchema } from '../schemas';

const router = Router();
router.use(requireAuth);

router.get('/', cart.getCart);
router.post('/items', zodBody(addItemSchema), cart.addItem);
router.patch('/items/:itemId', zodBody(updateItemSchema), cart.updateItem);
router.delete('/items/:itemId', cart.removeItem);
router.post('/coupon', zodBody(applyCouponSchema), cart.applyCoupon);
router.delete('/', cart.clearCart);

export default router;