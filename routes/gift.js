const express = require("express");
const router = express.Router();

const GiftCode = require("../models/GiftCode");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

const adminMiddleware = require("../middleware/adminMiddleware");
const authMiddleware = require("../middleware/authMiddleware");


// =====================================================
// STEP 2 — CREATE GIFT CODE (ADMIN ONLY)
// =====================================================
router.post("/create", adminMiddleware, async (req, res) => {
  try {

    const { code, maxUsers, expiresAt } = req.body;

    if (!code || !maxUsers) {
      return res.status(400).json({
        message: "Code and maxUsers are required"
      });
    }

    if (maxUsers <= 0) {
      return res.status(400).json({
        message: "maxUsers must be greater than 0"
      });
    }

    const formattedCode = code.toUpperCase().trim();

    const existing = await GiftCode.findOne({ code: formattedCode });

    if (existing) {
      return res.status(400).json({
        message: "Gift code already exists"
      });
    }

    const gift = await GiftCode.create({
      code: formattedCode,
      maxUsers,
      expiresAt: expiresAt || null,
      active: true
    });

    res.status(201).json({
      message: "Gift code created successfully",
      gift
    });

  } catch (error) {
    console.error("Gift Create Error:", error);
    res.status(500).json({
      message: "Server Error"
    });
  }
});


// =====================================================
// STEP 3 — CLAIM GIFT CODE (USER)
// =====================================================
router.post("/claim", authMiddleware, async (req, res) => {
  try {

    const { code } = req.body;
    const userId = req.user.id;

    if (!code) {
      return res.status(400).json({
        message: "Gift code is required"
      });
    }

    const formattedCode = code.toUpperCase().trim();

    const gift = await GiftCode.findOne({
      code: formattedCode,
      active: true
    });

    if (!gift) {
      return res.status(404).json({
        message: "Invalid or inactive gift code"
      });
    }

    // Expiry Check
    if (gift.expiresAt && gift.expiresAt < new Date()) {
      return res.status(400).json({
        message: "Gift code has expired"
      });
    }

    // Already claimed check
    if (gift.usedBy.includes(userId)) {
      return res.status(400).json({
        message: "You have already claimed this gift"
      });
    }

    // Max users limit check
    if (gift.usedBy.length >= gift.maxUsers) {
      gift.active = false;
      await gift.save();

      return res.status(400).json({
        message: "Gift code fully claimed"
      });
    }

    // 🎁 Generate random ₹1–₹10
    const reward = Math.floor(Math.random() * 10) + 1;

    // Update user wallet
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    user.wallet += reward;
    await user.save();

    // Add user to used list
    gift.usedBy.push(userId);

    // Auto deactivate if limit reached
    if (gift.usedBy.length >= gift.maxUsers) {
      gift.active = false;
    }

    await gift.save();

    // Create transaction record
    await Transaction.create({
      userId,
      orderId: "GIFT_" + Date.now(),
      amount: reward,
      type: "earning",
      status: "success",
      description: `Gift reward from code ${formattedCode}`
    });

    res.json({
      message: `Congratulations! You won ₹${reward}`,
      reward
    });

  } catch (error) {
    console.error("Gift Claim Error:", error);
    res.status(500).json({
      message: "Server Error"
    });
  }
});


module.exports = router;