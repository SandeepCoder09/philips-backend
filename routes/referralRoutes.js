const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");

// ===============================
// REFERRAL DASHBOARD
// ===============================
router.get("/dashboard", authMiddleware, async (req, res) => {
  try {

    // Logged-in user
    const currentUser = await User.findById(req.user.id);

    if (!currentUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Direct referrals (Level 1)
    const directReferrals = await User.find({
      referredById: currentUser.userId
    }).select("name mobile userId walletBalance createdAt");

    const teamSize = directReferrals.length;

    // Future: calculate referral income here
    const totalReferralIncome = 0;

    res.json({
      userId: currentUser.userId,
      teamSize,
      directReferralCount: teamSize,
      totalReferralIncome,
      referrals: directReferrals
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;