const express = require("express");
const router = express.Router();

const Transaction = require("../models/Transaction");
const User = require("../models/User");

// =====================================================
// CASHFREE WEBHOOK
// =====================================================
router.post("/cashfree", async (req, res) => {
  try {
    console.log("🔥 Webhook hit");

    const body = req.body;

    if (!body || !body.data) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    const { order_id, order_status, order_amount } = body.data;

    console.log("Order ID:", order_id);
    console.log("Status:", order_status);

    if (order_status !== "PAID") {
      return res.status(200).json({ message: "Not a successful payment" });
    }

    const transaction = await Transaction.findOne({ orderId: order_id });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.status === "success") {
      return res.status(200).json({ message: "Already processed" });
    }

    // ✅ Mark success
    transaction.status = "success";
    await transaction.save();

    // 💰 Credit wallet
    await User.findByIdAndUpdate(
      transaction.userId,
      { $inc: { walletBalance: order_amount } }
    );

    console.log("✅ Wallet credited");

    return res.status(200).json({ message: "Wallet updated" });

  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ message: "Webhook failed" });
  }
});

module.exports = router;