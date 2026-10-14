
import { Request, Response } from "express";
import mongoose from "mongoose";
import Cart from "../models/cart.model";
import Order, { OrderStatus } from "../models/order.model";
import Product from "../models/product.model";

const validStatuses: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

// Create an order from the authenticated user's cart
export const createOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?._id?.toString();
  const { shippingAddress } = req.body;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication is required",
    });
    return;
  }

  if (
    !shippingAddress ||
    typeof shippingAddress.fullName !== "string" ||
    typeof shippingAddress.phone !== "string" ||
    typeof shippingAddress.address !== "string" ||
    typeof shippingAddress.city !== "string" ||
    typeof shippingAddress.country !== "string" ||
    !shippingAddress.fullName.trim() ||
    !shippingAddress.phone.trim() ||
    !shippingAddress.address.trim() ||
    !shippingAddress.city.trim() ||
    !shippingAddress.country.trim()
  ) {
    res.status(400).json({
      success: false,
      message:
        "Provide fullName, phone, address, city, and country in shippingAddress",
    });
    return;
  }

  const session = await mongoose.startSession();

  try {
    let createdOrderId: mongoose.Types.ObjectId | null = null;

    await session.withTransaction(async () => {
      const cart = await Cart.findOne({ user: userId }).session(session);

      if (!cart || cart.items.length === 0) {
        throw new Error("CART_EMPTY");
      }

      const orderItems = [];
      let total = 0;

      for (const cartItem of cart.items) {
        const product = await Product.findOneAndUpdate(
          {
            _id: cartItem.product,
            isActive: true,
            stock: { $gte: cartItem.quantity },
          },
          { $inc: { stock: -cartItem.quantity } },
          { new: true, session }
        );

        if (!product) {
          throw new Error("PRODUCT_UNAVAILABLE");
        }

        const subtotal = Number(
          (product.price * cartItem.quantity).toFixed(2)
        );

        orderItems.push({
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: cartItem.quantity,
          subtotal,
        });

        total += subtotal;
      }

      const [order] = await Order.create(
        [
          {
            user: new mongoose.Types.ObjectId(userId),
            items: orderItems,
            total: Number(total.toFixed(2)),
            shippingAddress: {
              fullName: shippingAddress.fullName.trim(),
              phone: shippingAddress.phone.trim(),
              address: shippingAddress.address.trim(),
              city: shippingAddress.city.trim(),
              country: shippingAddress.country.trim(),
            },
            status: "pending",
          },
        ],
        { session }
      );

      await Cart.updateOne(
        { user: userId },
        { $set: { items: [] } },
        { session }
      );

      createdOrderId = order._id;
    });

    const order = createdOrderId
      ? await Order.findById(createdOrderId)
      : null;

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "CART_EMPTY") {
      res.status(400).json({
        success: false,
        message: "Your cart is empty",
      });
      return;
    }

    if (message === "PRODUCT_UNAVAILABLE") {
      res.status(409).json({
        success: false,
        message:
          "A product is unavailable or has insufficient stock. Your order was not created.",
      });
      return;
    }

    console.error("Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to create order",
    });
  } finally {
    await session.endSession();
  }
};

// View the authenticated user's orders
export const getMyOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required",
      });
      return;
    }

    const orders = await Order.find({ user: userId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Get my orders error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to retrieve orders",
    });
  }
};

// View one order belonging to the authenticated user
export const getMyOrderById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required",
      });
      return;
    }

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
      return;
    }

    const order = await Order.findOne({ _id: id, user: userId });

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to retrieve order",
    });
  }
};

// Admin: view all orders
export const getAllOrders = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to retrieve orders",
    });
  }
};

// Admin: update order status
export const updateOrderStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
      return;
    }

    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid order status",
        allowedStatuses: validStatuses,
      });
      return;
    }

    const order = await Order.findById(id);

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    if (order.status === "cancelled" || order.status === "delivered") {
      res.status(409).json({
        success: false,
        message: "Cancelled or delivered orders cannot be changed",
      });
      return;
    }

    if (status === "cancelled") {
      res.status(409).json({
        success: false,
        message:
          "Order cancellation is not enabled yet because stock restoration must be handled safely",
      });
      return;
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Order status updated",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update order status",
    });
  }
};
