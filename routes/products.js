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

/* =====================================================
   COLLECT DAILY INCOME (24H SYSTEM - ATOMIC SAFE)
===================================================== */
router.post("/collect/:id", authMiddleware, async (req, res) => {
  try {

    const userId = req.user.userId;
    const purchaseId = req.params.id;
    const now = new Date();

    // 1️⃣ Find purchase safely
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

    // 2️⃣ Expiry check
    if (now > purchase.endDate) {
      purchase.isActive = false;
      await purchase.save();

      return res.status(400).json({
        success: false,
        message: "Product expired"
      });
    }

    // 3️⃣ 24-hour validation
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

    // 4️⃣ Max return check
    if (
      purchase.maxReturn &&
      purchase.totalEarned >= purchase.maxReturn
    ) {
      purchase.isActive = false;
      await purchase.save();

      return res.status(400).json({
        success: false,
        message: "Maximum return reached"
      });
    }

    const amount = purchase.dailyEarning;

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid earning amount"
      });
    }

    // 5️⃣ Atomic wallet update
    await User.updateOne(
      { userId },
      { $inc: { walletBalance: amount } }
    );

    // 6️⃣ Update purchase safely
    purchase.totalEarned += amount;
    purchase.lastEarningDate = now;

    if (
      purchase.maxReturn &&
      purchase.totalEarned >= purchase.maxReturn
    ) {
      purchase.isActive = false;
    }

    await purchase.save();

    // 7️⃣ Create transaction
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
      nextCollectAt: new Date(
        now.getTime() + 24 * 60 * 60 * 1000
      )
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
   GET COLLECT HISTORY (EARNING HISTORY)
===================================================== */
router.get("/collect-history", authMiddleware, async (req, res) => {
  try {

    const userId = req.user.userId;

    // Optional pagination
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

    const formatted = earnings.map(t => ({
      transactionId: t.orderId,
      productName: t.relatedProduct?.name || "Product",
      amount: t.amount,
      collectedAt: t.createdAt
    }));

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
      history: formatted
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