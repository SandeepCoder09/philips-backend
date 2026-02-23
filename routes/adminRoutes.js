const express = require("express");
const router = express.Router();

const adminMiddleware = require("../middleware/adminMiddleware");

const {
  getAllUsers,
  getAllTransactions,
  getWithdrawRequests,
  updateWithdrawStatus,
  getAllBanks
} = require("../controllers/adminController");


// ==============================
// USERS
// ==============================
router.get("/users", adminMiddleware, getAllUsers);


// ==============================
// TRANSACTIONS
// ==============================
router.get("/transactions", adminMiddleware, getAllTransactions);


// ==============================
// WITHDRAW REQUESTS
// ==============================
router.get("/withdraws", adminMiddleware, getWithdrawRequests);
router.put("/withdraw/:id", adminMiddleware, updateWithdrawStatus);


// ==============================
// BANKS
// ==============================
router.get("/banks", adminMiddleware, getAllBanks);


module.exports = router;