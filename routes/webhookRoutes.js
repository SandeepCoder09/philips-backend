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

    // Cashfree sends JSON body
    const body = req.body;

    if (!body) {
      console.log("❌ No body received");
      return res.status(400).json({ message: "No body received" });
    }

    console.log("📦 Incoming Payload:", JSON.stringify(body));

    // --------------------------------------------------
    // Handle Cashfree 2023-08-01 structure safely
    // --------------------------------------------------

    let order_id = null;
    let order_status = null;
    let order_amount = null;

    // Format 1 (most common)
    if (body?.data?.order) {
      order_id = body.data.order.order_id;
      order_status = body.data.order.order_status;
      order_amount = body.data.order.order_amount;
    }

    // Fallback format (some cases)
    if (!order_id && body?.order) {
      order_id = body.order.order_id;
      order_status = body.order.order_status;
      order_amount = body.order.order_amount;
    }

    console.log("Order ID:", order_id);
    console.log("Order Status:", order_status);
    console.log("Order Amount:", order_amount);

    if (!order_id) {
      console.log("❌ order_id not found in payload");
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    // Only process successful payment
    if (order_status !== "PAID") {
      console.log("ℹ️ Payment not successful, ignoring");
      return res.status(200).json({ message: "Ignored - not paid" });
    }

    // --------------------------------------------------
    // Find Transaction
    // --------------------------------------------------
    const transaction = await Transaction.findOne({ orderId: order_id });

    if (!transaction) {
      console.log("❌ Transaction not found in DB");
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Prevent double credit
    if (transaction.status === "success") {
      console.log("⚠️ Already processed");
      return res.status(200).json({ message: "Already processed" });
    }

    // --------------------------------------------------
    // Update Transaction
    // --------------------------------------------------
    transaction.status = "success";
    await transaction.save();

    // --------------------------------------------------
    // Credit Wallet
    // --------------------------------------------------
    const amountNumber = Number(order_amount);

    await User.findByIdAndUpdate(
      transaction.userId,
      { $inc: { walletBalance: amountNumber } },
      { returnDocument: "after" }
    );

    console.log("✅ Wallet credited successfully");

    return res.status(200).json({ message: "Payment processed successfully" });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return res.status(500).json({ message: "Webhook failed" });
  }
});

module.exports = router;