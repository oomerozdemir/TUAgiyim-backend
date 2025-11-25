import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import { createOrder, listMyOrders, listAllOrders, updateOrderStatus } from "../controllers/orderController.js";

const router = Router();

router.use(protect);          // tüm order işlemleri login ister
router.post("/", createOrder);
router.get("/my", listMyOrders); 

// Admin tüm siparişleri görür
router.get("/admin", protect, isAdmin, listAllOrders);

// Admin sipariş durumunu günceller
router.patch("/:id/status", protect, isAdmin, updateOrderStatus);

export default router;
