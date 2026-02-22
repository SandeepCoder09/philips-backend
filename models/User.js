const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    mobile: {
      type: String,
      required: true,
      unique: true
    },

    password: {
      type: String,
      required: true
    },

    walletBalance: {
      type: Number,
      default: 0
    },

    // ===== NUMERIC USER ID SYSTEM =====
    userId: {
      type: Number,
      unique: true,
      required: true
    },

    // ===== REFERRAL SYSTEM =====
    referredById: {
      type: Number,
      default: null
    },

    isAdmin: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.User ||
  mongoose.model("User", userSchema);