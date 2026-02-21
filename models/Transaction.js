const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  orderId: {
    type: String,
    required: true
  },

  type: {
    type: String,
    enum: ["recharge", "withdraw"],
    required: true
  },

  amount: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    enum: ["success", "pending", "processing", "rejected", "failed"],
    default: "pending"
  }

}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);
