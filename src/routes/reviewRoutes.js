import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  createOrUpdateReview,
  getProductReviews,
} from "../controllers/reviewController.js";

const router = Router();

router.post("/", protect, createOrUpdateReview);

router.get("/product/:productId", protect, getProductReviews);

export default router;
