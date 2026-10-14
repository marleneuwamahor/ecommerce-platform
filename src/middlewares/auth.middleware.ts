import {
  Request,
  Response,
  NextFunction,
} from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/user.model";

interface JwtPayload {
  userId: string;
}

const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
      return;
    }

    const token = authHeader.slice(7);

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      res.status(500).json({
        success: false,
        message: "JWT secret is not configured",
      });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    if (
      typeof decoded.userId !== "string" ||
      !mongoose.isValidObjectId(decoded.userId)
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
      return;
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export const authorize = (...allowedRoles: Array<"user" | "admin">) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Access denied",
      });
      return;
    }

    next();
  };
};

export default authenticate;