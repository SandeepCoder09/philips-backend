const express = require("express");
const router = express.Router();

const {
  getAllUsers,
  getAllTransactions,
  getAllBanks
} = require("../controllers/adminController");

router.get("/users", getAllUsers);
router.get("/transactions", getAllTransactions);
router.get("/banks", getAllBanks);

module.exports = router;