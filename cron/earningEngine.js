const cron = require("node-cron");
const User = require("../models/User");
const PurchasedProduct = require("../models/PurchasedProduct");
const Transaction = require("../models/Transaction");

function isToday(date) {
  if (!date) return false;
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

// Commission percentages
const COMMISSION = {
  1: 0.05,
  2: 0.03,
  3: 0.02
};

// Runs every day at 12:05 AM
cron.schedule("5 0 * * *", async () => {
  console.log("🔄 Running Daily Earning Engine...");

  try {
    const products = await PurchasedProduct.find({ isActive: true });

    for (let product of products) {

      
      if (isToday(product.lastEarningDate)) continue;

      if (product.maxReturn && product.totalEarned >= product.maxReturn) {
        product.isActive = false;
        await product.save();
        continue;
      }

      const user = await User.findOne({ userId: product.userId });
      if (!user) continue;

      // CREDIT DAILY EARNING TO BUYER
      user.walletBalance += product.dailyEarning;
      await user.save();


      product.totalEarned += product.dailyEarning;
      product.lastEarningDate = new Date();

      if (product.maxReturn && product.totalEarned >= product.maxReturn) {
        product.isActive = false;
      }

      await product.save();


      await Transaction.create({
        userId: user.userId,
        orderId: "EARN-" + Date.now(),
        amount: product.dailyEarning,
        type: "earning",
        status: "success",

        description: `Daily earning from ${product.name}`
      });

      // 🔥 MULTI-LEVEL COMMISSION STARTS HERE
      let currentUser = user;
      for (let level = 1; level <= 3; level++) {

        if (!currentUser.referredById) break;

        const sponsor = await User.findOne({
          userId: currentUser.referredById
        });

        if (!sponsor) break;

        // Sponsor must be qualified
        if (!sponsor.isQualified) {
          currentUser = sponsor;
          continue;
        }

        // Sponsor must have active product
        const activeProduct = await PurchasedProduct.findOne({
          userId: sponsor.userId,
          isActive: true
        });

        if (!activeProduct) {
          currentUser = sponsor;
          continue;
        }

        const commissionAmount =
          product.dailyEarning * COMMISSION[level];

        if (commissionAmount > 0) {
          sponsor.walletBalance += commissionAmount;
          sponsor.totalCommissionEarned += commissionAmount;
          await sponsor.save();

          await Transaction.create({
            userId: sponsor.userId,
            orderId: "COMM-" + Date.now() + "-" + level,
            amount: commissionAmount,
            type: "commission",
            status: "success",
            description: `Level ${level} commission from user ${user.userId}`
          });
        }

        currentUser = sponsor;
      }

      console.log(
        `✅ Credited earning + commissions for product ${product._id}`
      );
    }

    console.log("✅ Daily Earnings Completed");

  } catch (error) {
    console.error("❌ Earning Engine Error:", error);
  }

});