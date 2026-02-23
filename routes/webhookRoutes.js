const express = require("express");
const router = express.Router();

const Transaction = require("../models/Transaction");
const User = require("../models/User");

router.post("/cashfree", async (req, res) => {
  try {
    console.log("🔥 Webhook hit");
    console.log("📦 Incoming Payload:", JSON.stringify(req.body));

    const body = req.body;

    if (!body?.data?.order || !body?.data?.payment) {
      console.log("❌ Invalid payload structure");
      return res.status(200).json({ message: "Invalid payload" });
    }

    const order_id = body.data.order.order_id;
    const order_amount = body.data.order.order_amount;
    const payment_status = body.data.payment.payment_status;

    console.log("Order ID:", order_id);
    console.log("Payment Status:", payment_status);
    console.log("Order Amount:", order_amount);

    // ✅ CHECK PAYMENT STATUS CORRECTLY
    if (payment_status !== "SUCCESS") {
      console.log("ℹ️ Payment not successful, ignoring");
      return res.status(200).json({ message: "Ignored" });
    }

    const transaction = await Transaction.findOne({ orderId: order_id });

    if (!transaction) {
      console.log("❌ Transaction not found");
      return res.status(200).json({ message: "Transaction not found" });
    }

    if (transaction.status === "success") {
      console.log("⚠️ Already processed");
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

    console.log("✅ Wallet credited successfully");

    return res.status(200).json({ message: "Success" });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return res.status(500).json({ message: "Webhook failed" });
  }
});

module.exports = router;