import { Router } from 'express';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { isAdmin } from '../middlewares/isAdmin.js';
import { protect } from "../middlewares/authMiddleware.js";
import { softAuth } from '../middlewares/softAuth.js';

const router = Router();

router.get('/', softAuth, listProducts);
router.get('/:id', getProduct);
router.post('/', protect, isAdmin, createProduct);
router.put('/:id', protect, isAdmin, updateProduct);
router.delete('/:id', protect, isAdmin, deleteProduct);

export default router;
