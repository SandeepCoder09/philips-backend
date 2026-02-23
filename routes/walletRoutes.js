const express = require("express");
const router = express.Router();
const axios = require("axios");

const Transaction = require("../models/Transaction");
const User = require("../models/User");
const BankAccount = require("../models/BankAccount");
const authMiddleware = require("../middleware/authMiddleware");


// =====================================================
// CREATE CASHFREE ORDER (RECHARGE)
// =====================================================
router.post("/create-order", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    // 🔹 Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    // 🔹 Fetch user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // 🔹 Support both mobile or phone field
    const phoneNumber = user.mobile || user.phone;

    if (!phoneNumber) {
      return res.status(400).json({
        message: "User mobile number not found"
      });
    }

    // 🔹 Generate unique order ID
    const orderId = "order_" + Date.now();

    const orderRequest = {
      order_amount: amount,
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: userId.toString(),
        customer_phone: phoneNumber
      }
    };

    // 🔹 Create Cashfree order
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

    // 🔹 Save transaction in DB
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
    console.error("Recharge error:", error.response?.data || error.message);
    return res.status(500).json({
      message: "Order creation failed"
    });
  }
});


// =====================================================
// UPDATE TRANSACTION STATUS (RECHARGE CREDIT)
// =====================================================
router.post("/update-status", authMiddleware, async (req, res) => {
  try {
    const { orderId, status } = req.body;

    const transaction = await Transaction.findOne({ orderId });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.status === "success") {
      return res.json({ message: "Already processed" });
    }

    transaction.status = status;
    await transaction.save();

    if (status === "success" && transaction.type === "recharge") {
      await User.findByIdAndUpdate(
        transaction.userId,
        { $inc: { walletBalance: transaction.amount } }
      );
    }

    return res.json({ message: "Transaction updated successfully" });

  } catch (error) {
    return res.status(500).json({ message: "Update failed" });
  }
});


// =====================================================
// GET WALLET BALANCE
// =====================================================
router.get("/balance", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("walletBalance");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      balance: user.walletBalance || 0
    });

  } catch (error) {
    return res.status(500).json({ message: "Error fetching balance" });
  }
});


// =====================================================
// GET USER TRANSACTIONS (WITH FILTER SUPPORT)
// =====================================================
router.get("/transactions", authMiddleware, async (req, res) => {
  try {
    const { type } = req.query;

    const filter = { userId: req.user.id };

    if (type && type !== "all") {
      filter.type = type;
    }

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 });

    return res.json(transactions);

  } catch (error) {
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
    const userId = req.user.id;

    if (!accountNumber || !ifsc || !holderName || !bankName) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    const existing = await BankAccount.findOne({
      userId,
      accountNumber
    });

    if (existing) {
      return res.status(400).json({
        message: "This bank account is already added"
      });
    }

    await BankAccount.create({
      userId,
      accountNumber,
      ifsc: ifsc.toUpperCase(),
      holderName,
      bankName
    });

    return res.status(201).json({
      message: "Bank linked successfully"
    });

  } catch (error) {
    return res.status(500).json({
      message: "Failed to bind bank"
    });
  }
});


// =====================================================
// GET USER BANK LIST
// =====================================================
router.get("/banks", authMiddleware, async (req, res) => {
  try {
    const banks = await BankAccount.find({
      userId: req.user.id
    }).sort({ createdAt: -1 });

    return res.json(banks);

  } catch (error) {
    return res.status(500).json({
      message: "Error fetching banks"
    });
  }
});


// =====================================================
// WITHDRAW REQUEST
// =====================================================
router.post("/withdraw", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Invalid amount"
      });
    }

    const bank = await BankAccount.findOne({ userId });

    if (!bank) {
      return res.status(400).json({
        message: "No bank linked"
      });
    }

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        walletBalance: { $gte: amount }
      },
      { $inc: { walletBalance: -amount } },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({
        message: "Insufficient balance"
      });
    }

    const withdrawId = "withdraw_" + Date.now();

    await Transaction.create({
      userId,
      orderId: withdrawId,
      type: "withdraw",
      amount,
      status: "processing"
    });

    return res.json({
      message: "Withdrawal request submitted",
      status: "processing",
      newBalance: user.walletBalance
    });

  } catch (error) {
    return res.status(500).json({
      message: "Withdraw failed"
    });
  }
});


// =====================================================
// ADMIN APPROVE / REJECT WITHDRAW
// =====================================================
router.post("/withdraw-action", async (req, res) => {
  try {
    const { orderId, action } = req.body;

    const transaction = await Transaction.findOne({ orderId });

    if (!transaction || transaction.type !== "withdraw") {
      return res.status(404).json({
        message: "Withdraw not found"
      });
    }

    if (transaction.status !== "processing") {
      return res.status(400).json({
        message: "Already processed"
      });
    }

    if (action === "approve") {
      transaction.status = "success";
      await transaction.save();
      return res.json({ message: "Withdraw approved" });
    }

    if (action === "reject") {
      transaction.status = "rejected";
      await transaction.save();

      await User.findByIdAndUpdate(
        transaction.userId,
        { $inc: { walletBalance: transaction.amount } }
      );

      return res.json({ message: "Withdraw rejected & refunded" });
    }

    return res.status(400).json({ message: "Invalid action" });

  } catch (error) {
    return res.status(500).json({
      message: "Action failed"
    });
  }
});

module.exports = router;

// test deploy test