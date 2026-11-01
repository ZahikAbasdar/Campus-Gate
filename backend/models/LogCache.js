const mongoose = require("mongoose");
module.exports = mongoose.model("LogCache", new mongoose.Schema({
  logId: { type: Number, unique: true },
  plate: String,
  plateHash: String,
  action: String, // ENTRY | EXIT
  gateId: Number,
  timestamp: Number, // block timestamp (seconds)
  txHash: String,
}));
