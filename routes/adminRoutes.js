const express = require("express");
const router = express.Router();

const adminMiddleware = require("../middleware/adminMiddleware");

const {
  getAllUsers,
  getAllTransactions,
  getAllBanks,
  getAllWithdraws,
  updateWithdrawStatus
} = require("../controllers/adminController");


// ================= USERS =================
router.get("/users", adminMiddleware, getAllUsers);

// ================= TRANSACTIONS =================
router.get("/transactions", adminMiddleware, getAllTransactions);

// ================= BANKS =================
router.get("/banks", adminMiddleware, getAllBanks);

// ================= WITHDRAWS =================
router.get("/withdraws", adminMiddleware, getAllWithdraws);
router.put("/withdraw/:id", adminMiddleware, updateWithdrawStatus);

module.exports = router;