const User = require("../models/User");
const Transaction = require("../models/Transaction");
const BankAccount = require("../models/BankAccount");

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" });
  }
};

// Get all transactions
exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching transactions" });
  }
};

// Get all bank accounts
exports.getAllBanks = async (req, res) => {
  try {
    const banks = await BankAccount.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.json(banks);
  } catch (error) {
    res.status(500).json({ message: "Error fetching banks" });
  }
};