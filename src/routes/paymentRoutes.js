import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { startPayment, paymentCallback } from "../controllers/paymentController.js";

const router = Router();

router.post("/start", protect, startPayment);

// PayTR'ın bildirim atacağı URL (Login zorunlu DEĞİL, PayTR sunucusu atar)
// Bu URL'i PayTR panelinde bildirmelisiniz veya PayTR token alırken gönderiyoruz.
router.post("/callback", paymentCallback);