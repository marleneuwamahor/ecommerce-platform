import express from "express";
import healthRoutes from "./routes/health.routes";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "E-commerce API is running",
  });
});

app.use("/api/health", healthRoutes);

export default app;