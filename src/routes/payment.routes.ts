
import { Router } from "express";
import { initiateCheckout } from "../controllers/payment.controller";
import authenticate from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.post("/orders/:orderId/checkout", initiateCheckout);

export default router;
