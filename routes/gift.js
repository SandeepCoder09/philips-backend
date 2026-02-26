const express = require("express");
const router = express.Router();

const GiftCode = require("../models/GiftCode");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

const adminMiddleware = require("../middleware/adminMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const generateTransactionId = require("../utils/generateTransactionId");


/* =====================================================
   CREATE GIFT (ADMIN)
===================================================== */
router.post("/create", adminMiddleware, async (req, res) => {
  try {
    let { code, amountPerUser, totalAmount, expiryMinutes } = req.body;

    if (!code || !amountPerUser || !totalAmount) {
      return res.status(400).json({ message: "All fields are required" });
    }

    amountPerUser = Number(amountPerUser);
    totalAmount = Number(totalAmount);

    if (amountPerUser <= 0 || totalAmount <= 0) {
      return res.status(400).json({ message: "Amounts must be greater than 0" });
    }

    if (amountPerUser > totalAmount) {
      return res.status(400).json({
        message: "Per user amount cannot exceed total amount"
      });
    }

    const formattedCode = code.toUpperCase().trim();

    const existing = await GiftCode.findOne({ code: formattedCode });
    if (existing) {
      return res.status(400).json({ message: "Gift code already exists" });
    }

    const expiryTime = expiryMinutes
      ? Number(expiryMinutes) * 60 * 1000
      : 60 * 60 * 1000; // default 60 minutes

    const expiresAt = new Date(Date.now() + expiryTime);

    const gift = await GiftCode.create({
      code: formattedCode,
      amountPerUser,
      totalAmount,
      remainingAmount: totalAmount,
      claimedUsers: [],
      expiresAt,
      active: true
    });

    return res.status(201).json({
      message: "Gift created successfully",
      gift
    });

  } catch (error) {
    console.error("Create Gift Error:", error);
    return res.status(500).json({ message: "Server Error" });
  }
});


/* =====================================================
   GET ALL GIFTS (ADMIN)
===================================================== */
router.get("/all", adminMiddleware, async (req, res) => {
  try {
    // Auto deactivate expired gifts
    await GiftCode.updateMany(
      { expiresAt: { $lt: new Date() }, active: true },
      { $set: { active: false } }
    );

    const gifts = await GiftCode.find().sort({ createdAt: -1 });

    return res.json(gifts);

  } catch (error) {
    console.error("Get Gifts Error:", error);
    return res.status(500).json({ message: "Server Error" });
  }
});


/* =====================================================
   CLAIM GIFT (USER)
===================================================== */
router.post("/claim", authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.userId; // ✅ numeric

    if (!code) {
      return res.status(400).json({ message: "Gift code required" });
    }

    const formattedCode = code.toUpperCase().trim();

    const gift = await GiftCode.findOne({
      code: formattedCode,
      active: true
    });

    if (!gift) {
      return res.status(404).json({ message: "Invalid Gift Code" });
    }

    // Expiry check
    if (gift.expiresAt < new Date()) {
      gift.active = false;
      await gift.save();
      return res.status(400).json({ message: "Gift Code Expired" });
    }

    // Already claimed check
    if (gift.claimedUsers.includes(userId)) {
      return res.status(400).json({
        message: "You already collected this gift"
      });
    }

    // Balance check
    if (gift.remainingAmount < gift.amountPerUser) {
      gift.active = false;
      await gift.save();
      return res.status(400).json({ message: "Gift Code Over" });
    }

    // Atomic deduction
    const updatedGift = await GiftCode.findOneAndUpdate(
      {
        _id: gift._id,
        remainingAmount: { $gte: gift.amountPerUser }
      },
      {
        $inc: { remainingAmount: -gift.amountPerUser },
        $push: { claimedUsers: userId }
      },
      { new: true }
    );

    if (!updatedGift) {
      return res.status(400).json({ message: "Gift Code Over" });
    }

    // Auto deactivate if empty
    if (updatedGift.remainingAmount < updatedGift.amountPerUser) {
      updatedGift.active = false;
      await updatedGift.save();
    }

    // Credit wallet
    const updatedUser = await User.findOneAndUpdate(
      { userId },
      { $inc: { walletBalance: gift.amountPerUser } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create transaction
    const transactionId = generateTransactionId("gift");

    await Transaction.create({
      userId,
      orderId: transactionId,
      amount: gift.amountPerUser,
      type: "gift",
      status: "success",
      description: `Gift reward from ${formattedCode}`
    });

    return res.json({
      message: `You received ₹${gift.amountPerUser}`,
      amount: gift.amountPerUser,
      wallet: updatedUser.walletBalance
    });

  } catch (error) {
    console.error("Claim Gift Error:", error);
    return res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;