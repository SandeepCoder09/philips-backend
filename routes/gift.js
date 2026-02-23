const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const GiftCode = require("../models/GiftCode");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

const adminMiddleware = require("../middleware/adminMiddleware");
const authMiddleware = require("../middleware/authMiddleware");


/* =====================================================
   CREATE GIFT (ADMIN)
===================================================== */
router.post("/create", adminMiddleware, async (req, res) => {
  try {
    let { code, amountPerUser, totalAmount } = req.body;

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

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const gift = await GiftCode.create({
      code: formattedCode,
      amountPerUser,
      totalAmount,
      remainingAmount: totalAmount,
      claimedUsers: [],
      expiresAt,
      active: true
    });

    res.status(201).json({
      message: "Gift created successfully",
      gift
    });

  } catch (error) {
    console.error("Create Gift Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});


/* =====================================================
   GET ALL GIFTS (ADMIN)
===================================================== */
router.get("/all", adminMiddleware, async (req, res) => {
  try {

    await GiftCode.updateMany(
      { expiresAt: { $lt: new Date() }, active: true },
      { $set: { active: false } }
    );

    const gifts = await GiftCode.find().sort({ createdAt: -1 });
    res.json(gifts);

  } catch (error) {
    console.error("Get Gifts Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});


/* =====================================================
   CLAIM GIFT (USER)
===================================================== */
router.post("/claim", authMiddleware, async (req, res) => {
  try {

    const { code } = req.body;
    const userId = req.user.id;

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

    if (gift.expiresAt < new Date()) {
      gift.active = false;
      await gift.save();
      return res.status(400).json({ message: "Gift Code Expired" });
    }

    const alreadyClaimed = gift.claimedUsers.some(
      id => id.toString() === userId.toString()
    );

    if (alreadyClaimed) {
      return res.status(400).json({
        message: "You already collected this gift"
      });
    }

    if (gift.remainingAmount < gift.amountPerUser) {
      gift.active = false;
      await gift.save();
      return res.status(400).json({ message: "Gift Code Over" });
    }

    // Atomic gift deduction
    const updatedGift = await GiftCode.findOneAndUpdate(
      {
        _id: gift._id,
        remainingAmount: { $gte: gift.amountPerUser }
      },
      {
        $inc: { remainingAmount: -gift.amountPerUser },
        $push: { claimedUsers: new mongoose.Types.ObjectId(userId) }
      },
      { new: true }
    );

    if (!updatedGift) {
      return res.status(400).json({ message: "Gift Code Over" });
    }

    if (updatedGift.remainingAmount < updatedGift.amountPerUser) {
      updatedGift.active = false;
      await updatedGift.save();
    }

    // ✅ CORRECT WALLET FIELD FIXED HERE
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { walletBalance: gift.amountPerUser } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await Transaction.create({
      userId,
      orderId: "GIFT_" + Date.now(),
      amount: gift.amountPerUser,
      type: "earning",
      status: "success",
      description: `Gift reward from ${formattedCode}`
    });

    res.json({
      message: `You received ₹${gift.amountPerUser}`,
      amount: gift.amountPerUser,
      wallet: updatedUser.walletBalance
    });

  } catch (error) {
    console.error("Claim Gift Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;