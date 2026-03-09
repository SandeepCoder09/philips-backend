const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Bank = require("../models/BankAccount");


// =====================================================
// DASHBOARD OVERVIEW
// =====================================================
exports.getDashboardStats = async (req, res) => {
  try {

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const totalUsers = await User.countDocuments();
    const todayUsers = await User.countDocuments({
      createdAt: { $gte: todayStart }
    });

    const recharge = await Transaction.aggregate([
      { $match: { type: "recharge", status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const withdrawSuccess = await Transaction.aggregate([
      { $match: { type: "withdraw", status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const commission = await Transaction.aggregate([
      { $match: { type: "commission" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const allWithdraw = await Transaction.aggregate([
      { $match: { type: "withdraw" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

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

    res.json({
      totalUsers,
      totalRecharge: recharge[0]?.total || 0,
      totalWithdraw: withdrawSuccess[0]?.total || 0,
      totalCommission: commission[0]?.total || 0,
      totalWithdrawRequested: allWithdraw[0]?.total || 0,
      todayUsers,
      pendingWithdrawCount,
      underReviewWithdrawCount,
      successWithdrawCount
    });

  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
};



// =====================================================
// GET ALL USERS (WITH TOTAL RECHARGE & WITHDRAW)
// =====================================================
exports.getAllUsers = async (req, res) => {
  try {

    const users = await User.aggregate([
      {
        $lookup: {
          from: "transactions",
          localField: "userId",
          foreignField: "userId",
          as: "transactions"
        }
      },
      {
        $addFields: {
          totalRecharge: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$transactions",
                    as: "t",
                    cond: {
                      $and: [
                        { $eq: ["$$t.type", "recharge"] },
                        { $eq: ["$$t.status", "success"] }
                      ]
                    }
                  }
                },
                as: "r",
                in: "$$r.amount"
              }
            }
          },
          totalWithdraw: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$transactions",
                    as: "t",
                    cond: {
                      $and: [
                        { $eq: ["$$t.type", "withdraw"] },
                        { $eq: ["$$t.status", "success"] }
                      ]
                    }
                  }
                },
                as: "w",
                in: "$$w.amount"
              }
            }
          }
        }
      },
      {
        $project: {
          password: 0,
          transactions: 0
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    res.json(users);

  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// =====================================================
// BAN / UNBAN USER (REAL-TIME SAFE)
// =====================================================
exports.toggleUserBan = async (req, res) => {
  try {

    const userId = Number(req.params.userId);
    const { banned } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const user = await User.findOne({ userId });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isAdmin) {
      return res.status(400).json({
        message: "Admin cannot be banned"
      });
    }

    user.isBanned = banned;
    await user.save();

    // 🔥 Real-time emit
    const io = req.app.get("io");
    if (io) {
      io.to("admin_room").emit("user_registered");
    }

    res.json({
      message: banned
        ? "User banned successfully"
        : "User unbanned successfully"
    });

  } catch (error) {
    console.error("Toggle Ban Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// =====================================================
// GET ALL TRANSACTIONS (WITH USER JOIN)
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
    console.error("Transactions Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// =====================================================
// GET ALL BANKS (WITH USER JOIN)
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
    console.error("Banks Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// =====================================================
// GET ALL WITHDRAWS (FILTER + USER JOIN)
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
      if (startDate) filter.createdAt.$gte = new Date(startDate);
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
    console.error("Withdraw Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// =====================================================
// UPDATE WITHDRAW STATUS (ROLE + STATE SAFE)
// =====================================================
exports.updateWithdrawStatus = async (req, res) => {
  try {

    const { status } = req.body;
    const adminRole = req.user.role;

    const transaction = await Transaction.findById(req.params.id);

    if (!transaction || transaction.type !== "withdraw") {
      return res.status(404).json({ message: "Withdraw not found" });
    }

    const currentStatus = transaction.status;

    // 🔒 Prevent editing finalized withdraws
    if (["success", "rejected"].includes(currentStatus)) {
      return res.status(400).json({
        message: "Withdraw already finalized"
      });
    }

    // =====================================================
    // ROLE PERMISSIONS
    // =====================================================

    // Manager can only move: processing → under review
    if (status === "under review") {

      if (!["manager_admin", "super_admin"].includes(adminRole)) {
        return res.status(403).json({
          message: "Manager or Super Admin required"
        });
      }

      if (currentStatus !== "processing") {
        return res.status(400).json({
          message: "Only processing withdraw can move to under review"
        });
      }

    }

    // Only super admin can approve
    if (status === "success") {

      if (adminRole !== "super_admin") {
        return res.status(403).json({
          message: "Super Admin access required"
        });
      }

      if (currentStatus !== "under review") {
        return res.status(400).json({
          message: "Withdraw must be under review before approval"
        });
      }

    }

    // Reject allowed for both
    if (status === "rejected") {

      if (!["manager_admin", "super_admin"].includes(adminRole)) {
        return res.status(403).json({
          message: "Admin access required"
        });
      }

      // refund wallet
      await User.findOneAndUpdate(
        { userId: transaction.userId },
        { $inc: { walletBalance: transaction.amount } }
      );
    }

    // =====================================================
    // UPDATE STATUS
    // =====================================================

    transaction.status = status;

    transaction.auditLog.push({
      action: status,
      adminId: req.user._id,
      role: adminRole,
      ip: req.ip,
      timestamp: new Date()
    });

    await transaction.save();

    // 🔥 REAL TIME
    const io = req.app.get("io");
    if (io) {
      io.to("admin_room").emit("withdraw_updated");
      io.to("admin_room").emit("transaction_updated");
    }

    res.json({
      message: "Withdraw updated successfully"
    });

  } catch (error) {

    console.error("Withdraw Update Error:", error);

    res.status(500).json({
      message: "Server Error"
    });

  }
};