import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import { adjustStock, stockHistory, adjustSizeStock, sizeStockHistory, adjustColorStock, colorStockHistory } from '../controllers/stockController.js';

const router = Router();

router.post('/:productId/adjust', protect, isAdmin, adjustStock);
router.get('/:productId/history', protect, isAdmin, stockHistory);

router.post('/:productId/sizes/:sizeId/adjust', protect, isAdmin, adjustSizeStock);
router.get('/:productId/sizes/:sizeId/history', protect, isAdmin, sizeStockHistory);


// renk
router.post('/:productId/colors/:colorId/adjust', protect, isAdmin, adjustColorStock);
router.get('/:productId/colors/:colorId/history', protect, isAdmin, colorStockHistory);

export default router;
