const express = require("express");
const router = express.Router();

const adminMiddleware = require("../middleware/adminMiddleware");

const {
  getDashboardStats,
  getAllUsers,
  getAllTransactions,
  getAllBanks,
  getAllWithdraws,
  updateWithdrawStatus
} = require("../controllers/adminController");


// =====================================================
// DASHBOARD OVERVIEW
// GET /api/admin/dashboard
// =====================================================
router.get("/dashboard", adminMiddleware, getDashboardStats);


// =====================================================
// USERS
// GET /api/admin/users
// =====================================================
router.get("/users", adminMiddleware, getAllUsers);


// =====================================================
// TRANSACTIONS
// GET /api/admin/transactions
// =====================================================
router.get("/transactions", adminMiddleware, getAllTransactions);


// =====================================================
// BANKS
// GET /api/admin/banks
// =====================================================
router.get("/banks", adminMiddleware, getAllBanks);


// =====================================================
// WITHDRAW REQUESTS
// GET /api/admin/withdraws
// =====================================================
router.get("/withdraws", adminMiddleware, getAllWithdraws);


// =====================================================
// UPDATE WITHDRAW STATUS
// PUT /api/admin/withdraw/:id
// body: { status: "under review" | "success" | "rejected" }
// =====================================================
router.put("/withdraw/:id", adminMiddleware, updateWithdrawStatus);


module.exports = router;