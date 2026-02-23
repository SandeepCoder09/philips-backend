const express = require("express");
const router = express.Router();

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

    const { code, amountPerUser, totalAmount } = req.body;

    if (!code || !amountPerUser || !totalAmount) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    if (amountPerUser <= 0 || totalAmount <= 0) {
      return res.status(400).json({
        message: "Amounts must be greater than 0"
      });
    }

    if (amountPerUser > totalAmount) {
      return res.status(400).json({
        message: "Per user amount cannot exceed total amount"
      });
    }

    const formattedCode = code.toUpperCase().trim();

    const existing = await GiftCode.findOne({ code: formattedCode });

    if (existing) {
      return res.status(400).json({
        message: "Gift code already exists"
      });
    }

    // Valid for 1 hour only
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const gift = await GiftCode.create({
      code: formattedCode,
      amountPerUser,
      totalAmount,
      remainingAmount: totalAmount,
      expiresAt,
      active: true
    });

    res.status(201).json({
      message: "Gift created successfully",
      gift
    });

  } catch (error) {
    console.error(error);
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
      return res.status(400).json({
        message: "Gift code required"
      });
    }

    const gift = await GiftCode.findOne({
      code: code.toUpperCase().trim(),
      active: true
    });

    if (!gift) {
      return res.status(404).json({
        message: "Invalid Gift Code"
      });
    }

    // Expired check
    if (gift.expiresAt < new Date()) {
      gift.active = false;
      await gift.save();

      return res.status(400).json({
        message: "Gift Code Expired"
      });
    }

    // Already claimed check
    if (gift.claimedUsers.includes(userId)) {
      return res.status(400).json({
        message: "You already collected this gift"
      });
    }

    // Gift Over check
    if (gift.remainingAmount < gift.amountPerUser) {
      gift.active = false;
      await gift.save();

      return res.status(400).json({
        message: "Gift Code Over"
      });
    }

    // Deduct from pool
    gift.remainingAmount -= gift.amountPerUser;
    gift.claimedUsers.push(userId);

    if (gift.remainingAmount < gift.amountPerUser) {
      gift.active = false;
    }

    await gift.save();

    // Credit wallet
    const user = await User.findById(userId);
    user.wallet += gift.amountPerUser;
    await user.save();

    // Create transaction
    await Transaction.create({
      userId,
      orderId: "GIFT_" + Date.now(),
      amount: gift.amountPerUser,
      type: "earning",
      status: "success",
      description: `Gift reward from ${gift.code}`
    });

    res.json({
      message: `You received ₹${gift.amountPerUser}`,
      amount: gift.amountPerUser
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;