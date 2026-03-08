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
   BIND BANK ACCOUNT (SINGLE BANK ONLY)
===================================================== */
router.post("/bind-bank", authMiddleware, async (req, res) => {
  try {
    const { accountNumber, ifsc, holderName, bankName } = req.body;
    const userId = req.user.userId;

    /* ===============================
       1️⃣ Basic Validation
    =============================== */
    if (!accountNumber || !ifsc || !holderName || !bankName) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    /* ===============================
       2️⃣ Strict Format Validation
    =============================== */
    if (!/^\d{9,18}$/.test(accountNumber)) {
      return res.status(400).json({
        message: "Invalid account number"
      });
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())) {
      return res.status(400).json({
        message: "Invalid IFSC code"
      });
    }

    /* ===============================
       3️⃣ Check If User Already Has Bank
    =============================== */
    const existingBank = await BankAccount.findOne({ userId });

    if (existingBank) {
      return res.status(400).json({
        message: "Bank already linked. You cannot add another."
      });
    }

    /* check duplicate bank */
    const duplicateBank = await BankAccount.findOne({
      accountNumber,
      ifsc: ifsc.toUpperCase()
    });

    if (duplicateBank) {
      return res.status(400).json({
        message: "This bank account is already registered"
      });
    }

    /* ===============================
       4️⃣ Create Bank Record
    =============================== */
    await BankAccount.create({
      userId,
      accountNumber,
      ifsc: ifsc.toUpperCase(),
      holderName,
      bankName,
      verificationStatus: "pending" // future-ready
    });

    return res.status(201).json({
      message: "Bank linked successfully"
    });

  } catch (error) {
    console.error("Bind bank error:", error);
    return res.status(500).json({
      message: "Failed to bind bank"
    });
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
    const amount = Number(req.body.amount);
    const userId = req.user.userId;

    const allowedAmounts = [399, 1499, 4999, 9499, 49999, 99999];

    if (!allowedAmounts.includes(Number(amount))) {
      return res.status(400).json({
        message: "Invalid recharge amount"
      });
    }

    // Maximum amount protection
    if (amount > 100000) {
      return res.status(400).json({
        message: "Amount too large"
      });
    }

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const orderId = generateTransactionId("recharge");

    const orderRequest = {
      order_amount: amount,
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: userId.toString(),
        customer_phone: user.mobile
      },
      order_meta: {
        notify_url: "https://philips-backend.onrender.com/api/webhook/cashfree"
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

    if (!/^[A-Fa-f0-9]{64}$/.test(txnHash)) {
      return res.status(400).json({
        message: "Invalid transaction hash format"
      });
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

    if (!user) {
      return res.json({ balance: 0 });
    }

    res.json({ balance: user.walletBalance });

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
   SECURE WITHDRAW (STABLE - TRANSACTION BASED)
===================================================== */
router.post(
  "/withdraw",
  withdrawLimiter,
  authMiddleware,
  async (req, res) => {
    try {
      const amount = parseInt(req.body.amount, 10);

      if (!Number.isInteger(amount)) {
        return res.status(400).json({
          message: "Invalid amount format"
        });
      }
      const pin = String(req.body.pin || "");
      const userId = req.user.userId;

      /* ===============================
   1️⃣ Validate Amount
=============================== */
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      // 💰 Minimum & Maximum Limit
      const MIN_WITHDRAW = 120;
      const MAX_WITHDRAW = 50000;

      if (amount < MIN_WITHDRAW) {
        return res.status(400).json({
          message: `Minimum withdraw is ₹${MIN_WITHDRAW}`
        });
      }

      if (amount > MAX_WITHDRAW) {
        return res.status(400).json({
          message: `Maximum withdraw is ₹${MAX_WITHDRAW}`
        });
      }

      /* ===============================
         2️⃣ Validate PIN Format
      =============================== */
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({
          message: "PIN must be 4 digits"
        });
      }

      /* ===============================
         3️⃣ Get User
      =============================== */
      const user = await User.findOne({ userId });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      /* ===============================
         4️⃣ Verify PIN
      =============================== */
      const isMatch = await bcrypt.compare(pin, user.withdrawPin);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid Withdraw PIN" });
      }

      /* ===============================
         5️⃣ 🔒 Check Pending Withdraw
         (Using Transaction Model)
      =============================== */
      const existingPending = await Transaction.findOne({
        userId,
        type: "withdraw",
        status: { $in: ["processing", "under review"] }
      });

      if (existingPending) {
        return res.status(400).json({
          message: "You already have a pending withdraw request"
        });
      }

      /* ===============================
         6️⃣ Deduct Balance (Atomic)
      =============================== */
      const updateResult = await User.updateOne(
        { _id: user._id, walletBalance: { $gte: amount } },
        { $inc: { walletBalance: -amount } }
      );

      if (updateResult.modifiedCount === 0) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      /* ===============================
         7️⃣ Create Transaction Record
      =============================== */
      const orderId = generateTransactionId("withdraw");

      await Transaction.create({
        userId,
        orderId,
        type: "withdraw",
        amount,
        status: "processing",
        description: "Withdrawal Request"
      });

      /* ===============================
         8️⃣ Success Response
      =============================== */
      return res.json({
        message: "Withdrawal request submitted successfully",
        status: "processing"
      });

    } catch (error) {
      console.error("Withdraw error:", error);
      return res.status(500).json({ message: "Withdraw failed" });
    }
  }
);

module.exports = router;