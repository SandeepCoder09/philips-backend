const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  dailyIncome: {
    type: Number,
    required: true
  },
  validityDays: {
    type: Number,
    required: true
  },
  maxPurchaseLimit: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  image: {
    type: String,
    required: true
  },
  
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);