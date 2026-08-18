import { Router } from 'express';
import type { RequestHandler } from 'express';
import * as upload from '../controllers/upload.controller';
import { requireAuth } from '../middlewares/auth';
import { uploadMultiple, uploadSingle, validateUploadedImage } from '../middlewares/upload';

const router = Router();
router.use(requireAuth);

const verifySingle = validateUploadedImage('single') as RequestHandler;
const verifyMultiple = validateUploadedImage('multiple') as RequestHandler;

router.post('/single', uploadSingle, verifySingle, upload.uploadSingle);
router.post('/multiple', uploadMultiple, verifyMultiple, upload.uploadMultiple);
router.get('/', upload.listFiles);
router.delete('/:filename', upload.removeFile);

export default router;