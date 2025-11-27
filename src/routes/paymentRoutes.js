import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { startPayment, paymentCallback } from "../controllers/paymentController.js";

const router = Router();

router.post("/start", protect, startPayment);

router.post("/callback", paymentCallback);

export default router