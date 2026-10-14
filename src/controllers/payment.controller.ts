
import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../models/order.model";
import Payment from "../models/payment.model";

interface PaypackCheckoutResponse {
  session_id: string;
  amount: number;
  payment_link: string;
}

export const initiateCheckout = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    const email = req.user?.email;
    const { orderId } = req.params;

    if (!userId || !email) {
      res.status(401).json({
        success: false,
        message: "Authentication is required",
      });
      return;
    }

    if (!mongoose.isValidObjectId(orderId)) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
      return;
    }

    const appId = process.env.PAYPACK_APP_ID;

    if (!appId) {
      res.status(500).json({
        success: false,
        message: "Payment provider is not configured",
      });
      return;
    }

    const order = await Order.findOne({
      _id: orderId,
      user: userId,
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    if (order.status !== "pending") {
      res.status(409).json({
        success: false,
        message: "Only pending orders can be paid",
      });
      return;
    }

    if (!order.items.length || order.total <= 0) {
      res.status(400).json({
        success: false,
        message: "This order cannot be paid",
      });
      return;
    }

    const existingPayment = await Payment.findOne({
      order: order._id,
    });

    if (existingPayment?.status === "paid") {
      res.status(409).json({
        success: false,
        message: "This order has already been paid",
      });
      return;
    }

    const response = await fetch(
      "https://checkout.paypack.rw/api/checkouts/initiate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          app_id: appId,
          email,
          items: order.items.map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      console.error(
        "Paypack checkout request failed with status:",
        response.status
      );

      res.status(502).json({
        success: false,
        message: "Unable to initiate payment with the provider",
      });
      return;
    }

    const checkout =
      (await response.json()) as PaypackCheckoutResponse;

    if (
      !checkout.session_id ||
      !checkout.payment_link ||
      !Number.isFinite(checkout.amount) ||
      checkout.amount !== order.total
    ) {
      console.error("Paypack returned an invalid checkout response");

      res.status(502).json({
        success: false,
        message: "The payment provider returned an invalid checkout",
      });
      return;
    }

    // Reuse the existing payment record when retrying a failed or
    // abandoned checkout for this order.
    const payment = existingPayment
      ? await Payment.findByIdAndUpdate(
          existingPayment._id,
          {
            $set: {
              providerSessionId: checkout.session_id,
              paymentLink: checkout.payment_link,
              amount: order.total,
              currency: "RWF",
              status: "pending",
              $unset: { paidAt: 1 },
            },
          },
          { new: true, runValidators: true }
        )
      : await Payment.create({
          order: order._id,
          user: order.user,
          provider: "paypack",
          providerSessionId: checkout.session_id,
          paymentLink: checkout.payment_link,
          amount: order.total,
          currency: "RWF",
          status: "pending",
        });

    res.status(201).json({
      success: true,
      message: "Checkout session created",
      data: {
        orderId: order._id,
        paymentId: payment?._id,
        amount: order.total,
        currency: "RWF",
        status: "pending",
        paymentLink: checkout.payment_link,
      },
    });
  } catch (error) {
    console.error("Initiate checkout error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to initiate checkout",
    });
  }
};
