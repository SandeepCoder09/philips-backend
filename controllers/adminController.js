const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Bank = require("../models/BankAccount");


// ==============================
// GET ALL USERS
// ==============================
exports.getAllUsers = async (req, res) => {
  try {

    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(users);

  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ==============================
// GET ALL TRANSACTIONS
// ==============================
exports.getAllTransactions = async (req, res) => {
  try {

    const transactions = await Transaction.find()
      .populate("userId", "name")
      .sort({ createdAt: -1 });

    res.json(transactions);

  } catch (error) {
    console.error("Get Transactions Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ==============================
// GET ALL BANKS
// ==============================
exports.getAllBanks = async (req, res) => {
  try {

    const banks = await Bank.find()
      .populate("userId", "name")
      .sort({ createdAt: -1 });

    res.json(banks);

  } catch (error) {
    console.error("Get Banks Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ==============================
// GET ALL WITHDRAW REQUESTS
// ==============================
exports.getAllWithdraws = async (req, res) => {
  try {

    const withdraws = await Transaction.find({ type: "withdraw" })
      .populate("userId", "name")
      .sort({ createdAt: -1 });

    res.json(withdraws);

  } catch (error) {
    console.error("Withdraw Fetch Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ==============================
// UPDATE WITHDRAW STATUS
// ==============================
exports.updateWithdrawStatus = async (req, res) => {
  try {

    const { status } = req.body;

    const allowedStatuses = [
      "under_review",
      "success",
      "rejected"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: "Withdraw not found" });
    }

    if (transaction.type !== "withdraw") {
      return res.status(400).json({ message: "Invalid transaction type" });
    }

    // Prevent editing completed transactions
    if (transaction.status === "success" || transaction.status === "rejected") {
      return res.status(400).json({ message: "Withdraw already finalized" });
    }

    transaction.status = status;

    if (status === "success") {
      transaction.actionBy = "Approved By Super Admin";
    }

    if (status === "rejected") {
      transaction.actionBy = "Rejected By Super Admin";
    }

    if (status === "under_review") {
      transaction.actionBy = "Under Review By Super Admin";
    }

    await transaction.save();

    res.json({ message: "Withdraw updated successfully" });

  } catch (error) {
    console.error("Withdraw Update Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};