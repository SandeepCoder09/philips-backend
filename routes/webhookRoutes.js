const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const Transaction = require("../models/Transaction");
const User = require("../models/User");

/* =====================================================
   CASHFREE WEBHOOK (PG v2 - 2023-08-01)
   MUST BE USED WITH express.raw()
===================================================== */
router.post("/cashfree", async (req, res) => {
  try {
    console.log("🔥 Cashfree webhook received");

    /* =====================================================
       1️⃣ Verify Signature
    ===================================================== */

    const signature = req.headers["x-cashfree-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const secretKey = process.env.CASHFREE_SECRET_KEY;

    if (!signature || !timestamp) {
      return res.status(401).json({ message: "Missing signature headers" });
    }

    const rawBody = req.body;

    // 🔥 IMPORTANT: timestamp + rawBody
    const signedPayload = timestamp + rawBody.toString();

    const expectedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(signedPayload)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.log("❌ Invalid webhook signature");
      return res.status(401).json({ message: "Invalid signature" });
    }

    console.log("✅ Signature verified");

    /* =====================================================
       2️⃣ Parse Payload
    ===================================================== */

    const body = JSON.parse(rawBody.toString());

    if (!body?.data?.order || !body?.data?.payment) {
      console.log("❌ Invalid payload structure");
      return res.status(200).json({ message: "Invalid payload" });
    }

    const orderId = body.data.order.order_id;
    const orderAmount = Number(body.data.order.order_amount);
    const paymentStatus = body.data.payment.payment_status;

    console.log("Order:", orderId);
    console.log("Status:", paymentStatus);

    /* =====================================================
       3️⃣ Process Only SUCCESS Payments
    ===================================================== */

    if (paymentStatus !== "SUCCESS") {
      console.log("ℹ️ Payment not successful — ignored");
      return res.status(200).json({ message: "Ignored" });
    }

    /* =====================================================
       4️⃣ Find Transaction
    ===================================================== */

    const transaction = await Transaction.findOne({ orderId: orderId });

    if (!transaction) {
      console.log("❌ Transaction not found");
      return res.status(200).json({ message: "Transaction not found" });
    }

    if (transaction.status === "success") {
      console.log("⚠️ Already processed");
      return res.status(200).json({ message: "Already processed" });
    }

    /* =====================================================
       5️⃣ Update Transaction
    ===================================================== */

    transaction.status = "success";
    await transaction.save();

    /* =====================================================
       6️⃣ Credit Wallet
    ===================================================== */

    const updatedUser = await User.findOneAndUpdate(
      { userId: transaction.userId },
      { $inc: { walletBalance: orderAmount } },
      { new: true }
    );

    if (!updatedUser) {
      console.log("❌ User not found");
      return res.status(200).json({ message: "User not found" });
    }

    console.log("💰 Wallet credited:", updatedUser.walletBalance);

    return res.status(200).json({ message: "Success" });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return res.status(500).json({ message: "Webhook failed" });
  }
});

module.exports = router;