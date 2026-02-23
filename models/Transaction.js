const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    orderId: {
      type: String,
      required: true
    },

    amount: {
      type: Number,
      required: true
    },

    type: {
      type: String,
      enum: [
        "recharge",
        "withdraw",
        "purchase",
        "earning",
        "referral_bonus"
      ],
      required: true
    },

    status: {
      type: String,
      enum: [
        "pending",
        "under_review",
        "processing",
        "success",
        "rejected"
      ],
      default: "pending"
    },

    actionBy: {
      type: String
    },

    relatedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchasedProduct"
    },

    description: {
      type: String
    }
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Transaction ||
  mongoose.model("Transaction", transactionSchema);