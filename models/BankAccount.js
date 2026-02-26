const mongoose = require("mongoose");

const bankAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,   // ✅ MUST BE NUMBER
      required: true,
      index: true
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

module.exports =
  mongoose.models.BankAccount ||
  mongoose.model("BankAccount", bankAccountSchema);