const mongoose = require("mongoose");
module.exports = mongoose.model("Vehicle", new mongoose.Schema({
  plate: { type: String, unique: true, required: true },
  plateHash: String,
  ownerName: String,
  phone: String,
  department: String,
  regTx: String,
}, { timestamps: true }));
