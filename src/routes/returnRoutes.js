import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import { 
  createReturnRequest, 
  listMyReturns, 
  listAllReturns, 
  updateReturnStatus 
} from "../controllers/returnController.js";

const router = Router();

// User
router.post("/", protect, createReturnRequest);
router.get("/my", protect, listMyReturns);

// Admin
router.get("/", protect, isAdmin, listAllReturns);
router.patch("/:id/status", protect, isAdmin, updateReturnStatus);

export default router;