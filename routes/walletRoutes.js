const express = require("express");
const router = express.Router();
const axios = require("axios");

const Transaction = require("../models/Transaction");
const User = require("../models/User");
const BankAccount = require("../models/BankAccount");
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
    return res.status(500).json({ message: "Order creation failed" });
  }
});


// =====================================================
// UPDATE TRANSACTION STATUS (Recharge Credit Logic)
// =====================================================
router.post("/update-status", authMiddleware, async (req, res) => {
  try {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({
        message: "Order ID and status required"
      });
    }

    const transaction = await Transaction.findOne({ orderId });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found"
      });
    }

    if (transaction.status === "success") {
      return res.json({ message: "Already processed" });
    }

    transaction.status = status;
    await transaction.save();

    // 🔥 Credit wallet on recharge success
    if (status === "success" && transaction.type === "recharge") {
      await User.findByIdAndUpdate(
        transaction.userId,
        { $inc: { walletBalance: transaction.amount } }
      );
    }

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


// =====================================================
// GET WALLET BALANCE (SAFE VERSION)
// =====================================================
router.get("/balance", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("walletBalance");

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    return res.json({
      balance: user.walletBalance || 0
    });

  } catch (error) {
    console.error("Balance error:", error.message);
    return res.status(500).json({
      message: "Error fetching balance"
    });
  }
});


// =====================================================
// GET USER TRANSACTIONS
// =====================================================
router.get("/transactions", authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      userId: req.user.id
    }).sort({ createdAt: -1 });

    return res.json(transactions);

  } catch (error) {
    console.error("Transaction error:", error.message);
    return res.status(500).json({
      message: "Error fetching transactions"
    });
  }
});


// =====================================================
// BIND BANK ACCOUNT
// =====================================================
router.post("/bind-bank", authMiddleware, async (req, res) => {
  try {
    const { accountNumber, ifsc, holderName, bankName } = req.body;

    if (!accountNumber || !ifsc || !holderName || !bankName) {
      return res.status(400).json({ message: "All fields required" });
    }

    const existing = await BankAccount.findOne({
      userId: req.user.id
    });

    if (existing) {
      return res.status(400).json({
        message: "Bank already linked"
      });
    }

    await BankAccount.create({
      userId: req.user.id,
      accountNumber,
      ifsc,
      holderName,
      bankName
    });

    return res.json({
      success: true,
      message: "Bank submitted for approval"
    });

  } catch (error) {
    console.error("Bind bank error:", error.message);
    return res.status(500).json({
      message: "Error binding bank"
    });
  }
});


// =====================================================
// WITHDRAW (Immediate Deduction - Atomic Safe)
// =====================================================
router.post("/withdraw", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Invalid amount"
      });
    }

    // 🔒 Atomic deduction (prevents double withdraw)
    const user = await User.findOneAndUpdate(
      {
        _id: req.user.id,
        walletBalance: { $gte: amount }
      },
      {
        $inc: { walletBalance: -amount }
      },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({
        message: "Insufficient balance"
      });
    }

    const bank = await BankAccount.findOne({
      userId: req.user.id,
      approved: true
    });

    if (!bank) {
      // refund if bank not approved
      await User.findByIdAndUpdate(
        req.user.id,
        { $inc: { walletBalance: amount } }
      );

      return res.status(400).json({
        message: "Bank not approved"
      });
    }

    const withdrawId = "withdraw_" + Date.now();

    await Transaction.create({
      userId: req.user.id,
      orderId: withdrawId,
      type: "withdraw",
      amount,
      status: "pending"
    });

    return res.json({
      success: true,
      message: "Withdrawal submitted",
      newBalance: user.walletBalance
    });

  } catch (error) {
    console.error("Withdraw error:", error.message);
    return res.status(500).json({
      message: "Withdraw failed"
    });
  }
});

module.exports = router;