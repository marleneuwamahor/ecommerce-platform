
import { Router } from "express";
import {
  createOrder,
  getMyOrders,
  getMyOrderById,
  getAllOrders,
  updateOrderStatus,
} from "../controllers/order.controller";
import authenticate, { authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

// Customer routes
router.post("/", createOrder);
router.get("/my-orders", getMyOrders);
router.get("/my-orders/:id", getMyOrderById);

// Admin routes
router.get("/", authorize("admin"), getAllOrders);
router.patch("/:id/status", authorize("admin"), updateOrderStatus);

export default router;
