const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");

// ===============================
// REFERRAL DASHBOARD
// ===============================
router.get("/dashboard", authMiddleware, async (req, res) => {
  try {

    const currentUser = await User.findById(req.user.id);

    if (!currentUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // 🔥 Direct referrals (Level 1)
    const directReferrals = await User.find({
      referredById: currentUser.userId
    });

    const directCount = directReferrals.length;

    res.json({
      activeUsers: directCount,                // frontend expects this
      teamSize: directCount,                  // frontend expects this
      totalPromotionIncome: 0,                // match frontend name
      yesterdayIncome: 0,                     // match frontend name
      directReferralNumber: directCount,      // match frontend name
      invitationReward: 0                     // match frontend name
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;