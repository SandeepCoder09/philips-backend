const mongoose = require("mongoose");

const purchasedProductSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

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
    }
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.PurchasedProduct ||
  mongoose.model("PurchasedProduct", purchasedProductSchema);