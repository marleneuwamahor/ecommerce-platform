import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "E-commerce API is healthy",
  });
});

export default router;