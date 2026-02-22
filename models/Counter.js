const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    required: true
  },
  value: {
    type: Number,
    required: true
  }
});

module.exports =
  mongoose.models.Counter ||
  mongoose.model("Counter", counterSchema);