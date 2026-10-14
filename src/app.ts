import express from "express";

import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import productRoutes from "./routes/product.routes";
import categoryRoutes from "./routes/category.routes";
import cartRoutes from "./routes/cart.routes";
import orderRoutes from "./routes/order.routes";
const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "E-Commerce API is running",
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);

export default app;