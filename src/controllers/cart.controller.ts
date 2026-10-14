import { Request, Response } from "express";
import mongoose from "mongoose";
import Cart from "../models/cart.model";
import Product from "../models/product.model";

const getUserId = (req: Request): string | null => {
  return req.user?._id?.toString() ?? null;
};

// Add a product to the cart
export const addToCart = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const { productId, quantity = 1 } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required",
      });
      return;
    }

    if (!mongoose.isValidObjectId(productId)) {
      res.status(400).json({
        success: false,
        message: "A valid productId is required",
      });
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({
        success: false,
        message: "Quantity must be a positive whole number",
      });
      return;
    }

    const product = await Product.findOne({
      _id: productId,
      isActive: true,
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId, items: [] } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    const newQuantity = (existingItem?.quantity ?? 0) + quantity;

    if (newQuantity > product.stock) {
      res.status(400).json({
        success: false,
        message: `Only ${product.stock} units are currently available`,
      });
      return;
    }

    if (existingItem) {
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({
        product: product._id,
        quantity,
      });
    }

    await cart.save();

    res.status(200).json({
      success: true,
      message: "Product added to cart",
      data: cart,
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to add product to cart",
    });
  }
};

// View the cart and calculate the current total
export const getCart = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required",
      });
      return;
    }

    const cart = await Cart.findOne({ user: userId }).populate(
      "items.product",
      "name price stock imageUrl isActive"
    );

    if (!cart) {
      res.status(200).json({
        success: true,
        data: { items: [], total: 0, itemCount: 0 },
      });
      return;
    }

    const items = cart.items
      .map((item) => {
        const product = item.product as unknown as {
          _id: mongoose.Types.ObjectId;
          name: string;
          price: number;
          stock: number;
          imageUrl?: string;
          isActive: boolean;
        } | null;

        if (!product || !product.isActive) {
          return null;
        }

        return {
          product: {
            id: product._id,
            name: product.name,
            price: product.price,
            stock: product.stock,
            imageUrl: product.imageUrl,
          },
          quantity: item.quantity,
          subtotal: product.price * item.quantity,
        };
      })
      .filter((item) => item !== null);

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    res.status(200).json({
      success: true,
      data: {
        items,
        total: Number(total.toFixed(2)),
        itemCount,
      },
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to retrieve cart",
    });
  }
};

// Change the quantity of a cart item
export const updateCartItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required",
      });
      return;
    }

    if (!mongoose.isValidObjectId(productId)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({
        success: false,
        message: "Quantity must be a positive whole number",
      });
      return;
    }

    const product = await Product.findOne({
      _id: productId,
      isActive: true,
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    if (quantity > product.stock) {
      res.status(400).json({
        success: false,
        message: `Only ${product.stock} units are currently available`,
      });
      return;
    }

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      res.status(404).json({
        success: false,
        message: "Cart not found",
      });
      return;
    }

    const item = cart.items.find(
      (entry) => entry.product.toString() === productId
    );

    if (!item) {
      res.status(404).json({
        success: false,
        message: "Product is not in your cart",
      });
      return;
    }

    item.quantity = quantity;
    await cart.save();

    res.status(200).json({
      success: true,
      message: "Cart quantity updated",
      data: cart,
    });
  } catch (error) {
    console.error("Update cart error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update cart",
    });
  }
};

// Remove a product from the cart
export const removeFromCart = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const { productId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required",
      });
      return;
    }

    if (!mongoose.isValidObjectId(productId)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      res.status(404).json({
        success: false,
        message: "Cart not found",
      });
      return;
    }

    const originalLength = cart.items.length;

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    );

    if (cart.items.length === originalLength) {
      res.status(404).json({
        success: false,
        message: "Product is not in your cart",
      });
      return;
    }

    await cart.save();

    res.status(200).json({
      success: true,
      message: "Product removed from cart",
      data: cart,
    });
  } catch (error) {
    console.error("Remove from cart error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to remove product from cart",
    });
  }
};

// Empty the cart
export const clearCart = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required",
      });
      return;
    }

    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { $set: { items: [] } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Cart cleared",
      data: cart ?? { items: [] },
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to clear cart",
    });
  }
};