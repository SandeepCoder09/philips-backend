const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

/* =====================================================
   REFERRAL DASHBOARD (INCOME ONLY)
===================================================== */
router.get("/dashboard", authMiddleware, async (req, res) => {
  try {

    const currentUser = await User.findOne({
      userId: req.user.userId
    });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const userId = currentUser.userId;

    /* ===============================
       DATE FILTERS
    =============================== */

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    /* ===============================
       COMMISSION DATA
    =============================== */

    const transactions = await Transaction.find({
      userId,
      type: "commission"
    });

    let totalIncome = 0;
    let todayIncome = 0;
    let yesterdayIncome = 0;
    let weekIncome = 0;
    let pendingIncome = 0;
    let level1Income = 0;
    let level2Income = 0;
    let level3Income = 0;

    transactions.forEach(tx => {

      if (tx.status === "success") {

        totalIncome += tx.amount;

        if (tx.createdAt >= startOfToday)
          todayIncome += tx.amount;

        if (
          tx.createdAt >= startOfYesterday &&
          tx.createdAt < startOfToday
        )
          yesterdayIncome += tx.amount;

        if (tx.createdAt >= startOfWeek)
          weekIncome += tx.amount;
      }

      if (tx.status === "pending")
        pendingIncome += tx.amount;

      if (tx.description?.includes("Level 1"))
        level1Income += tx.amount;

      if (tx.description?.includes("Level 2"))
        level2Income += tx.amount;

      if (tx.description?.includes("Level 3"))
        level3Income += tx.amount;
    });

    /* ===============================
       QUALIFICATION CHECK
    =============================== */

    const purchaseData = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "purchase",
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

    const totalPurchaseAmount =
      purchaseData.length > 0 ? purchaseData[0].total : 0;

    const isQualified = totalPurchaseAmount >= 399;

    /* ===============================
       RESPONSE (NO TEAM DATA HERE)
    =============================== */

    res.json({
      success: true,

      // Commission Overview
      totalPromotionIncome: totalIncome,
      todayIncome,
      yesterdayIncome,
      weekIncome,
      pendingIncome,

      // Level Income Breakdown
      level1Income,
      level2Income,
      level3Income,

      // Bonus
      invitationReward: 0,

      // Qualification
      isQualified
    });

  } catch (error) {
    console.error("Referral Dashboard Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
});


/* =====================================================
   MY TEAM OVERVIEW (STRUCTURE ONLY)
===================================================== */
router.get("/supervisor-team", authMiddleware, async (req, res) => {
  try {

    const supervisor = await User.findOne({
      userId: req.user.userId
    });

    if (!supervisor) {
      return res.status(404).json({
        success: false,
        message: "Supervisor not found"
      });
    }

    /* ===============================
       LEVEL STRUCTURE
    =============================== */

    const level1Users = await User.find({
      referredById: supervisor.userId
    }).select("userId createdAt");

    const level1Ids = level1Users.map(u => u.userId);

    const level2Users = await User.find({
      referredById: { $in: level1Ids }
    }).select("userId createdAt");

    const level2Ids = level2Users.map(u => u.userId);

    const level3Users = await User.find({
      referredById: { $in: level2Ids }
    }).select("userId createdAt");

    const allMembers = [
      ...level1Users.map(u => ({ ...u.toObject(), level: 1 })),
      ...level2Users.map(u => ({ ...u.toObject(), level: 2 })),
      ...level3Users.map(u => ({ ...u.toObject(), level: 3 }))
    ];

    const allIds = allMembers.map(m => m.userId);

    /* ===============================
       TEAM RECHARGE
    =============================== */

    const rechargeData = await Transaction.aggregate([
      {
        $match: {
          userId: { $in: allIds },
          type: "recharge",
          status: "success"
        }
      },
      {
        $group: {
          _id: "$userId",
          totalRecharge: { $sum: "$amount" }
        }
      }
    ]);

    const rechargeMap = {};
    rechargeData.forEach(r => {
      rechargeMap[r._id] = r.totalRecharge;
    });

    /* ===============================
       SUPERVISOR COMMISSION
    =============================== */

    const commissionTx = await Transaction.find({
      userId: supervisor.userId,
      type: "commission",
      status: "success"
    });

    const commissionMap = {};

    commissionTx.forEach(tx => {
      const desc = tx.description || "";

      allIds.forEach(id => {
        if (desc.includes(id.toString())) {
          commissionMap[id] =
            (commissionMap[id] || 0) + tx.amount;
        }
      });
    });

    /* ===============================
       FINAL BUILD
    =============================== */

    let totalTeamRecharge = 0;
    let totalTeamCommission = 0;

    const team = allMembers.map(member => {

      const recharge = rechargeMap[member.userId] || 0;
      const commission = commissionMap[member.userId] || 0;

      totalTeamRecharge += recharge;
      totalTeamCommission += commission;

      return {
        userId: member.userId,
        level: member.level,
        totalRecharge: recharge,
        totalCommission: commission,
        joinDate: member.createdAt
      };
    });

    res.json({
      success: true,

      // Team Structure
      totalMembers: team.length,
      directMembers: level1Users.length,
      level1Count: level1Users.length,
      level2Count: level2Users.length,
      level3Count: level3Users.length,

      // Team Financial
      totalTeamRecharge,
      totalTeamCommission,

      team
    });

  } catch (error) {
    console.error("Supervisor Team Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
});

module.exports = router;