import { Router } from "express";

import {
  register,
  verifyEmail,
  resendVerification,
  login,
  profile,
} from "../controllers/auth.controller";

import authenticate from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", register);

router.post("/verify-email", verifyEmail);

router.post("/login", login);

router.get("/profile", authenticate, profile);

router.post("/resend-verification", resendVerification);
export default router;