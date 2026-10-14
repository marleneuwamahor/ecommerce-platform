import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/user.model";

const publicUserFields =
  "name email role isActive emailVerified createdAt updatedAt";

const formatUser = (user: any) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// GET /api/admin/users
export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = Math.max(
      1,
      Number.parseInt(String(req.query.page ?? "1"), 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(String(req.query.limit ?? "20"), 10) || 20
      )
    );

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const filter: Record<string, unknown> = {};

    if (search) {
      const escapedSearch = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { email: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(publicUserFields)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: users.map(formatUser),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve users",
    });
  }
};

// GET /api/admin/users/:id
export const getUserById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.params.id;

    if (!mongoose.isValidObjectId(userId)) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
      return;
    }

    const user = await User.findById(userId).select(publicUserFields);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: formatUser(user),
    });
  } catch (error) {
    console.error("Get user error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve user",
    });
  }
};

// PATCH /api/admin/users/:id/role
export const updateUserRole = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.params.id;
    const { role } = req.body || {};

    if (!mongoose.isValidObjectId(userId)) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
      return;
    }

    if (role !== "user" && role !== "admin") {
      res.status(400).json({
        success: false,
        message: "Role must be either user or admin",
      });
      return;
    }

    if (req.user?._id.toString() === userId) {
      res.status(400).json({
        success: false,
        message: "You cannot change your own role",
      });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (
      user.role === "admin" &&
      user.isActive &&
      role !== "admin"
    ) {
      const activeAdminCount = await User.countDocuments({
        role: "admin",
        isActive: true,
      });

      if (activeAdminCount <= 1) {
        res.status(400).json({
          success: false,
          message: "You cannot demote the last active administrator",
        });
        return;
      }
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: formatUser(user),
    });
  } catch (error) {
    console.error("Update user role error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update user role",
    });
  }
};

// PATCH /api/admin/users/:id/status
export const updateUserStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.params.id;
    const { isActive } = req.body || {};

    if (!mongoose.isValidObjectId(userId)) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
      return;
    }

    if (typeof isActive !== "boolean") {
      res.status(400).json({
        success: false,
        message: "isActive must be true or false",
      });
      return;
    }

    if (req.user?._id.toString() === userId) {
      res.status(400).json({
        success: false,
        message: "You cannot deactivate or reactivate your own account",
      });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (
      !isActive &&
      user.role === "admin" &&
      user.isActive
    ) {
      const activeAdminCount = await User.countDocuments({
        role: "admin",
        isActive: true,
      });

      if (activeAdminCount <= 1) {
        res.status(400).json({
          success: false,
          message: "You cannot deactivate the last active administrator",
        });
        return;
      }
    }

    user.isActive = isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: isActive
        ? "User account activated successfully"
        : "User account deactivated successfully",
      data: formatUser(user),
    });
  } catch (error) {
    console.error("Update user status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update user status",
    });
  }
};