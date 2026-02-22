const User = require("../models/User");
const PurchasedProduct = require("../models/PurchasedProduct");
const Transaction = require("../models/Transaction");

function daysBetween(lastDate) {
  if (!lastDate) return 1; // First earning after purchase
  const now = new Date();
  const diffTime = now - new Date(lastDate);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

const processEarnings = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const products = await PurchasedProduct.find({
      user: userId,
      isActive: true,
    });

    for (let product of products) {
      const missedDays = daysBetween(product.lastEarningDate);

      if (missedDays <= 0) continue;

      let totalCredit = missedDays * product.dailyEarning;

      // Respect maxReturn if exists
      if (product.maxReturn) {
        const remaining =
          product.maxReturn - product.totalEarned;

        if (remaining <= 0) {
          product.isActive = false;
          await product.save();
          continue;
        }

        if (totalCredit > remaining) {
          totalCredit = remaining;
        }
      }

      // 💰 Credit wallet
      user.walletBalance += totalCredit;

      // 📈 Update product
      product.totalEarned += totalCredit;
      product.lastEarningDate = new Date();

      // Stop if reached max
      if (
        product.maxReturn &&
        product.totalEarned >= product.maxReturn
      ) {
        product.isActive = false;
      }

      await product.save();

      // 🧾 Create transaction
      await Transaction.create({
        userId: user._id,
        orderId:
          "EARN-" + Date.now() + "-" + product._id,
        amount: totalCredit,
        type: "earning",
        status: "success",
        relatedProduct: product._id,
        description: `${missedDays} day(s) earning from ${product.name}`,
      });
    }

    await user.save();
  } catch (error) {
    console.error("Earning Process Error:", error);
  }
};

module.exports = processEarnings;