const express = require("express");
const router = express.Router();

const Transaction = require("../models/Transaction");
const User = require("../models/User");

router.post("/cashfree", async (req, res) => {
  try {
    console.log("🔥 Webhook hit");
    console.log("Body:", req.body);

    const body = req.body;

    if (!body || !body.data || !body.data.order) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    const order = body.data.order;

    const order_id = order.order_id;
    const order_status = order.order_status;
    const order_amount = order.order_amount;

    console.log("Order ID:", order_id);
    console.log("Status:", order_status);

    if (order_status !== "PAID") {
      return res.status(200).json({ message: "Not successful payment" });
    }

    const transaction = await Transaction.findOne({ orderId: order_id });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.status === "success") {
      return res.status(200).json({ message: "Already processed" });
    }

    transaction.status = "success";
    await transaction.save();

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