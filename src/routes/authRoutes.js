import { Router } from "express";
import {
  registerUser,
  loginUser,
  getProfile,
  refreshToken,
  logout,
  updateProfile,
  changePassword,
  listUsers
} from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshToken);   
router.get("/profile", protect, getProfile);
router.post("/logout", logout);
router.get("/users", protect, isAdmin, listUsers);

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);       
router.put("/change-password", protect, changePassword);
export default router;
