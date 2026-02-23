const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const Transaction = require("../models/Transaction");
const User = require("../models/User");

// =====================================================
// CASHFREE WEBHOOK
// =====================================================
router.post("/cashfree", async (req, res) => {
  try {

    const signature = req.headers["x-webhook-signature"];
    const payload = req.body;

    // 🔐 Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.CASHFREE_WEBHOOK_SECRET)
      .update(payload)
      .digest("base64");

    if (signature !== expectedSignature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    if (!req.body || !req.body.data) {
        return res.status(400).json({ message: "Invalid webhook payload" });
      }
      
      const { order_id, order_status, order_amount } = req.body.data;

    if (order_status !== "PAID") {
      return res.status(200).json({ message: "Payment not successful" });
    }

    const transaction = await Transaction.findOne({ orderId: order_id });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.status === "success") {
      return res.status(200).json({ message: "Already processed" });
    }

    // ✅ Mark transaction success
    transaction.status = "success";
    await transaction.save();

    // 💰 Credit wallet
    await User.findByIdAndUpdate(
      transaction.userId,
      { $inc: { walletBalance: order_amount } }
    );

    return res.status(200).json({ message: "Payment verified & wallet credited" });

  } catch (error) {
    console.error("Webhook error:", error.message);
    return res.status(500).json({ message: "Webhook failed" });
  }
});

module.exports = router;