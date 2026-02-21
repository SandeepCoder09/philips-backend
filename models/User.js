const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    mobile: {
      type: String,
      required: true,
      unique: true
    },

    // 🔹 Wallet Balance System
    walletBalance: {
      type: Number,
      default: 0
    },

    // 🔹 Admin Control
    isAdmin: {
      type: Boolean,
      default: false
    },

    // 🔹 Referral System
    inviteCode: {
      type: String,
      unique: true,
      sparse: true
    },

    referredBy: {
      type: String
    }

  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);