import { Router } from "express";
import authenticate, {
  authorize,
} from "../middlewares/auth.middleware";

import {
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
} from "../controllers/admin.controller";

const router = Router();

// All routes in this file require an authenticated administrator.
router.use(authenticate, authorize("admin"));

router.get("/dashboard", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the admin dashboard",
    user: {
      id: req.user?._id,
      name: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
    },
  });
});

router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.patch("/users/:id/role", updateUserRole);
router.patch("/users/:id/status", updateUserStatus);

export default router;