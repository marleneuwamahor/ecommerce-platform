import { Router } from "express";
import {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "../controllers/cart.controller";
import authenticate from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", getCart);
router.post("/items", addToCart);
router.patch("/items/:productId", updateCartItem);
router.delete("/items/:productId", removeFromCart);
router.delete("/", clearCart);

export default router;