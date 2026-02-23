const mongoose = require("mongoose");

const giftCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },

    // 🔹 Total number of users allowed
    maxUsers: {
      type: Number,
      required: true
    },

    // 🔹 Track users who redeemed
    usedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    expiresAt: {
      type: Date,
      default: null
    },

    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("GiftCode", giftCodeSchema);