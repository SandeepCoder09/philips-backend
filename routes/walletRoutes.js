const express = require("express");
const router = express.Router();
const axios = require("axios");
const bcrypt = require("bcryptjs");

const Transaction = require("../models/Transaction");
const User = require("../models/User");
const BankAccount = require("../models/BankAccount");
const UsdtDeposit = require("../models/UsdtDeposit");

const authMiddleware = require("../middleware/authMiddleware");
const generateTransactionId = require("../utils/generateTransactionId");

const rateLimit = require("express-rate-limit");

/* =====================================================
   RATE LIMITER (WITHDRAW)
===================================================== */
const withdrawLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many financial attempts. Please wait 1 minute."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/* =====================================================
   BIND BANK ACCOUNT
===================================================== */
router.post("/bind-bank", authMiddleware, async (req, res) => {
  try {
    const { accountNumber, ifsc, holderName, bankName } = req.body;
    const userId = req.user.userId;

    if (!accountNumber || !ifsc || !holderName || !bankName) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await BankAccount.findOne({ userId, accountNumber });
    if (existing) {
      return res.status(400).json({ message: "Bank already linked" });
    }

    await BankAccount.create({
      userId,
      accountNumber,
      ifsc,
      holderName,
      bankName
    });

    res.status(201).json({ message: "Bank linked successfully" });

  } catch (error) {
    console.error("Bind bank error:", error);
    res.status(500).json({ message: "Failed to bind bank" });
  }
});

/* =====================================================
   GET USER BANKS
===================================================== */
router.get("/banks", authMiddleware, async (req, res) => {
  try {
    const banks = await BankAccount.find({
      userId: req.user.userId
    }).sort({ createdAt: -1 });

    res.json(banks);

  } catch (error) {
    console.error("Fetch banks error:", error);
    res.status(500).json({ message: "Error fetching banks" });
  }
});

/* =====================================================
   CREATE RECHARGE ORDER (INR - CASHFREE)
===================================================== */
router.post("/create-order", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.userId;

    if (!amount || amount < 1) {
      return res.status(400).json({ message: "Minimum recharge is ₹1" });
    }

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const orderId = generateTransactionId("recharge");

    const orderRequest = {
      order_amount: Number(amount),
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: userId.toString(),
        customer_phone: user.mobile
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
      amount: Number(amount),
      status: "pending",
      description: "Wallet Recharge"
    });

    res.json({
      payment_session_id: response.data.payment_session_id,
      order_id: response.data.order_id
    });

  } catch (error) {
    console.error("Recharge error:", error.response?.data || error.message);
    res.status(500).json({ message: "Order creation failed" });
  }
});

/* =====================================================
   USDT MANUAL DEPOSIT
===================================================== */
router.post("/usdt-deposit", authMiddleware, async (req, res) => {
  try {
    const { amount, txnHash } = req.body;
    const userId = req.user.userId;

    if (!amount || !txnHash) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await UsdtDeposit.findOne({ txnHash });
    if (existing) {
      return res.status(400).json({ message: "Transaction hash already submitted" });
    }

    await UsdtDeposit.create({
      userId,
      depositId: generateTransactionId("usdt"),
      amount: Number(amount),
      network: "TRC20",
      txnHash,
      status: "pending"
    });

    await Transaction.create({
      userId,
      orderId: txnHash,
      type: "usdt_recharge",
      amount: Number(amount),
      status: "pending",
      description: "USDT Deposit (TRC20)"
    });

    res.json({
      message: "USDT deposit submitted. Waiting for admin approval.",
      status: "pending"
    });

  } catch (error) {
    console.error("USDT Deposit error:", error);
    res.status(500).json({ message: "USDT deposit failed" });
  }
});

/* =====================================================
   GET WALLET BALANCE
===================================================== */
router.get("/balance", authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({
      userId: req.user.userId
    }).select("walletBalance");

    res.json({ balance: user?.walletBalance || 0 });

  } catch (error) {
    res.status(500).json({ message: "Error fetching balance" });
  }
});

/* =====================================================
   GET USER TRANSACTIONS
===================================================== */
router.get("/transactions", authMiddleware, async (req, res) => {
  try {
    const type = req.query.type || "all";
    const page = parseInt(req.query.page) || 1;

    const filter = { userId: req.user.userId };
    if (type !== "all") filter.type = type;

    const limit = 20;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json(transactions);

  } catch (error) {
    console.error("Transaction fetch error:", error);
    res.status(500).json({ message: "Error fetching transactions" });
  }
});

/* =====================================================
   SECURE WITHDRAW
===================================================== */
router.post("/withdraw",
  withdrawLimiter,
  authMiddleware,
  async (req, res) => {
    try {
      const amount = Number(req.body.amount);
      const pin = String(req.body.pin || "");
      const userId = req.user.userId;

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      if (pin.length !== 4) {
        return res.status(400).json({ message: "Invalid PIN format" });
      }

      const user = await User.findOne({ userId });
      if (!user) return res.status(404).json({ message: "User not found" });

      const isMatch = await bcrypt.compare(pin, user.withdrawPin);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid Withdraw PIN" });
      }

      const updateResult = await User.updateOne(
        { _id: user._id, walletBalance: { $gte: amount } },
        { $inc: { walletBalance: -amount } }
      );

      if (updateResult.modifiedCount === 0) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      await Transaction.create({
        userId,
        orderId: generateTransactionId("withdraw"),
        type: "withdraw",
        amount,
        status: "processing",
        description: "Withdrawal Request"
      });

      res.json({
        message: "Withdrawal request submitted",
        status: "processing"
      });

    } catch (error) {
      console.error("Withdraw error:", error);
      res.status(500).json({ message: "Withdraw failed" });
    }
  });

module.exports = router;