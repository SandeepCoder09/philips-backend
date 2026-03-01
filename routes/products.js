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
        image: product.image
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

    if (user.walletBalance < product.price) {
      return res.status(400).json({
        success: false,
        message: "Insufficient Balance"
      });
    }

    user.walletBalance -= product.price;
    await user.save();

    const purchaseDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + product.validityDays);

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

    await Transaction.create({
      userId: user.userId,
      orderId: generateTransactionId("purchase"),
      amount: product.price,
      type: "purchase",
      status: "success",
      relatedProduct: purchase._id,
      description: `Purchased ${product.name}`
    });

    /* QUALIFICATION LOGIC UNTOUCHED */
    if (product.price >= 399 && !user.isQualified) {

      user.isQualified = true;
      await user.save();

      if (user.referredById) {

        const sponsor = await User.findOne({
          userId: user.referredById
        });

        if (sponsor && sponsor.isQualified) {

          sponsor.qualifiedDirectCount += 1;

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
   GET MY PRODUCTS (RETURN LAST EARNING DATE)
===================================================== */
router.get("/my", authMiddleware, async (req, res) => {
  try {

    const purchases = await PurchasedProduct.find({
      userId: req.user.userId
    })
      .populate({
        path: "productId",
        select: "image name"
      })
      .sort({ createdAt: -1 });

    const formattedProducts = purchases.map(p => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      dailyEarning: p.dailyEarning,
      totalEarned: p.totalEarned || 0,
      purchaseDate: p.purchaseDate,
      endDate: p.endDate,
      lastEarningDate: p.lastEarningDate || null, // 🔥 added
      image: p.productId?.image || null
    }));

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

/* =====================================================
   COLLECT DAILY INCOME (ATOMIC SAFE VERSION)
===================================================== */
router.post("/collect/:id", authMiddleware, async (req, res) => {
  try {

    const userId = req.user.userId;
    const purchaseId = req.params.id;
    const now = new Date();

    const purchase = await PurchasedProduct.findOne({
      _id: purchaseId,
      userId,
      isActive: true
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Product not found or inactive"
      });
    }

    if (now > purchase.endDate) {
      purchase.isActive = false;
      await purchase.save();

      return res.status(400).json({
        success: false,
        message: "Product expired"
      });
    }

    const last = purchase.lastEarningDate
      ? new Date(purchase.lastEarningDate)
      : new Date(purchase.purchaseDate);

    const nextEligible = new Date(last.getTime() + 24 * 60 * 60 * 1000);

    if (now < nextEligible) {
      return res.status(400).json({
        success: false,
        message: "Not eligible yet",
        nextCollectAt: nextEligible
      });
    }

    const amount = purchase.dailyEarning;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid earning amount"
      });
    }

    const updatedPurchase = await PurchasedProduct.findOneAndUpdate(
      {
        _id: purchaseId,
        userId,
        isActive: true,
        $or: [
          { lastEarningDate: null },
          { lastEarningDate: { $lte: last } }
        ]
      },
      {
        $inc: { totalEarned: amount },
        $set: { lastEarningDate: now }
      },
      { new: true }
    );

    if (!updatedPurchase) {
      return res.status(400).json({
        success: false,
        message: "Already collected or not eligible"
      });
    }

    await User.updateOne(
      { userId },
      { $inc: { walletBalance: amount } }
    );

    await Transaction.create({
      userId,
      orderId: generateTransactionId("COLLECT"),
      amount,
      type: "earning",
      status: "success",
      relatedProduct: purchase._id,
      description: `Collected daily income from ${purchase.name}`
    });

    return res.json({
      success: true,
      message: "Income collected successfully",
      amount,
      nextCollectAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
    });

  } catch (error) {
    console.error("Collect Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
});

/* =====================================================
   GET COLLECT HISTORY
===================================================== */
router.get("/collect-history", authMiddleware, async (req, res) => {
  try {

    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const earnings = await Transaction.find({
      userId,
      type: "earning",
      status: "success"
    })
      .populate({
        path: "relatedProduct",
        select: "name"
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCount = await Transaction.countDocuments({
      userId,
      type: "earning",
      status: "success"
    });

    res.json({
      success: true,
      page,
      totalPages: Math.ceil(totalCount / limit),
      totalRecords: totalCount,
      history: earnings
    });

  } catch (error) {
    console.error("Collect History Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
});

module.exports = router;