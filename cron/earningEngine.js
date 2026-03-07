const cron = require("node-cron");
const User = require("../models/User");
const PurchasedProduct = require("../models/PurchasedProduct");
const Transaction = require("../models/Transaction");

// ==============================
// CONFIG
// ==============================
const COMMISSION = {
  1: 0.03,
  2: 0.01,
  3: 0.01
};

// ==============================
// HELPERS
// ==============================
function isToday(date) {
  if (!date) return false;

  const today = new Date();
  const d = new Date(date);

  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

function generateTransactionId(prefix) {
  return prefix + Date.now();
}

// ==============================
// MAIN EARNING FUNCTION
// ==============================
async function runDailyEarnings() {
  console.log("🔄 Running Daily Earning Engine...");

  try {

    const products = await PurchasedProduct.find({
      isActive: true
    });

    for (const product of products) {

      try {

        // Skip if already credited today
        if (isToday(product.lastEarningDate)) continue;

        // Stop if max return reached
        if (
          product.maxReturn &&
          product.totalEarned >= product.maxReturn
        ) {
          product.isActive = false;
          await product.save();
          continue;
        }

        const user = await User.findOne({
          userId: product.userId
        });

        if (!user) continue;

        const dailyAmount = product.dailyEarning || 0;
        if (dailyAmount <= 0) continue;

        // ==============================
        // 1️⃣ CREDIT BUYER
        // ==============================
        user.walletBalance += dailyAmount;
        await user.save();

        product.totalEarned += dailyAmount;
        product.lastEarningDate = new Date();

        if (
          product.maxReturn &&
          product.totalEarned >= product.maxReturn
        ) {
          product.isActive = false;
        }

        await product.save();

        await Transaction.create({
          userId: user.userId,
          orderId: generateTransactionId("PHERN"),
          amount: dailyAmount,
          type: "earning",
          status: "success",
          description: `Daily income from ${product.name}`
        });

        // ==============================
        // 2️⃣ MULTI LEVEL COMMISSION
        // ==============================
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

          // Sponsor must have at least one active product
          const hasActiveProduct = await PurchasedProduct.exists({
            userId: sponsor.userId,
            isActive: true
          });

          if (!hasActiveProduct) {
            currentUser = sponsor;
            continue;
          }

          const commissionAmount =
            dailyAmount * COMMISSION[level];

          if (commissionAmount > 0) {

            sponsor.walletBalance += commissionAmount;

            sponsor.totalCommissionEarned =
              (sponsor.totalCommissionEarned || 0) +
              commissionAmount;

            await sponsor.save();

            await Transaction.create({
              userId: sponsor.userId,
              orderId: generateTransactionId("PHCOM"),
              amount: commissionAmount,
              type: "commission",
              status: "success",
              description:
                `Level ${level} commission from user ${user.userId} daily income (${product.name})`
            });
          }

          currentUser = sponsor;
        }

        console.log(`✅ Processed user ${user.userId}`);

      } catch (innerError) {
        console.error("Product Processing Error:", innerError);
      }
    }

    console.log("✅ Daily Earnings Completed");

  } catch (error) {
    console.error("❌ Earning Engine Fatal Error:", error);
  }
}

// ==============================
// CRON JOB (12:05 AM IST)
// ==============================
cron.schedule(
  "5 0 * * *",
  async () => {
    await runDailyEarnings();
  },
  {
    timezone: "Asia/Kolkata"
  }
);

// ==============================
// EXPORT FOR MANUAL TRIGGER
// ==============================
module.exports = {
  runDailyEarnings
};