const express = require("express");
const router = express.Router();

const adminMiddleware = require("../middleware/adminMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const adminLogger = require("../middleware/adminLogger");

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
// DASHBOARD OVERVIEW
// GET /api/admin/dashboard
// =====================================================
router.get(
  "/dashboard",
  authMiddleware,
  adminMiddleware,
  getDashboardStats
);


// =====================================================
// USERS LIST
// GET /api/admin/users
// =====================================================
router.get(
  "/users",
  authMiddleware,
  adminMiddleware,
  getAllUsers
);


// =====================================================
// ADVANCED USER RISK DETAIL
// GET /api/admin/user-risk/:userId
// =====================================================
router.get(
  "/user-risk/:userId",
  authMiddleware,
  adminMiddleware,
  getUserRiskDetail
);


// =====================================================
// USER ACTIVITY TIMELINE
// GET /api/admin/user-activity/:userId
// =====================================================
router.get(
  "/user-activity/:userId",
  authMiddleware,
  adminMiddleware,
  getUserActivityTimeline
);


// =====================================================
// BAN / UNBAN USER
// PUT /api/admin/user/:userId/ban
// body: { banned: true | false, reason?: string }
// =====================================================
router.put(
  "/user/:userId/ban",
  authMiddleware,
  adminMiddleware,
  adminLogger("TOGGLE_USER_BAN"),
  toggleUserBan
);


// =====================================================
// TRANSACTIONS
// GET /api/admin/transactions
// =====================================================
router.get(
  "/transactions",
  authMiddleware,
  adminMiddleware,
  getAllTransactions
);


// =====================================================
// BANKS
// GET /api/admin/banks
// =====================================================
router.get(
  "/banks",
  authMiddleware,
  adminMiddleware,
  getAllBanks
);


// =====================================================
// WITHDRAW REQUESTS
// GET /api/admin/withdraws
// =====================================================
router.get(
  "/withdraws",
  authMiddleware,
  adminMiddleware,
  getAllWithdraws
);


// =====================================================
// UPDATE WITHDRAW STATUS
// PUT /api/admin/withdraw/:id
// body: { status: "under review" | "success" | "rejected" }
// =====================================================
router.put(
  "/withdraw/:id",
  authMiddleware,
  adminMiddleware,
  adminLogger("UPDATE_WITHDRAW_STATUS"),
  updateWithdrawStatus
);


// =====================================================
// MANUAL EARNING ENGINE TRIGGER (NEW)
// POST /api/admin/run-earning-engine
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

module.exports = router;