
import { Request, Response } from "express";
import crypto from "crypto";
import Payment from "../models/payment.model";
import Order from "../models/order.model";

interface PaypackEvent {
  event_id?: string;
  kind?: string;
  data?: {
    ref?: string;
    session_id?: string;
    amount?: number;
    status?: string;
    kind?: string;
  };
}

export const handlePaypackWebhook = async (
  req: Request & { rawBody?: Buffer },
  res: Response
): Promise<void> => {
  try {
    // Paypack sends HEAD requests to check webhook availability.
    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }

    const secret = process.env.PAYPACK_WEBHOOK_SIGN_KEY;
    const signature = req.get("X-Paypack-Signature");
    const rawBody = req.rawBody;

    if (!secret || !signature || !rawBody) {
      res.status(400).json({
        success: false,
        message: "Missing webhook verification data",
      });
      return;
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    const expected = Buffer.from(expectedSignature);
    const received = Buffer.from(signature);

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid webhook signature",
      });
      return;
    }

    const event = req.body as PaypackEvent;

    // Ignore unrelated events.
    if (
      event.kind !== "session:processed" &&
      event.kind !== "transaction:processed"
    ) {
      res.status(200).json({
        success: true,
        message: "Event ignored",
      });
      return;
    }

    const data = event.data;

    if (!data) {
      res.status(400).json({
        success: false,
        message: "Invalid webhook payload",
      });
      return;
    }

    const providerReference = data.session_id ?? data.ref;

    if (!providerReference || typeof data.status !== "string") {
      res.status(400).json({
        success: false,
        message: "Missing payment reference or status",
      });
      return;
    }

    const payment = await Payment.findOne({
      provider: "paypack",
      providerSessionId: providerReference,
    });

    // A valid event that cannot be correlated must not change an order.
    if (!payment) {
      res.status(404).json({
        success: false,
        message: "Payment reference not found",
      });
      return;
    }

    if (
      typeof data.amount !== "number" ||
      !Number.isFinite(data.amount) ||
      data.amount !== payment.amount
    ) {
      res.status(400).json({
        success: false,
        message: "Payment amount does not match",
      });
      return;
    }

    // Never allow a later duplicate or failure event to undo a payment.
    if (payment.status === "paid") {
      res.status(200).json({
        success: true,
        message: "Payment was already processed",
      });
      return;
    }

    const normalizedStatus = data.status.toLowerCase();

    if (
      normalizedStatus !== "successful" &&
      normalizedStatus !== "success" &&
      normalizedStatus !== "failed"
    ) {
      res.status(200).json({
        success: true,
        message: "Payment is not in a final state",
      });
      return;
    }

    if (normalizedStatus === "failed") {
      payment.status = "failed";
      await payment.save();

      res.status(200).json({
        success: true,
        message: "Payment failure recorded",
      });
      return;
    }

    // Only the provider's authenticated success event can mark this paid.
    const order = await Order.findById(payment.order);

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Associated order not found",
      });
      return;
    }

    if (order.status !== "pending") {
      res.status(409).json({
        success: false,
        message: "Order is not eligible for payment confirmation",
      });
      return;
    }

    payment.status = "paid";
    payment.paidAt = new Date();
    await payment.save();

    order.status = "processing";
    await order.save();

    res.status(200).json({
      success: true,
      message: "Payment confirmed",
    });
  } catch (error) {
    console.error("Paypack webhook error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to process payment notification",
    });
  }
};
