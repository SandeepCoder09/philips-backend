const express = require("express");
const router = express.Router();

const adminMiddleware = require("../middleware/adminMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const adminLogger = require("../middleware/adminLogger");
const UsdtDeposit = require("../models/UsdtDeposit");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Product = require("../models/Product");
const { upload, compressImage } = require("../middleware/upload");
const { runDailyEarnings } = require("../cron/earningEngine");

// =====================================================
// CONTROLLERS
// =====================================================
const {
  getDashboardStats,
  getAllUsers,
  getAllTransactions,
  getAllBanks,
  getAllWithdraws,
  updateWithdrawStatus,
  toggleUserBan
} = require("../controllers/adminController");

const {
  getUserRiskDetail,
  getUserActivityTimeline
} = require("../controllers/riskController");


// =====================================================
// DASHBOARD
// =====================================================
router.get("/dashboard", adminMiddleware, getDashboardStats);


// =====================================================
// USERS
// =====================================================
router.get("/users", adminMiddleware, getAllUsers);
router.get("/user-risk/:userId", adminMiddleware, getUserRiskDetail);
router.get("/user-activity/:userId", adminMiddleware, getUserActivityTimeline);

router.put(
  "/user/:userId/ban",
  adminMiddleware,
  adminLogger("TOGGLE_USER_BAN"),
  toggleUserBan
);


// =====================================================
// TRANSACTIONS / BANKS / WITHDRAWS
// =====================================================
router.get("/transactions", adminMiddleware, getAllTransactions);
router.get("/banks", adminMiddleware, getAllBanks);
router.get("/withdraws", adminMiddleware, getAllWithdraws);

router.put(
  "/withdraw/:id",
  adminMiddleware,
  adminLogger("UPDATE_WITHDRAW_STATUS"),
  updateWithdrawStatus
);


// =====================================================
// INR RECHARGES
// =====================================================
router.get(
  "/inr-recharges",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const transactions = await Transaction.find({
        type: "recharge",
        description: { $not: /USDT/i }
      }).sort({ createdAt: -1 });

      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Error fetching INR recharges" });
    }
  }
);


// =====================================================
// USDT RECHARGES
// =====================================================
router.get(
  "/usdt-recharges",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const transactions = await Transaction.find({
        description: /USDT/i
      }).sort({ createdAt: -1 });

      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Error fetching USDT recharges" });
    }
  }
);


// =====================================================
// ALL USDT DEPOSITS
// =====================================================
router.get("/usdt-deposits", adminMiddleware, async (req, res) => {
  try {
    const deposits = await UsdtDeposit.find().sort({ createdAt: -1 });
    res.json(deposits);
  } catch (error) {
    res.status(500).json({ message: "Error fetching deposits" });
  }
});


// =====================================================
// USDT APPROVE (FIXED)
// =====================================================
router.post(
  "/usdt-approve/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {

      const deposit = await UsdtDeposit.findById(req.params.id);
      if (!deposit) {
        return res.status(404).json({ message: "Deposit not found" });
      }

      if (deposit.status !== "pending") {
        return res.status(400).json({ message: "Already processed" });
      }

      deposit.status = "approved";
      await deposit.save();

      // ✅ FIXED: CREDIT USDT BALANCE (NOT walletBalance)
      await User.findOneAndUpdate(
        { userId: deposit.userId },
        { $inc: { usdtBalance: deposit.amount } }
      );

      await Transaction.findOneAndUpdate(
        { orderId: deposit.txnHash },
        { status: "success" }
      );

      const io = req.app.get("io");
      if (io) {
        io.to(deposit.userId.toString()).emit("wallet_updated");
        io.to("admin_room").emit("transaction_updated");
      }

      res.json({ message: "USDT deposit approved successfully" });

    } catch (error) {
      console.error("USDT Approve Error:", error);
      res.status(500).json({ message: "Approval failed" });
    }
  }
);


// =====================================================
// USDT REJECT
// =====================================================
router.post(
  "/usdt-reject/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {

      const deposit = await UsdtDeposit.findById(req.params.id);
      if (!deposit) {
        return res.status(404).json({ message: "Deposit not found" });
      }

      if (deposit.status !== "pending") {
        return res.status(400).json({ message: "Already processed" });
      }

      deposit.status = "rejected";
      await deposit.save();

      await Transaction.findOneAndUpdate(
        { orderId: deposit.txnHash },
        { status: "failed" }
      );

      const io = req.app.get("io");
      if (io) {
        io.to("admin_room").emit("transaction_updated");
      }

      res.json({ message: "USDT deposit rejected successfully" });

    } catch (error) {
      console.error("USDT Reject Error:", error);
      res.status(500).json({ message: "Rejection failed" });
    }
  }
);


// =====================================================
// MANUAL EARNING ENGINE
// =====================================================
router.post(
  "/run-earning-engine",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      await runDailyEarnings();

      res.json({
        success: true,
        message: "Earning engine executed successfully"
      });

    } catch (error) {
      console.error("Manual Engine Error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to run earning engine"
      });
    }
  }
);

// =====================================================
// CREATE PRODUCT (ADMIN)
// =====================================================
router.post(
  "/create-product",
  authMiddleware,
  adminMiddleware,
  upload.single("image"),
  compressImage,
  async (req, res) => {
    try {

      const {
        code,
        name,
        price,
        dailyIncome,
        validityDays,
        maxPurchaseLimit
      } = req.body;

      if (!code || !name || !price) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields"
        });
      }

      const image = req.file
        ? `/uploads/${req.file.filename}`
        : null;

      const product = new Product({
        code,
        name,
        price,
        dailyIncome,
        validityDays,
        maxPurchaseLimit,
        image,
        isActive: true
      });

      await product.save();

      res.json({
        success: true,
        message: "Product created successfully",
        product
      });

    } catch (error) {

      console.error("Create Product Error:", error);

      res.status(500).json({
        success: false,
        message: "Product creation failed"
      });
    }
  }
);

// =====================================================
// GET ALL PRODUCTS (ADMIN)
// =====================================================

router.get("/products", adminMiddleware, async (req, res) => {
  try {

    const products = await Product.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      products
    });

  } catch (error) {
    console.error("Fetch Products Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch products"
    });
  }
});

module.exports = router;