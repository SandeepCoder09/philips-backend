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

    // 🔹 NEW EMAIL FIELD (Required for Admin Only)
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true // allows normal users without email
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

    isQualified: {
      type: Boolean,
      default: false
    },

    qualifiedDirectCount: {
      type: Number,
      default: 0
    },

    firstDirectBonusGiven: {
      type: Boolean,
      default: false
    },

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

    // USDT Balance Convert
    usdtBalance: {
      type: Number,
      default: 0
    },

    walletBalance: {
      type: Number,
      default: 0
    },


    /* ================= ROLE ================= */

    isAdmin: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,

    toJSON: {
      transform: function (doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.password; // 🔐 NEVER expose password
        return ret;
      }
    }
  }
);

/* =====================================================
   ADMIN VALIDATION
===================================================== */

userSchema.pre("save", function () {
  if (this.isAdmin && !this.email) {
    throw new Error("Admin must have an email");
  }
});

module.exports =
  mongoose.models.User ||
  mongoose.model("User", userSchema);