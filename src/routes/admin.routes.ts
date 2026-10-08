import { Router } from "express";
import authenticate, {
  authorize,
} from "../middlewares/auth.middleware";

const router = Router();

router.get(
  "/dashboard",
  authenticate,
  authorize("admin"),
  (req, res) => {
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
  }
);

export default router;