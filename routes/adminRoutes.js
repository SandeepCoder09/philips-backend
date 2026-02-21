const express = require("express");
const router = express.Router();

const adminMiddleware = require("../middleware/adminMiddleware");

const {
  getAllUsers,
  getAllTransactions,
  getAllBanks
} = require("../controllers/adminController");

// Protect all admin routes
router.get("/users", adminMiddleware, getAllUsers);
router.get("/transactions", adminMiddleware, getAllTransactions);
router.get("/banks", adminMiddleware, getAllBanks);

module.exports = router;