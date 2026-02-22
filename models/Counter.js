const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true
  },
  value: {
    type: Number,
    default: 9999   // so first user becomes 10000
  }
});

module.exports =
  mongoose.models.Counter ||
  mongoose.model("Counter", counterSchema);