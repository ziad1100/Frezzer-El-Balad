import { Router } from 'express';
import { recordMovement, getMovementReport, exportMovementReport } from '../controllers/stock-movements.controller';
import { requireAuth, requireRole } from '../middlewares/auth';

const router = Router();

// All routes require admin authentication
router.use(requireAuth, requireRole('admin'));

// Record a manual stock movement (gift, waste, damage, adjustment)
router.post('/record', recordMovement);

// Get movement report for a date range
router.get('/report', getMovementReport);

// Export movement report as Excel
router.get('/export', exportMovementReport);

export default router;