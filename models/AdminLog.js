const mongoose = require("mongoose");

const adminLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  action: {
    type: String,
    required: true
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  metadata: {
    type: Object
  },
  ipAddress: String
}, { timestamps: true });

module.exports = mongoose.model("AdminLog", adminLogSchema);