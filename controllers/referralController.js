const User = require("../models/User");

// ==========================
// REFERRAL DASHBOARD
// ==========================
const getReferralDashboard = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);

    if (!currentUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // 🔥 Find direct referrals using numeric userId
    const directReferrals = await User.find({
      referredById: currentUser.userId
    });

    const directCount = directReferrals.length;

    // For now teamSize = directCount
    const teamSize = directCount;

    res.json({
      activeUsers: teamSize,
      teamSize,
      totalPromotionIncome: 0,
      yesterdayIncome: 0,
      directReferralNumber: directCount,
      invitationReward: 0
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

module.exports = {
  getReferralDashboard
};