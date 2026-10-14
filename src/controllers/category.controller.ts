import { Request, Response } from "express";
import mongoose from "mongoose";
import Category from "../models/category.model";
import Product from "../models/product.model";

export const createCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, description } = req.body || {};

    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({
        success: false,
        message: "Category name is required",
      });
      return;
    }

    if (name.trim().length > 100) {
      res.status(400).json({
        success: false,
        message: "Category name cannot exceed 100 characters",
      });
      return;
    }

    if (
      description !== undefined &&
      (typeof description !== "string" ||
        description.trim().length > 1000)
    ) {
      res.status(400).json({
        success: false,
        message:
          "Description must be a string of at most 1000 characters",
      });
      return;
    }

    const category = await Category.create({
      name: name.trim(),
      description:
        typeof description === "string"
          ? description.trim()
          : undefined,
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "A category with that name already exists",
      });
      return;
    }

    console.error("Create category error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
};

export const getCategories = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const categories = await Category.find({
      isActive: true,
    }).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve categories",
    });
  }
};

export const updateCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
      return;
    }

    const { name, description } = req.body || {};
    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100
      ) {
        res.status(400).json({
          success: false,
          message:
            "Name must be a non-empty string of at most 100 characters",
        });
        return;
      }

      updates.name = name.trim();
    }

    if (description !== undefined) {
      if (
        typeof description !== "string" ||
        description.trim().length > 1000
      ) {
        res.status(400).json({
          success: false,
          message:
            "Description must be a string of at most 1000 characters",
        });
        return;
      }

      updates.description = description.trim();
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        message: "Provide a name or description to update",
      });
      return;
    }

    const category = await Category.findOneAndUpdate(
      {
        _id: id,
        isActive: true,
      },
      {
        $set: updates,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Active category not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "A category with that name already exists",
      });
      return;
    }

    console.error("Update category error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
      return;
    }

    const category = await Category.findOne({
      _id: id,
      isActive: true,
    });

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Active category not found",
      });
      return;
    }

    const productsUsingCategory = await Product.exists({
      category: category._id,
      isActive: true,
    });

    if (productsUsingCategory) {
      res.status(409).json({
        success: false,
        message:
          "This category has active products. Move or deactivate those products before deactivating the category.",
      });
      return;
    }

    category.isActive = false;
    await category.save();

    res.status(200).json({
      success: true,
      message: "Category deactivated successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to deactivate category",
    });
  }
};