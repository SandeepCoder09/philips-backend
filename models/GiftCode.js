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

    amountPerUser: {
      type: Number,
      required: true
    },

    totalAmount: {
      type: Number,
      required: true
    },

    remainingAmount: {
      type: Number,
      required: true
    },

    claimedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    expiresAt: {
      type: Date,
      required: true
    },

    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.GiftCode ||
  mongoose.model("GiftCode", giftCodeSchema);