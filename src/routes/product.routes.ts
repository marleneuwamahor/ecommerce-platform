import { Router } from "express";

import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller";

import authenticate, {
  authorize,
} from "../middlewares/auth.middleware";

const router = Router();

// Public catalog
router.get("/", getProducts);
router.get("/:id", getProductById);

// Administrator-only management
router.post("/", authenticate, authorize("admin"), createProduct);
router.patch("/:id", authenticate, authorize("admin"), updateProduct);
router.delete("/:id", authenticate, authorize("admin"), deleteProduct);

export default router;