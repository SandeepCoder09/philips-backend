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

    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const signature = req.headers["x-cashfree-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const rawBody = req.body;

    /* =====================================================
       1️⃣ Handle Test Webhook (No strict validation)
    ===================================================== */

    if (!rawBody || !signature || !timestamp) {
      console.log("🧪 Test webhook or missing headers");
      return res.status(200).json({ message: "Test OK" });
    }

    /* =====================================================
       2️⃣ Verify Signature
       signature = HMAC_SHA256(timestamp + rawBody)
       digest = HEX
    ===================================================== */

    const signedPayload = timestamp + rawBody.toString();

    const expectedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(signedPayload)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.log("❌ Invalid webhook signature");
      return res.status(200).json({ message: "Invalid signature ignored" });
    }

    console.log("✅ Signature verified");

    /* =====================================================
       3️⃣ Parse Payload
    ===================================================== */

    const body = JSON.parse(rawBody.toString());

    // If this is only webhook test object
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

    console.log("Order ID:", orderId);
    console.log("Payment Status:", paymentStatus);

    /* =====================================================
       4️⃣ Process Only SUCCESS Payments
    ===================================================== */

    if (paymentStatus !== "SUCCESS") {
      console.log("ℹ️ Payment not SUCCESS — ignored");
      return res.status(200).json({ message: "Ignored" });
    }

    /* =====================================================
       5️⃣ Find Transaction
    ===================================================== */

    const transaction = await Transaction.findOne({ orderId });

    if (!transaction) {
      console.log("❌ Transaction not found");
      return res.status(200).json({ message: "Transaction not found" });
    }

    if (transaction.status === "success") {
      console.log("⚠️ Already processed");
      return res.status(200).json({ message: "Already processed" });
    }

    /* =====================================================
       6️⃣ Update Transaction
    ===================================================== */

    transaction.status = "success";
    await transaction.save();

    /* =====================================================
       7️⃣ Credit Wallet
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
    return res.status(200).json({ message: "Error handled safely" });
  }
});

module.exports = router;