const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const PurchasedProduct = require("../models/PurchasedProduct");
const Transaction = require("../models/Transaction");
const Product = require("../models/Product");
const generateTransactionId = require("../utils/generateTransactionId");

/* =====================================================
   GET PRODUCT LIST (WITH REMAINING LIMIT)
===================================================== */
router.get("/list", authMiddleware, async (req, res) => {
  try {

    const userId = req.user.userId;

    const products = await Product.find({ isActive: true });

    const userPurchases = await PurchasedProduct.find({ userId });

    const enrichedProducts = products.map(product => {

      const purchaseCount = userPurchases.filter(p =>
        p.productId &&
        p.productId.toString() === product._id.toString()
      ).length;

      const remaining =
        product.maxPurchaseLimit - purchaseCount;

      return {
        code: product.code,
        name: product.name,
        price: product.price,
        dailyIncome: product.dailyIncome,
        validityDays: product.validityDays,
        maxPurchaseLimit: product.maxPurchaseLimit,
        remaining: remaining > 0 ? remaining : 0,
        image: product.image   // 🔥 image from DB
      };
    });

    res.json(enrichedProducts);

  } catch (error) {
    console.error("Fetch Product List Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
});

/* =====================================================
   BUY PRODUCT (FULLY SECURE + LIMIT VALIDATION)
===================================================== */
router.post("/buy", authMiddleware, async (req, res) => {
  try {

    const { productId } = req.body;
    const userId = req.user.userId;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    /* 🔥 FETCH PRODUCT */
    const product = await Product.findOne({ code: productId });

    if (!product || !product.isActive) {
      return res.status(400).json({
        success: false,
        message: "Invalid product"
      });
    }

    const user = await User.findOne({ userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    /* 🔥 PURCHASE LIMIT CHECK */
    const purchaseCount = await PurchasedProduct.countDocuments({
      userId: user.userId,
      productId: product._id
    });

    if (purchaseCount >= product.maxPurchaseLimit) {
      return res.status(400).json({
        success: false,
        message: "Purchase limit reached"
      });
    }

    /* 🔥 WALLET CHECK */
    if (user.walletBalance < product.price) {
      return res.status(400).json({
        success: false,
        message: "Insufficient Balance"
      });
    }

    /* 🔥 WALLET DEDUCT */
    user.walletBalance -= product.price;
    await user.save();

    /* 🔥 EXPIRY CALCULATION */
    const purchaseDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + product.validityDays);

    /* 🔥 SAVE PURCHASE */
    const purchase = new PurchasedProduct({
      userId: user.userId,
      productId: product._id,
      name: product.name,
      price: product.price,
      dailyEarning: product.dailyIncome,
      purchaseDate,
      endDate
    });

    await purchase.save();

    /* 🔥 TRANSACTION ENTRY */
    await Transaction.create({
      userId: user.userId,
      orderId: generateTransactionId("purchase"),
      amount: product.price,
      type: "purchase",
      status: "success",
      relatedProduct: purchase._id,
      description: `Purchased ${product.name}`
    });

    /* =====================================================
       QUALIFICATION LOGIC (UNCHANGED)
    ===================================================== */
    if (product.price >= 399 && !user.isQualified) {

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

/* =====================================================
   GET MY PRODUCTS (WITH IMAGE POPULATION)
===================================================== */
router.get("/my", authMiddleware, async (req, res) => {
  try {

    const purchases = await PurchasedProduct.find({
      userId: req.user.userId
    })
      .populate({
        path: "productId",
        select: "image name" // 🔥 only what we need
      })
      .sort({ createdAt: -1 });

    const formattedProducts = purchases.map(p => {

      return {
        _id: p._id,
        name: p.name,
        price: p.price,
        dailyEarning: p.dailyEarning,
        totalEarned: p.totalEarned,
        purchaseDate: p.purchaseDate,
        endDate: p.endDate,
        image: p.productId?.image || null   // 🔥 THIS is the fix
      };
    });

    res.json({
      success: true,
      products: formattedProducts
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