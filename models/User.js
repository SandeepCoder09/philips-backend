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

    // Email required for admin accounts
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true
    },

    password: {
      type: String,
      required: true
    },

    isFrozen: {
      type: Boolean,
      default: false
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

    usdtBalance: {
      type: Number,
      default: 0
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

    withdrawPinAttempts: {
      type: Number,
      default: 0
    },

    withdrawPinLockedUntil: {
      type: Date,
      default: null
    },

    /* ================= ROLE SYSTEM ================= */

    role: {
      type: String,
      enum: ["user", "manager_admin", "super_admin"],
      default: "user",
      index: true
    },

    // backward compatibility
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
        delete ret.password;
        return ret;
      }
    }
  }
);

/* =====================================================
   ADMIN VALIDATION
===================================================== */

userSchema.pre("save", async function () {

  if (
    (this.role === "manager_admin" || this.role === "super_admin") &&
    !this.email
  ) {
    throw new Error("Admin must have an email");
  }

  if (this.role === "manager_admin" || this.role === "super_admin") {
    this.isAdmin = true;
  }

});

module.exports =
  mongoose.models.User ||
  mongoose.model("User", userSchema);