const express = require("express");
const router = express.Router();
const axios = require("axios");

const Transaction = require("../models/Transaction");
const User = require("../models/User");
const BankAccount = require("../models/BankAccount");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");


/* =====================================================
   BIND BANK ACCOUNT
===================================================== */
router.post("/bind-bank", authMiddleware, async (req, res) => {
  try {
    const { accountNumber, ifsc, holderName, bankName } = req.body;

    if (!accountNumber || !ifsc || !holderName || !bankName) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await BankAccount.findOne({
      userId: req.user.id,
      accountNumber
    });

    if (existing) {
      return res.status(400).json({ message: "Bank already linked" });
    }

    await BankAccount.create({
      userId: req.user.id,
      accountNumber,
      ifsc,
      holderName,
      bankName
    });

    return res.status(201).json({ message: "Bank linked successfully" });

  } catch (error) {
    console.error("Bind bank error:", error);
    return res.status(500).json({ message: "Failed to bind bank" });
  }
});


/* =====================================================
   GET USER BANKS
===================================================== */
router.get("/banks", authMiddleware, async (req, res) => {
  try {
    const banks = await BankAccount.find({
      userId: req.user.id
    }).sort({ createdAt: -1 });

    return res.json(banks);

  } catch (error) {
    console.error("Fetch banks error:", error);
    return res.status(500).json({ message: "Error fetching banks" });
  }
});


/* =====================================================
   CREATE CASHFREE ORDER (RECHARGE)
===================================================== */
router.post("/create-order", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;
    const io = req.app.get("io");

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const orderId = "order_" + Date.now();

    const orderRequest = {
      order_amount: amount,
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
      amount,
      status: "pending"
    });

    io.to(userId.toString()).emit("wallet_updated");
    io.to("admin_room").emit("transaction_updated");

    return res.json({
      payment_session_id: response.data.payment_session_id,
      order_id: response.data.order_id
    });

  } catch (error) {
    console.error("Recharge error:", error.response?.data || error.message);
    return res.status(500).json({ message: "Order creation failed" });
  }
});


/* =====================================================
   UPDATE TRANSACTION STATUS
===================================================== */
router.post("/update-status", authMiddleware, async (req, res) => {
  try {
    const { orderId, status } = req.body;
    const io = req.app.get("io");

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

    io.to(transaction.userId.toString()).emit("wallet_updated");
    io.to("admin_room").emit("transaction_updated");

    return res.json({ message: "Transaction updated successfully" });

  } catch (error) {
    return res.status(500).json({ message: "Update failed" });
  }
});


/* =====================================================
   GET WALLET BALANCE
===================================================== */
router.get("/balance", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("walletBalance");

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

/* =====================================================
   GET USER TRANSACTIONS
===================================================== */
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
    console.error("Transaction fetch error:", error);
    return res.status(500).json({ message: "Error fetching transactions" });
  }
});

/* =====================================================
   WITHDRAW REQUEST
===================================================== */
router.post("/withdraw", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;
    const io = req.app.get("io");

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const bank = await BankAccount.findOne({ userId });
    if (!bank) {
      return res.status(400).json({ message: "No bank linked" });
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, walletBalance: { $gte: amount } },
      { $inc: { walletBalance: -amount } },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    const withdrawId = "withdraw_" + Date.now();

    await Transaction.create({
      userId,
      orderId: withdrawId,
      type: "withdraw",
      amount,
      status: "processing"
    });

    io.to(userId.toString()).emit("wallet_updated");
    io.to("admin_room").emit("withdraw_updated");

    return res.json({
      message: "Withdrawal request submitted",
      status: "processing",
      newBalance: user.walletBalance
    });

  } catch (error) {
    return res.status(500).json({ message: "Withdraw failed" });
  }
});


/* =====================================================
   ADMIN WITHDRAW ACTION
===================================================== */
router.post("/withdraw-action", adminMiddleware, async (req, res) => {
  try {
    const { orderId, action } = req.body;
    const io = req.app.get("io");

    const transaction = await Transaction.findOne({ orderId });

    if (!transaction || transaction.type !== "withdraw") {
      return res.status(404).json({ message: "Withdraw not found" });
    }

    if (
      transaction.status === "success" ||
      transaction.status === "rejected"
    ) {
      return res.status(400).json({ message: "Already processed" });
    }

    if (action === "approve") {
      transaction.status = "success";
      await transaction.save();
    }

    if (action === "reject") {
      await User.findByIdAndUpdate(
        transaction.userId,
        { $inc: { walletBalance: transaction.amount } }
      );
      transaction.status = "rejected";
      await transaction.save();
    }

    io.to(transaction.userId.toString()).emit("wallet_updated");
    io.to("admin_room").emit("withdraw_updated");

    return res.json({ message: "Withdraw updated successfully" });

  } catch (error) {
    console.error("Withdraw Action Error:", error);
    return res.status(500).json({ message: "Action failed" });
  }
});

module.exports = router;