const mongoose = require("mongoose");

const bankAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      required: true,
      index: true
    },

    accountNumber: {
      type: String,
      required: true,
      trim: true
    },

    ifsc: {
      type: String,
      required: true,
      trim: true
    },

    holderName: {
      type: String,
      required: true,
      trim: true
    },

    bankName: {
      type: String,
      required: true,
      trim: true
    }
  },
  { timestamps: true }
);

/* 🔐 Prevent duplicate same bank for same user */
bankAccountSchema.index(
  { userId: 1, accountNumber: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.BankAccount ||
  mongoose.model("BankAccount", bankAccountSchema);