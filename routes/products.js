const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const PurchasedProduct = require("../models/PurchasedProduct");
const Transaction = require("../models/Transaction");
const generateTransactionId = require("../utils/generateTransactionId");

/* ================= BUY PRODUCT ================= */
router.post("/buy", authMiddleware, async (req, res) => {
  try {
    let { name, price, dailyEarning } = req.body;
    const userId = req.user.userId;

    if (!name || !price || !dailyEarning) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    price = Number(price);
    dailyEarning = Number(dailyEarning);

    const user = await User.findOne({ userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.walletBalance < price) {
      return res.status(400).json({
        success: false,
        message: "Insufficient Balance"
      });
    }

    /* ================= WALLET DEDUCT ================= */
    user.walletBalance -= price;
    await user.save();

    /* ================= SAVE PURCHASE ================= */
    const purchase = new PurchasedProduct({
      userId: user.userId,
      name,
      price,
      dailyEarning
    });

    await purchase.save();

    /* ================= CREATE PURCHASE TRANSACTION ================= */
    await Transaction.create({
      userId: user.userId,
      orderId: generateTransactionId("purchase"),
      amount: price,
      type: "purchase",
      status: "success",
      relatedProduct: purchase._id,
      description: `Purchased ${name}`
    });

    /* ================= QUALIFICATION CHECK ================= */
    if (price >= 399 && !user.isQualified) {
      user.isQualified = true;
      await user.save();

      if (user.referredById) {
        const sponsor = await User.findOne({
          userId: user.referredById
        });

        if (sponsor && sponsor.isQualified) {

          sponsor.qualifiedDirectCount += 1;

          /* ===== ₹50 FIRST DIRECT BONUS ===== */
          if (!sponsor.firstDirectBonusGiven) {
            sponsor.walletBalance += 50;
            sponsor.firstDirectBonusGiven = true;

            await Transaction.create({
              userId: sponsor.userId,
              orderId: generateTransactionId("referral_bonus"),
              amount: 50,
              type: "referral_bonus",
              status: "success",
              description: `First Direct Qualification Bonus`
            });
          }

          /* ===== ₹300 TEAM BONUS ===== */
          if (
            sponsor.qualifiedDirectCount >= 3 &&
            !sponsor.teamBonusGiven
          ) {
            sponsor.walletBalance += 300;
            sponsor.teamBonusGiven = true;

            await Transaction.create({
              userId: sponsor.userId,
              orderId: generateTransactionId("team_bonus"),
              amount: 300,
              type: "team_bonus",
              status: "success",
              description: `3 Direct Team Bonus`
            });
          }

          await sponsor.save();
        }
      }
    }

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
      userId: req.user.userId
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