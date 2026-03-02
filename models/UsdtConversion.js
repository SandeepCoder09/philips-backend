const mongoose = require("mongoose");

const usdtConversionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  usdtAmount: {
    type: Number,
    required: true
  },
  rate: {
    type: Number,
    required: true
  },
  inrAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    default: "completed"
  }
}, { timestamps: true });

module.exports = mongoose.model("UsdtConversion", usdtConversionSchema);