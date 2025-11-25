import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  toggleFavorite,
  listMyFavorites,
  isFavorited,
  listFavorites,
} from "../controllers/favoriteController.js";

const router = express.Router();

router.use(protect); 
router.get("/", protect, listMyFavorites);
router.get("/check/:productId", isFavorited);
router.post("/:productId", protect, toggleFavorite);
// tüm favoriler
router.get("/all", listFavorites);



export default router;
