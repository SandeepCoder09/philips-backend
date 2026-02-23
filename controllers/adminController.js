const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Bank = require("../models/BankAccount");


// ==============================
// Get All Users
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
// Get All Transactions
// ==============================
exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 });

    res.json(transactions);
  } catch (error) {
    console.error("Get Transactions Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ==============================
// Get Only Withdraw Requests
// ==============================
exports.getWithdrawRequests = async (req, res) => {
  try {
    const withdraws = await Transaction.find({ type: "withdraw" })
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 });

    res.json(withdraws);
  } catch (error) {
    console.error("Get Withdraw Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ==============================
// Update Withdraw Status
// ==============================
exports.updateWithdrawStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const withdraw = await Transaction.findById(id).populate("userId");

    if (!withdraw || withdraw.type !== "withdraw") {
      return res.status(404).json({ message: "Withdraw not found" });
    }

    // Prevent changing already completed
    if (withdraw.status === "success" || withdraw.status === "rejected") {
      return res.status(400).json({ message: "Already finalized" });
    }

    // ===== UNDER REVIEW =====
    if (status === "under_review") {
      withdraw.status = "under_review";
      withdraw.actionBy = "Under Review By Super Admin";
    }

    // ===== APPROVE =====
    if (status === "success") {
      withdraw.status = "success";
      withdraw.actionBy = "Approved By Super Admin";

      // Deduct user wallet if not already deducted
      if (withdraw.userId.wallet >= withdraw.amount) {
        withdraw.userId.wallet -= withdraw.amount;
        await withdraw.userId.save();
      }
    }

    // ===== REJECT =====
    if (status === "rejected") {
      withdraw.status = "rejected";
      withdraw.actionBy = "Rejected By Super Admin";
    }

    await withdraw.save();

    res.json({ message: "Withdraw updated successfully" });

  } catch (error) {
    console.error("Update Withdraw Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ==============================
// Get All Banks
// ==============================
exports.getAllBanks = async (req, res) => {
  try {
    const banks = await Bank.find()
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 });

    res.json(banks);
  } catch (error) {
    console.error("Get Banks Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};