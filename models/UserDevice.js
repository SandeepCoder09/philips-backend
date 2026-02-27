const mongoose = require("mongoose");

const userDeviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  ipAddress: String,
  userAgent: String,
  deviceInfo: String,
  loginAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("UserDevice", userDeviceSchema);