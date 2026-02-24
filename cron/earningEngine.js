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

// Runs every day at 12:05 AM
cron.schedule("5 0 * * *", async () => {
  console.log("🔄 Running Daily Earning Engine...");

  try {
    const products = await PurchasedProduct.find({ isActive: true });

    for (let product of products) {

      // Skip if already credited today
      if (isToday(product.lastEarningDate)) continue;

      // Stop if maxReturn reached
      if (
        product.maxReturn &&
        product.totalEarned >= product.maxReturn
      ) {
        product.isActive = false;
        await product.save();
        continue;
      }

      const user = await User.findById(product.user);
      if (!user) continue;

      // Credit earning
      user.walletBalance += product.dailyEarning;
      await user.save();

      // Update product
      product.totalEarned += product.dailyEarning;
      product.lastEarningDate = new Date();

      // Deactivate if max reached
      if (
        product.maxReturn &&
        product.totalEarned >= product.maxReturn
      ) {
        product.isActive = false;
      }

      await product.save();

      // Create transaction
      await Transaction.create({
        userId: user._id,
        orderId: "EARN-" + Date.now() + "-" + product._id,
        amount: product.dailyEarning,
        type: "earning",
        status: "success",
        relatedProduct: product._id,
        description: `Daily earning from ${product.name}`
      });

      console.log(`✅ Credited ₹${product.dailyEarning} to user ${user._id}`);
    }

    console.log("✅ Daily Earnings Completed");
  } catch (error) {
    console.error("❌ Earning Engine Error:", error);
  }

});