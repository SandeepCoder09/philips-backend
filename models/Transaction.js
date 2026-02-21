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
      type: String, // recharge / withdraw
      required: true
    },

    status: {
      type: String, // pending / success / rejected / processing
      default: "pending"
    }
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Transaction ||
  mongoose.model("Transaction", transactionSchema);