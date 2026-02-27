const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Bank = require("../models/BankAccount");


// =====================================================
// DASHBOARD OVERVIEW (WITH TODAY STATS)
// =====================================================
exports.getDashboardStats = async (req, res) => {
  try {

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // ================= USERS =================
    const totalUsers = await User.countDocuments();

    const todayUsers = await User.countDocuments({
      createdAt: { $gte: todayStart }
    });

    // ================= TOTAL RECHARGE =================
    const rechargeData = await Transaction.aggregate([
      { $match: { type: "recharge", status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const todayRechargeData = await Transaction.aggregate([
      {
        $match: {
          type: "recharge",
          status: "success",
          createdAt: { $gte: todayStart }
        }
      },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    // ================= TOTAL WITHDRAW =================
    const withdrawSuccessData = await Transaction.aggregate([
      { $match: { type: "withdraw", status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const todayWithdrawData = await Transaction.aggregate([
      {
        $match: {
          type: "withdraw",
          status: "success",
          createdAt: { $gte: todayStart }
        }
      },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    // ================= TOTAL COMMISSION =================
    const commissionData = await Transaction.aggregate([
      { $match: { type: "commission" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const todayCommissionData = await Transaction.aggregate([
      {
        $match: {
          type: "commission",
          createdAt: { $gte: todayStart }
        }
      },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    // ================= WITHDRAW COUNTS =================
    const pendingWithdrawCount = await Transaction.countDocuments({
      type: "withdraw",
      status: "processing"
    });

    const underReviewWithdrawCount = await Transaction.countDocuments({
      type: "withdraw",
      status: "under review"
    });

    const successWithdrawCount = await Transaction.countDocuments({
      type: "withdraw",
      status: "success"
    });

    const allWithdrawTotal = await Transaction.aggregate([
      { $match: { type: "withdraw" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    res.json({
      totalUsers,
      totalRecharge: rechargeData[0]?.total || 0,
      totalWithdraw: withdrawSuccessData[0]?.total || 0,
      totalCommission: commissionData[0]?.total || 0,
      totalWithdrawRequested: allWithdrawTotal[0]?.total || 0,

      todayUsers,
      todayRecharge: todayRechargeData[0]?.total || 0,
      todayWithdraw: todayWithdrawData[0]?.total || 0,
      todayCommission: todayCommissionData[0]?.total || 0,

      pendingWithdrawCount,
      underReviewWithdrawCount,
      successWithdrawCount
    });

  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
};


// =====================================================
// GET ALL USERS
// =====================================================
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


// =====================================================
// GET ALL TRANSACTIONS (FIXED USER JOIN)
// =====================================================
exports.getAllTransactions = async (req, res) => {
  try {

    const transactions = await Transaction.find()
      .sort({ createdAt: -1 });

    const userIds = transactions.map(t => t.userId);

    const users = await User.find({
      userId: { $in: userIds }
    });

    const userMap = {};
    users.forEach(u => {
      userMap[u.userId] = u;
    });

    const finalData = transactions.map(t => ({
      ...t.toObject(),
      user: userMap[t.userId] || null
    }));

    res.json(finalData);

  } catch (error) {
    console.error("Get Transactions Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// =====================================================
// GET ALL BANKS (FIXED USER JOIN)
// =====================================================
exports.getAllBanks = async (req, res) => {
  try {

    const banks = await Bank.find()
      .sort({ createdAt: -1 });

    const userIds = banks.map(b => b.userId);

    const users = await User.find({
      userId: { $in: userIds }
    });

    const userMap = {};
    users.forEach(u => {
      userMap[u.userId] = u;
    });

    const finalData = banks.map(b => ({
      ...b.toObject(),
      user: userMap[b.userId] || null
    }));

    res.json(finalData);

  } catch (error) {
    console.error("Get Banks Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// =====================================================
// GET ALL WITHDRAW REQUESTS (FULLY FIXED)
// =====================================================
exports.getAllWithdraws = async (req, res) => {
  try {

    const { status, userId, startDate, endDate } = req.query;

    const filter = { type: "withdraw" };

    if (status && status !== "all") {
      filter.status = status;
    }

    if (userId) {
      filter.userId = Number(userId);
    }

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const withdraws = await Transaction.find(filter)
      .sort({ createdAt: -1 });

    const userIds = withdraws.map(w => w.userId);

    const users = await User.find({
      userId: { $in: userIds }
    });

    const userMap = {};
    users.forEach(u => {
      userMap[u.userId] = u;
    });

    const finalData = withdraws.map(w => ({
      ...w.toObject(),
      user: userMap[w.userId] || null
    }));

    res.json(finalData);

  } catch (error) {
    console.error("Withdraw Fetch Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// =====================================================
// UPDATE WITHDRAW STATUS (AUDIT + SAFE REFUND)
// =====================================================
exports.updateWithdrawStatus = async (req, res) => {
  try {

    const { status } = req.body;

    const allowedStatuses = [
      "under review",
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

    if (
      transaction.status === "success" ||
      transaction.status === "rejected"
    ) {
      return res.status(400).json({
        message: "Withdraw already finalized"
      });
    }

    if (status === "rejected") {
      await User.findOneAndUpdate(
        { userId: transaction.userId },
        { $inc: { walletBalance: transaction.amount } }
      );
    }

    transaction.status = status;

    transaction.auditLog.push({
      action: status,
      adminId: req.user._id,
      ip: req.ip,
      createdAt: new Date()
    });

    await transaction.save();

    res.json({ message: "Withdraw updated successfully" });

  } catch (error) {
    console.error("Withdraw Update Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};