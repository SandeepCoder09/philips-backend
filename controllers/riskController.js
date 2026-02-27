const User = require("../models/User");
const Transaction = require("../models/Transaction");
const UserDevice = require("../models/UserDevice");

/* =====================================================
   GET USER RISK DETAIL (CORRECT FOR YOUR MODELS)
===================================================== */
exports.getUserRiskDetail = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    const numericUserId = Number(userId);

    if (isNaN(numericUserId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    /* ================= FIND USER ================= */

    const user = await User.findOne({ userId: numericUserId })
      .select("-password -resetToken -__v")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    /* ================= RECHARGE TOTAL ================= */

    const rechargeAgg = await Transaction.aggregate([
      {
        $match: {
          userId: numericUserId,
          type: "recharge",
          status: "success"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const totalRecharge = rechargeAgg[0]?.total || 0;

    /* ================= WITHDRAW TOTAL ================= */

    const withdrawAgg = await Transaction.aggregate([
      {
        $match: {
          userId: numericUserId,
          type: "withdraw",
          status: "success"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const totalWithdraw = withdrawAgg[0]?.total || 0;

    /* ================= DEVICE HISTORY ================= */

    // IMPORTANT: UserDevice.userId is ObjectId
    const devices = await UserDevice.find({ userId: user._id })
      .sort({ loginAt: -1 })
      .lean();

    /* ================= REFERRALS ================= */

    // IMPORTANT: Your field is referredById (Number)
    const referrals = await User.find({ referredById: numericUserId })
      .select("name userId createdAt")
      .lean();

    /* ================= RESPONSE ================= */

    return res.json({
      user,
      totalRecharge,
      totalWithdraw,
      net: totalRecharge - totalWithdraw,
      referrals,
      devices
    });

  } catch (err) {
    console.error("Risk Detail Error:", err);
    return res.status(500).json({
      message: "Server error while loading risk data"
    });
  }
};


/* =====================================================
   USER ACTIVITY TIMELINE (NOT IMPLEMENTED YET)
===================================================== */
exports.getUserActivityTimeline = async (req, res) => {
    try {
      const { userId } = req.params;
  
      const numericUserId = Number(userId);
  
      if (isNaN(numericUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
  
      const user = await User.findOne({ userId: numericUserId });
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      const activities = [];
  
      /* ================= REGISTRATION ================= */
      activities.push({
        type: "registration",
        message: "User registered",
        date: user.createdAt
      });
  
      /* ================= LOGIN HISTORY ================= */
      const logins = await UserDevice.find({ userId: user._id })
        .sort({ loginAt: -1 })
        .limit(20)
        .lean();
  
      logins.forEach(login => {
        activities.push({
          type: "login",
          message: `Login from ${login.ipAddress || "Unknown IP"}`,
          date: login.loginAt
        });
      });
  
      /* ================= TRANSACTIONS ================= */
      const transactions = await Transaction.find({
        userId: numericUserId
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
  
      transactions.forEach(tx => {
        activities.push({
          type: tx.type,
          message: `${tx.type} ₹${tx.amount} (${tx.status})`,
          date: tx.createdAt
        });
      });
  
      /* ================= SORT ALL ================= */
      activities.sort((a, b) => new Date(b.date) - new Date(a.date));
  
      return res.json(activities);
  
    } catch (err) {
      console.error("Timeline Error:", err);
      return res.status(500).json({
        message: "Failed to load user activity"
      });
    }
  };