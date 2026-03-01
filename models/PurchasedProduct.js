const mongoose = require("mongoose");

const purchasedProductSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      required: true,
      index: true
    },

    // 🔥 Link to original product
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },

    // Snapshot fields (important if product changes later)
    name: {
      type: String,
      required: true
    },

    price: {
      type: Number,
      required: true
    },

    dailyEarning: {
      type: Number,
      required: true
    },

    purchaseDate: {
      type: Date,
      default: Date.now
    },

    // 🔥 Expiry date
    endDate: {
      type: Date,
      required: true
    },

    // 🔹 Total amount earned so far
    totalEarned: {
      type: Number,
      default: 0
    },

    // 🔹 Last date earning was credited
    lastEarningDate: {
      type: Date,
      default: null
    },

    // 🔹 Product active status (auto deactivate after expiry)
    isActive: {
      type: Boolean,
      default: true
    },

    // 🔹 Optional: Maximum return cap
    maxReturn: {
      type: Number,
      default: null
    }
  },
  { timestamps: true }
);

// 🔥 Compound index for fast limit checks
purchasedProductSchema.index({ userId: 1, productId: 1 });

module.exports =
  mongoose.models.PurchasedProduct ||
  mongoose.model("PurchasedProduct", purchasedProductSchema);