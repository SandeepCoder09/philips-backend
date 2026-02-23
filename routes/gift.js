const express = require("express");
const router = express.Router();

const GiftCode = require("../models/GiftCode");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

const auth = require("../middleware/auth");
const adminAuth = require("../middleware/adminAuth");


// =====================================================
// 🎁 USER - REDEEM GIFT CODE (Limited Users + Random ₹1–₹10)
// =====================================================
router.post("/redeem", auth, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code)
      return res.status(400).json({ message: "Gift code is required" });

    const gift = await GiftCode.findOne({
      code: code.toUpperCase().trim()
    });

    if (!gift || !gift.active)
      return res.status(400).json({ message: "Invalid gift code" });

    if (gift.expiresAt && gift.expiresAt < new Date())
      return res.status(400).json({ message: "Gift code expired" });

    // 🔹 Check user limit
    if (gift.usedBy.length >= gift.maxUsers)
      return res.status(400).json({ message: "Gift fully claimed" });

    // 🔹 Prevent double claim
    if (gift.usedBy.includes(req.user.id))
      return res.status(400).json({ message: "You already claimed this gift" });

    const user = await User.findById(req.user.id);
    if (!user)
      return res.status(404).json({ message: "User not found" });

    // ==========================================
    // 🎲 RANDOM AMOUNT BETWEEN ₹1–₹10
    // ==========================================
    const randomAmount = Math.floor(Math.random() * 10) + 1;

    // 🔹 Add to wallet
    user.wallet += randomAmount;
    await user.save();

    // 🔹 Mark as used
    gift.usedBy.push(req.user.id);
    await gift.save();

    // 🔹 Add transaction record
    await Transaction.create({
      user: user._id,
      type: "gift",
      amount: randomAmount,
      status: "success",
      description: `Gift Code: ${gift.code}`
    });

    res.json({
      message: "Gift claimed successfully",
      amount: randomAmount,
      newBalance: user.wallet,
      remainingClaims: gift.maxUsers - gift.usedBy.length
    });

  } catch (error) {
    console.error("Gift redeem error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// =====================================================
// 👑 ADMIN - CREATE GIFT CODE
// =====================================================
router.post("/create", adminAuth, async (req, res) => {
  try {
    const { code, maxUsers, expiresAt } = req.body;

    if (!code || !maxUsers)
      return res.status(400).json({ message: "Code and maxUsers required" });

    const existing = await GiftCode.findOne({
      code: code.toUpperCase().trim()
    });

    if (existing)
      return res.status(400).json({ message: "Gift code already exists" });

    const gift = new GiftCode({
      code: code.toUpperCase().trim(),
      maxUsers,
      expiresAt: expiresAt || null,
      active: true
    });

    await gift.save();

    res.json({
      message: "Gift code created successfully",
      code: gift.code,
      maxUsers: gift.maxUsers
    });

  } catch (error) {
    console.error("Gift create error:", error);
    res.status(500).json({ message: "Error creating gift code" });
  }
});


// =====================================================
// 👑 ADMIN - GET ALL GIFT CODES
// =====================================================
router.get("/all", adminAuth, async (req, res) => {
  try {
    const gifts = await GiftCode.find().sort({ createdAt: -1 });
    res.json(gifts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching gift codes" });
  }
});


// =====================================================
// 👑 ADMIN - TOGGLE ACTIVE / INACTIVE
// =====================================================
router.put("/toggle/:id", adminAuth, async (req, res) => {
  try {
    const gift = await GiftCode.findById(req.params.id);

    if (!gift)
      return res.status(404).json({ message: "Gift code not found" });

    gift.active = !gift.active;
    await gift.save();

    res.json({
      message: "Gift status updated",
      active: gift.active
    });

  } catch (error) {
    res.status(500).json({ message: "Error updating gift status" });
  }
});

module.exports = router;