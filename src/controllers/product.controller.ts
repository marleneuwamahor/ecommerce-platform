import { Request, Response } from "express";
import mongoose from "mongoose";

import Product from "../models/product.model";
import Category from "../models/category.model";

export const createProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      description,
      price,
      stock,
      category,
      imageUrl,
    } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      price === undefined ||
      stock === undefined
    ) {
      res.status(400).json({
        success: false,
        message:
          "Name, description, price and stock are required",
      });
      return;
    }

    if (
      name.trim().length > 150 ||
      description.trim().length > 5000
    ) {
      res.status(400).json({
        success: false,
        message:
          "Name or description exceeds the allowed length",
      });
      return;
    }

    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      res.status(400).json({
        success: false,
        message: "Price must be a valid non-negative number",
      });
      return;
    }

    if (
      typeof stock !== "number" ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      res.status(400).json({
        success: false,
        message:
          "Stock must be a non-negative whole number",
      });
      return;
    }

    if (
      category !== undefined &&
      (typeof category !== "string" ||
        !mongoose.isValidObjectId(category))
    ) {
      res.status(400).json({
        success: false,
        message: "Category must be a valid category ID",
      });
      return;
    }

    if (
      category !== undefined &&
      !(await Category.exists({
        _id: category,
        isActive: true,
      }))
    ) {
      res.status(400).json({
        success: false,
        message:
          "Selected category does not exist or is inactive",
      });
      return;
    }

    if (
      imageUrl !== undefined &&
      (typeof imageUrl !== "string" ||
        imageUrl.length > 2048)
    ) {
      res.status(400).json({
        success: false,
        message: "Image URL must be a string of at most 2048 characters",
      });
      return;
    }

    const product = await Product.create({
      name: name.trim(),
      description: description.trim(),
      price,
      stock,
      category:
        typeof category === "string" ? category : undefined,
      imageUrl:
        typeof imageUrl === "string"
          ? imageUrl.trim()
          : undefined,
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
};

export const getProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      res.status(400).json({
        success: false,
        message:
          "Page must be positive and limit must be between 1 and 100",
      });
      return;
    }

    const filter: Record<string, unknown> = {
      isActive: true,
    };

    if (
      typeof req.query.category === "string" &&
      req.query.category.trim()
    ) {
      const categoryId = req.query.category.trim();

      if (!mongoose.isValidObjectId(categoryId)) {
        res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
        return;
      }

      const categoryExists = await Category.exists({
        _id: categoryId,
        isActive: true,
      });

      if (!categoryExists) {
        res.status(200).json({
          success: true,
          products: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        });
        return;
      }

      filter.category = new mongoose.Types.ObjectId(categoryId);
    }

    if (
      typeof req.query.search === "string" &&
      req.query.search.trim()
    ) {
      filter.$text = {
        $search: req.query.search.trim().slice(0, 100),
      };
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name description")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get products error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve products",
    });
  }
};

export const getProductById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const product = await Product.findOne({
      _id: id,
      isActive: true,
    }).populate("category", "name description");

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Get product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve product",
    });
  }
};

export const updateProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const allowedFields = [
      "name",
      "description",
      "price",
      "stock",
      "category",
      "imageUrl",
      "isActive",
    ];

    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body?.[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        message: "Provide at least one field to update",
      });
      return;
    }

    if (
      updates.name !== undefined &&
      (typeof updates.name !== "string" ||
        !updates.name.trim() ||
        updates.name.trim().length > 150)
    ) {
      res.status(400).json({
        success: false,
        message:
          "Name must be a non-empty string of at most 150 characters",
      });
      return;
    }

    if (
      updates.description !== undefined &&
      (typeof updates.description !== "string" ||
        !updates.description.trim() ||
        updates.description.trim().length > 5000)
    ) {
      res.status(400).json({
        success: false,
        message:
          "Description must be a non-empty string of at most 5000 characters",
      });
      return;
    }

    if (
      updates.price !== undefined &&
      (typeof updates.price !== "number" ||
        !Number.isFinite(updates.price) ||
        updates.price < 0)
    ) {
      res.status(400).json({
        success: false,
        message: "Price must be a valid non-negative number",
      });
      return;
    }

    if (
      updates.stock !== undefined &&
      (typeof updates.stock !== "number" ||
        !Number.isInteger(updates.stock) ||
        updates.stock < 0)
    ) {
      res.status(400).json({
        success: false,
        message:
          "Stock must be a non-negative whole number",
      });
      return;
    }

    if (
      updates.category !== undefined &&
      (typeof updates.category !== "string" ||
        !mongoose.isValidObjectId(updates.category))
    ) {
      res.status(400).json({
        success: false,
        message: "Category must be a valid category ID",
      });
      return;
    }

    if (
      typeof updates.category === "string" &&
      !(await Category.exists({
        _id: updates.category,
        isActive: true,
      }))
    ) {
      res.status(400).json({
        success: false,
        message:
          "Selected category does not exist or is inactive",
      });
      return;
    }

    if (
      updates.imageUrl !== undefined &&
      (typeof updates.imageUrl !== "string" ||
        updates.imageUrl.length > 2048)
    ) {
      res.status(400).json({
        success: false,
        message: "Image URL must be a string of at most 2048 characters",
      });
      return;
    }

    if (
      updates.isActive !== undefined &&
      typeof updates.isActive !== "boolean"
    ) {
      res.status(400).json({
        success: false,
        message: "isActive must be true or false",
      });
      return;
    }

    if (typeof updates.name === "string") {
      updates.name = updates.name.trim();
    }

    if (typeof updates.description === "string") {
      updates.description = updates.description.trim();
    }

    if (typeof updates.imageUrl === "string") {
      updates.imageUrl = updates.imageUrl.trim();
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    ).populate("category", "name description");

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update product",
    });
  }
};

export const deleteProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true, runValidators: true }
    );

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Product deactivated successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
};