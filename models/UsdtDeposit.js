const mongoose = require("mongoose");

const usdtDepositSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },

    depositId: {
      type: String,
      required: true,
      unique: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    network: {
      type: String,
      required: true,
      enum: ["TRC20", "BEP20"]
    },

    txnHash: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },

    adminNote: {
      type: String,
      default: ""
    }

  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("UsdtDeposit", usdtDepositSchema);