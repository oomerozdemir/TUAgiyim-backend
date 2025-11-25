import { Router } from "express";
import {
  createMessage,
  getMessages,
  deleteMessage,
  toggleReadStatus,
} from "../controllers/contactController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";

const router = Router();

// Public: Herkes mesaj atabilir
router.post("/", createMessage);

// Admin: Sadece adminler mesajları görebilir ve yönetebilir
router.get("/", protect, isAdmin, getMessages);
router.delete("/:id", protect, isAdmin, deleteMessage);
router.patch("/:id/read", protect, isAdmin, toggleReadStatus);

export default router;