import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  getCart,
  addCartItem,
  updateCartItemQty,
  removeCartItem,
  clearCart,
} from "../controllers/cartController.js";

const router = Router();

router.use(protect); // hepsi login ister
router.get("/", getCart);
router.post("/items", addCartItem);
router.patch("/items/:itemId", updateCartItemQty);
router.delete("/items/:itemId", removeCartItem);
router.delete("/", clearCart);

export default router;
