import { Router } from "express";
import { handlePaypackWebhook } from "../controllers/payment-webhook.controller";

const router = Router();

router.head("/", handlePaypackWebhook);
router.post("/", handlePaypackWebhook);

export default router;