const mongoose = require("mongoose");

const searchCallSchema = new mongoose.Schema(
  {
    query: { type: String, required: true },
    results: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true },
    response: { type: String, required: true },
    searches: { type: [searchCallSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
