import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../controllers/addressController.js";

const router = Router();

router.use(protect);

router.get("/addresses", getAddresses);
router.post("/addresses", createAddress);
router.put("/addresses/:id", updateAddress);
router.delete("/addresses/:id", deleteAddress);
router.post("/addresses/:id/default", setDefaultAddress);

export default router;
