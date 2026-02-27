const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    /* ================= BASIC INFO ================= */

    name: {
      type: String,
      required: true,
      trim: true
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    isBanned: {
      type: Boolean,
      default: false
    },

    banReason: String,
    lastLogin: Date,
    riskScore: {
      type: Number,
      default: 0
    },

    /* ================= WALLET SYSTEM ================= */

    walletBalance: {
      type: Number,
      default: 0,
      min: 0
    },

    /* ================= NUMERIC USER ID ================= */

    userId: {
      type: Number,
      unique: true,
      required: true,
      index: true
    },

    /* ================= REFERRAL SYSTEM ================= */

    referredById: {
      type: Number,
      default: null,
      index: true
    },

    /* ================= QUALIFICATION SYSTEM ================= */

    // User becomes qualified after purchasing product >= 399
    isQualified: {
      type: Boolean,
      default: false
    },

    // Count of direct referrals who became qualified
    qualifiedDirectCount: {
      type: Number,
      default: 0
    },

    // ₹50 first direct bonus (only once lifetime)
    firstDirectBonusGiven: {
      type: Boolean,
      default: false
    },

    // ₹300 milestone bonus after 3 qualified directs
    teamBonusGiven: {
      type: Boolean,
      default: false
    },

    /* ================= COMMISSION TRACKING ================= */

    totalCommissionEarned: {
      type: Number,
      default: 0
    },

    /* ================= WITHDRAW PIN ================= */

    withdrawPin: {
      type: String,
      default: null
    },

    /* ================= ROLE ================= */

    isAdmin: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,

    // Hide internal Mongo fields from API response
    toJSON: {
      transform: function (doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

module.exports =
  mongoose.models.User ||
  mongoose.model("User", userSchema);