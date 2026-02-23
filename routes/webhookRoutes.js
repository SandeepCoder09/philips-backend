const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const Transaction = require("../models/Transaction");
const User = require("../models/User");

// =====================================================
// CASHFREE WEBHOOK (PRODUCTION SAFE)
// =====================================================
router.post("/cashfree", async (req, res) => {
  try {
    console.log("🔥 Webhook hit");

    // Cashfree sends raw body (Buffer)
    const rawBody = req.body;

    if (!rawBody || !rawBody.length) {
      return res.status(400).json({ message: "Empty webhook body" });
    }

    // 🔐 Get signature from header
    const signature = req.headers["x-webhook-signature"];

    if (!signature) {
      return res.status(400).json({ message: "Missing signature" });
    }

    // 🔐 Generate expected signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.CASHFREE_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("base64");

    if (signature !== expectedSignature) {
      console.log("❌ Signature mismatch");
      return res.status(400).json({ message: "Invalid signature" });
    }

    // ✅ Parse JSON AFTER signature verification
    const parsedBody = JSON.parse(rawBody.toString());

    if (!parsedBody.data) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    const { order_id, order_status, order_amount } = parsedBody.data;

    console.log("Webhook Data:", parsedBody.data);

    if (order_status !== "PAID") {
      return res.status(200).json({ message: "Payment not successful" });
    }

    const transaction = await Transaction.findOne({ orderId: order_id });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // 🛡 Idempotency protection
    if (transaction.status === "success") {
      return res.status(200).json({ message: "Already processed" });
    }

    // ✅ Mark transaction success
    transaction.status = "success";
    await transaction.save();

    // 💰 Credit wallet
    await User.findByIdAndUpdate(
      transaction.userId,
      { $inc: { walletBalance: Number(order_amount) } }
    );

    console.log("✅ Wallet credited");

    return res.status(200).json({
      message: "Payment verified & wallet credited"
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ message: "Webhook failed" });
  }
});

module.exports = router;