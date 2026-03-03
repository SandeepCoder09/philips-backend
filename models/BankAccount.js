const mongoose = require("mongoose");

const bankAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },

    accountNumber: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (value) {
          return /^\d{9,18}$/.test(value);
        },
        message: "Account number must contain only digits (9-18 numbers)"
      }
    },

    ifsc: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
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
    },

    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending"
    }
  },
  { timestamps: true }
);

bankAccountSchema.index({ userId: 1 }, { unique: true });

module.exports =
  mongoose.models.BankAccount ||
  mongoose.model("BankAccount", bankAccountSchema);