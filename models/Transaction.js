const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {

    auditLog: [
      {
        action: String,
        adminId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        timestamp: {
          type: Date,
          default: Date.now
        },
        ip: String
      }
    ],

    // 🔹 Numeric userId (same as User model)
    userId: {
      type: Number,
      required: true,
      index: true
    },

    // 🔹 Professional Transaction ID (PHRCTRID-YYYYMMDDHHMMSS)
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // 🔹 Amount involved
    amount: {
      type: Number,
      required: true,
      min: 0
    },

    // 🔹 Transaction type
    type: {
      type: String,
      enum: [
        "recharge",
        "usdt_recharge",
        "withdraw",
        "purchase",
        "earning",
        "referral_bonus",
        "registration_bonus",
        "team_bonus",
        "commission",
        "gift"
      ],
      required: true,
      index: true
    },

    // 🔹 Current status
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "under review",

        "success",
        "rejected"
      ],
      default: "pending",
      index: true
    },

    // 🔹 Admin action (optional)
    actionBy: {
      type: String,
      default: null
    },

    // 🔹 Optional related product
    relatedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchasedProduct",
      default: null
    },

    // 🔹 Description shown in UI
    description: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

// 🔹 Compound index for faster user transaction history
transactionSchema.index({ userId: 1, createdAt: -1 });

module.exports =
  mongoose.models.Transaction ||
  mongoose.model("Transaction", transactionSchema);
