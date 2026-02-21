const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Bank = require("../models/BankAccount");

// ==============================
// Get All Users
// ==============================
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// ==============================
// Get All Transactions
// ==============================
exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// ==============================
// Get All Banks
// ==============================
exports.getAllBanks = async (req, res) => {
  try {
    const banks = await Bank.find();
    res.json(banks);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};