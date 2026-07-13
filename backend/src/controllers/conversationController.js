const { runAgent } = require("../services/llmService");
const Conversation = require("../models/Conversation");

function titleFromMessage(text) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

async function listConversations(req, res) {
  const conversations = await Conversation.find({}, "title createdAt updatedAt")
    .sort({ updatedAt: -1 })
    .lean();

  return res.json({ conversations });
}

async function getConversation(req, res) {
  const conversation = await Conversation.findById(req.params.id).lean();

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  return res.json({ conversation });
}

async function createConversation(req, res) {
  const { message } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const userMessage = message.trim();

  try {
    const { response, searches } = await runAgent([{ role: "user", content: userMessage }]);

    const conversation = await Conversation.create({
      title: titleFromMessage(userMessage),
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: response, searches },
      ],
    });

    return res.status(201).json({ conversation });
  } catch (err) {
    console.error("Create conversation error:", err.response?.data || err.message);
    return res.status(502).json({ error: "Failed to get a response from the agent" });
  }
}

async function addMessage(req, res) {
  const { message } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const userMessage = message.trim();

  try {
    const history = [
      ...conversation.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ];

    const { response, searches } = await runAgent(history);

    conversation.messages.push({ role: "user", content: userMessage });
    conversation.messages.push({ role: "assistant", content: response, searches });
    await conversation.save();

    return res.json({ conversation });
  } catch (err) {
    console.error("Add message error:", err.response?.data || err.message);
    return res.status(502).json({ error: "Failed to get a response from the agent" });
  }
}

module.exports = { listConversations, getConversation, createConversation, addMessage };
