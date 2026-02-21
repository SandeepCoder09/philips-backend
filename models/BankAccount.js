const mongoose = require("mongoose");

const bankSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    ifsc: {
      type: String,
      required: true
    },
    holderName: {
      type: String,
      required: true
    },
    bankName: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("BankAccount", bankSchema);
