const mongoose = require("mongoose");

const searchCallSchema = new mongoose.Schema(
  {
    query: { type: String, required: true },
    results: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    searches: { type: [searchCallSchema], default: [] },
  },
  { timestamps: true }
);

const conversationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
