const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const PurchasedProduct = require("../models/PurchasedProduct");
const Transaction = require("../models/Transaction");

/* ================= BUY PRODUCT ================= */
router.post("/buy", authMiddleware, async (req, res) => {
  try {
    let { name, price, dailyEarning } = req.body;

    // ✅ Basic validation
    if (!name || !price || !dailyEarning) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // ✅ Convert to numbers (security improvement)
    price = Number(price);
    dailyEarning = Number(dailyEarning);

    if (isNaN(price) || isNaN(dailyEarning)) {
      return res.status(400).json({
        success: false,
        message: "Invalid price or earning value"
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // ✅ Check if already active product exists
    const existing = await PurchasedProduct.findOne({
      user: user._id,
      name,
      isActive: true
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Product already purchased and active"
      });
    }

    // 💰 CHECK BALANCE
    if (user.walletBalance < price) {
      return res.status(400).json({
        success: false,
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

    // 🧾 CREATE TRANSACTION ENTRY
    await Transaction.create({
      userId: user._id,
      orderId: "PUR-" + Date.now(),
      amount: price,
      type: "purchase",
      status: "success",
      relatedProduct: purchase._id,
      description: `Purchased ${name}`
    });

    res.json({
      success: true,
      message: "Purchase Successful",
      remainingBalance: user.walletBalance
    });

  } catch (error) {
    console.error("Buy Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
});


/* ================= GET MY PRODUCTS ================= */
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const products = await PurchasedProduct.find({
      user: req.user.id
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      products
    });

  } catch (error) {
    console.error("Fetch Products Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
});

module.exports = router;