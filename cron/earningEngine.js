const cron = require("node-cron");
const User = require("../models/User");
const PurchasedProduct = require("../models/PurchasedProduct");
const Transaction = require("../models/Transaction");

// ==============================
// CONFIG
// ==============================
const COMMISSION = {
  1: 0.05,
  2: 0.03,
  3: 0.02
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
  const now = new Date();
  const timestamp =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0") +
    now.getHours().toString().padStart(2, "0") +
    now.getMinutes().toString().padStart(2, "0") +
    now.getSeconds().toString().padStart(2, "0");

  return `${prefix}${timestamp}`;
}

// ==============================
// DAILY CRON (12:05 AM)
// ==============================
cron.schedule("5 0 * * *", async () => {
  console.log("🔄 Running Daily Earning Engine...");

  try {
    const products = await PurchasedProduct.find({ isActive: true });

    for (let product of products) {
      try {
        // Skip if already credited today
        if (isToday(product.lastEarningDate)) continue;

        // Stop if max reached
        if (
          product.maxReturn &&
          product.totalEarned >= product.maxReturn
        ) {
          product.isActive = false;
          await product.save();
          continue;
        }

        // 🔎 IMPORTANT: must use numeric userId
        const user = await User.findOne({ userId: product.userId });
        if (!user) continue;

        const dailyAmount = product.dailyEarning || 0;
        if (dailyAmount <= 0) continue;

        // ==============================
        // CREDIT BUYER
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
          orderId: generateTransactionId("PHERNID"),
          amount: dailyAmount,
          type: "earning",
          status: "success",
          description: `Daily earning from ${product.name}`
        });

        // ==============================
        // MULTI LEVEL COMMISSION
        // ==============================
        let currentUser = user;

        for (let level = 1; level <= 3; level++) {

          if (!currentUser.referredById) break;

          const sponsor = await User.findOne({
            userId: currentUser.referredById
          });

          if (!sponsor) break;

          // Qualification check
          if (!sponsor.isQualified) {
            currentUser = sponsor;
            continue;
          }

          // Must have active product
          const activeProduct = await PurchasedProduct.findOne({
            userId: sponsor.userId,
            isActive: true
          });

          if (!activeProduct) {
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
              orderId: generateTransactionId("PHCMTRID"),
              amount: commissionAmount,
              type: "commission",
              status: "success",
              description: `Level ${level} commission from user ${user.userId}`
            });
          }

          currentUser = sponsor;
        }

        console.log(
          `✅ Processed product ${product._id}`
        );

      } catch (innerError) {
        console.error("Product Processing Error:", innerError);
      }
    }

    console.log("✅ Daily Earnings Completed");

  } catch (error) {
    console.error("❌ Earning Engine Fatal Error:", error);
  }
  
});