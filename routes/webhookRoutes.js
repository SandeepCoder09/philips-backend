const express = require("express");
const router = express.Router();

const Transaction = require("../models/Transaction");
const User = require("../models/User");

router.post("/cashfree", async (req, res) => {
  try {
    console.log("🔥 Webhook hit");
    console.log("📦 Payload:", JSON.stringify(req.body));

    const body = req.body;

    if (!body) {
      return res.status(400).json({ message: "No body received" });
    }

    let order_id;
    let order_status;
    let order_amount;

    // FORMAT 1: body.data.order
    if (body?.data?.order) {
      order_id = body.data.order.order_id;
      order_status = body.data.order.order_status;
      order_amount = body.data.order.order_amount;
    }

    // FORMAT 2: body.data directly
    else if (body?.data?.order_id) {
      order_id = body.data.order_id;
      order_status = body.data.order_status;
      order_amount = body.data.order_amount;
    }

    // FORMAT 3: direct order
    else if (body?.order) {
      order_id = body.order.order_id;
      order_status = body.order.order_status;
      order_amount = body.order.order_amount;
    }

    if (!order_id) {
      console.log("❌ Could not extract order_id");
      return res.status(200).json({ message: "Ignored - invalid payload" });
    }

    console.log("Order ID:", order_id);
    console.log("Status:", order_status);

    if (order_status !== "PAID") {
      return res.status(200).json({ message: "Ignored - not paid" });
    }

    const transaction = await Transaction.findOne({ orderId: order_id });

    if (!transaction) {
      console.log("❌ Transaction not found");
      return res.status(200).json({ message: "Transaction not found" });
    }

    if (transaction.status === "success") {
      return res.status(200).json({ message: "Already processed" });
    }

    // Update transaction
    transaction.status = "success";
    await transaction.save();

    // Credit wallet
    await User.findByIdAndUpdate(
      transaction.userId,
      { $inc: { walletBalance: Number(order_amount) } },
      { returnDocument: "after" }
    );

    console.log("✅ Wallet credited");

    return res.status(200).json({ message: "Success" });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return res.status(500).json({ message: "Webhook failed" });
  }
});

module.exports = router;