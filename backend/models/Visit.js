const mongoose = require("mongoose");

const visitSchema = new mongoose.Schema(
  {
    ip: { type: String, default: "" },
    sessionToken: { type: String, default: null, index: true },
    path: { type: String, required: true },
    method: { type: String, required: true },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Visit", visitSchema);
