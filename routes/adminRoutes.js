const express = require("express");
const router = express.Router();

const adminMiddleware = require("../middleware/adminMiddleware");
const adminLogger = require("../middleware/adminLogger");

// Controllers
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
  adminMiddleware,
  getDashboardStats
);


// =====================================================
// USERS LIST
// GET /api/admin/users
// =====================================================
router.get(
  "/users",
  adminMiddleware,
  getAllUsers
);


// =====================================================
// ADVANCED USER RISK DETAIL
// GET /api/admin/user-risk/:userId
// =====================================================
router.get(
  "/user-risk/:userId",
  adminMiddleware,
  getUserRiskDetail
);


// =====================================================
// USER ACTIVITY TIMELINE
// GET /api/admin/user-activity/:userId
// =====================================================
router.get(
  "/user-activity/:userId",
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
  adminMiddleware,
  getAllTransactions
);


// =====================================================
// BANKS
// GET /api/admin/banks
// =====================================================
router.get(
  "/banks",
  adminMiddleware,
  getAllBanks
);


// =====================================================
// WITHDRAW REQUESTS
// GET /api/admin/withdraws
// =====================================================
router.get(
  "/withdraws",
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
  adminMiddleware,
  adminLogger("UPDATE_WITHDRAW_STATUS"),
  updateWithdrawStatus
);

// ========================================
// USER ACTIVITY TIMELINE (TEMP SAFE)
// ========================================
exports.getUserActivityTimeline = async (req, res) => {
  try {
    return res.json([]);
  } catch (err) {
    return res.status(500).json({ message: "Failed to load timeline" });
  }
};


module.exports = router;