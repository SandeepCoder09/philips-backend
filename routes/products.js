const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const PurchasedProduct = require("../models/PurchasedProduct");

/* ================= BUY PRODUCT ================= */
router.post("/buy", authMiddleware, async (req, res) => {
  try {
    const { name, price, dailyEarning } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 💰 CHECK BALANCE
    if (user.walletBalance < price) {
      return res.status(400).json({
        message: "Insufficient Balance"
      });
    }

    // 💸 DEDUCT MONEY
    user.walletBalance -= price;
    await user.save();

    // 📦 SAVE PURCHASED PRODUCT
    const purchase = new PurchasedProduct({
      user: user._id,
      name,
      price,
      dailyEarning
    });

    await purchase.save();

    res.json({
      message: "Purchase Successful",
      remainingBalance: user.walletBalance
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
});

/* ================= GET MY PRODUCTS ================= */
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const products = await PurchasedProduct.find({
      user: req.user.id
    }).sort({ createdAt: -1 });

    res.json(products);

  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;