import { Router } from 'express';
import multer from 'multer';
import { protect } from '../middlewares/authMiddleware.js';
import { uploadImages, deleteImage } from '../controllers/uploadController.js';
import { isAdmin } from '../middlewares/isAdmin.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() }); // buffer için

router.post('/', protect, isAdmin, upload.array('files', 10), uploadImages);
router.delete('/:publicId', protect, isAdmin, deleteImage);

export default router;
