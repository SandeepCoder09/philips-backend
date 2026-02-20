const express = require("express");
const router = express.Router();
const axios = require("axios");
const Transaction = require("../models/Transaction");
const authMiddleware = require("../middleware/authMiddleware");

// =====================================================
// CREATE CASHFREE ORDER (Recharge)
// =====================================================
router.post("/create-order", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const orderId = "order_" + Date.now();

    const orderRequest = {
      order_amount: amount,
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: userId,
        customer_phone: "9999999999"
      }
    };

    const response = await axios.post(
      "https://api.cashfree.com/pg/orders",
      orderRequest,
      {
        headers: {
          "x-client-id": process.env.CASHFREE_APP_ID,
          "x-client-secret": process.env.CASHFREE_SECRET_KEY,
          "x-api-version": "2023-08-01",
          "Content-Type": "application/json"
        }
      }
    );

    // Save transaction as pending
    await Transaction.create({
      userId,
      orderId,
      type: "recharge",
      amount,
      status: "pending"
    });

    return res.json({
      payment_session_id: response.data.payment_session_id,
      order_id: response.data.order_id
    });

  } catch (error) {
    console.error("Cashfree error:", error.response?.data || error.message);

    return res.status(500).json({
      message: "Order creation failed",
      error: error.response?.data || error.message
    });
  }
});


// =====================================================
// GET LOGGED-IN USER TRANSACTION HISTORY
// =====================================================
router.get("/transactions", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 });

    return res.json(transactions);

  } catch (error) {
    console.error("Transaction fetch error:", error.message);

    return res.status(500).json({
      message: "Error fetching transactions"
    });
  }
});


// =====================================================
// UPDATE TRANSACTION STATUS (After Payment Success)
// =====================================================
router.post("/update-status", authMiddleware, async (req, res) => {
  try {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({
        message: "Order ID and status required"
      });
    }

    await Transaction.findOneAndUpdate(
      { orderId },
      { status }
    );

    return res.json({
      message: "Transaction updated successfully"
    });

  } catch (error) {
    console.error("Update error:", error.message);

    return res.status(500).json({
      message: "Error updating transaction"
    });
  }
});

module.exports = router;