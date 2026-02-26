const User = require("../models/User");
const PurchasedProduct = require("../models/PurchasedProduct");
const Transaction = require("../models/Transaction");
const generateTransactionId = require("./generateTransactionId");

// ==============================
// Helper: Days Between
// ==============================
function daysBetween(lastDate) {
  if (!lastDate) return 1;

  const now = new Date();
  const last = new Date(lastDate);

  const diffTime = now - last;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// ==============================
// Process Earnings For One User
// ==============================
const processEarnings = async (userId) => {
  try {
    if (!userId) return;

    // ✅ Use numeric userId
    const user = await User.findOne({ userId: Number(userId) });
    if (!user) return;

    const products = await PurchasedProduct.find({
      userId: Number(userId),
      isActive: true
    });

    if (!products.length) return;

    for (let product of products) {
      try {
        const dailyEarning = Number(product.dailyEarning || 0);
        if (dailyEarning <= 0) continue;

        const missedDays = daysBetween(product.lastEarningDate);
        if (missedDays <= 0) continue;

        let totalCredit = missedDays * dailyEarning;

        // ==============================
        // Respect maxReturn
        // ==============================
        if (product.maxReturn) {
          const remaining =
            Number(product.maxReturn) -
            Number(product.totalEarned || 0);

          if (remaining <= 0) {
            product.isActive = false;
            await product.save();
            continue;
          }

          if (totalCredit > remaining) {
            totalCredit = remaining;
          }
        }

        // ==============================
        // Credit Wallet
        // ==============================
        user.walletBalance =
          Number(user.walletBalance || 0) + totalCredit;

        // ==============================
        // Update Product
        // ==============================
        product.totalEarned =
          Number(product.totalEarned || 0) + totalCredit;

        product.lastEarningDate = new Date();

        if (
          product.maxReturn &&
          product.totalEarned >= product.maxReturn
        ) {
          product.isActive = false;
        }

        await product.save();

        // ==============================
        // Create Transaction
        // ==============================
        const earnId = generateTransactionId("PHERNID");

        await Transaction.create({
          userId: user.userId, // numeric
          orderId: earnId,
          amount: totalCredit,
          type: "earning",
          status: "success",
          relatedProduct: product._id,
          description: `${missedDays} day(s) earning from ${product.name}`
        });

      } catch (productError) {
        console.error("Product earning error:", productError);
      }
    }

    await user.save();

  } catch (error) {
    console.error("Earning Process Fatal Error:", error);
  }
};

module.exports = processEarnings;