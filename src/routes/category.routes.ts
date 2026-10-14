import { Router } from "express";

import {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller";

import authenticate, {
  authorize,
} from "../middlewares/auth.middleware";

const router = Router();

// Public: browse categories
router.get("/", getCategories);

// Admin-only: manage categories
router.post(
  "/",
  authenticate,
  authorize("admin"),
  createCategory
);

router.patch(
  "/:id",
  authenticate,
  authorize("admin"),
  updateCategory
);

router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  deleteCategory
);

export default router;