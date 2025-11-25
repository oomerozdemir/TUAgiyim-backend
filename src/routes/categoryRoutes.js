import { Router } from 'express';
import { listCategories, getCategory, updateCategory, createCategory, deleteCategory } from '../controllers/categoryController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/isAdmin.js';

const router = Router();
router.get('/', listCategories);
router.post('/', protect, isAdmin, createCategory);
router.delete('/:id', protect, isAdmin, deleteCategory);
router.get('/:id', getCategory)
router.put('/:id', protect, isAdmin, updateCategory)

export default router;
