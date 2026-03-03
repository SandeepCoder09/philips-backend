const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const Transaction = require("../models/Transaction");
const User = require("../models/User");

router.post("/cashfree", async (req, res) => {
  try {
    console.log("🔥 Cashfree webhook received");

    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const signature = req.headers["x-cashfree-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const rawBody = req.body;

    // 🔥 Always respond 200 for test or malformed requests
    if (!rawBody) {
      console.log("⚠️ Empty body");
      return res.status(200).json({ message: "OK" });
    }

    // 🔥 If headers missing → treat as test
    if (!signature || !timestamp) {
      console.log("🧪 Test webhook (no signature headers)");
      return res.status(200).json({ message: "Test OK" });
    }

    const signedPayload = timestamp + rawBody.toString();

    const expectedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(signedPayload)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.log("❌ Invalid signature (ignored)");
      return res.status(200).json({ message: "Invalid signature ignored" });
    }

    console.log("✅ Signature verified");

    const body = JSON.parse(rawBody.toString());

    // Handle test payload
    if (body.type === "WEBHOOK") {
      console.log("🧪 Webhook test validated");
      return res.status(200).json({ message: "Test successful" });
    }

    if (!body?.data?.order || !body?.data?.payment) {
      console.log("❌ Invalid payload structure");
      return res.status(200).json({ message: "Invalid payload" });
    }

    const orderId = body.data.order.order_id;
    const orderAmount = Number(body.data.order.order_amount);
    const paymentStatus = body.data.payment.payment_status;

    console.log("Order:", orderId);
    console.log("Status:", paymentStatus);

    if (paymentStatus !== "SUCCESS") {
      return res.status(200).json({ message: "Ignored" });
    }

    const transaction = await Transaction.findOne({ orderId });

    if (!transaction || transaction.status === "success") {
      return res.status(200).json({ message: "Already processed" });
    }

    transaction.status = "success";
    await transaction.save();

    await User.findOneAndUpdate(
      { userId: transaction.userId },
      { $inc: { walletBalance: orderAmount } }
    );

    console.log("💰 Wallet credited successfully");

    return res.status(200).json({ message: "Success" });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return res.status(200).json({ message: "Error handled safely" });
  }
});

module.exports = router;