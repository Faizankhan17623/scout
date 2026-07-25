const { runAgentStream } = require("../services/llmService");
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

function startSSE(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
}

function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function createConversation(req, res) {
  const { message } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const userMessage = message.trim();
  startSSE(res);

  try {
    const { response, searches, toolCalls } = await runAgentStream(
      [{ role: "user", content: userMessage }],
      (token) => sendEvent(res, "token", { token })
    );

    const conversation = await Conversation.create({
      title: titleFromMessage(userMessage),
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: response, searches, toolCalls },
      ],
    });

    sendEvent(res, "done", { conversation });
  } catch (err) {
    console.error("Create conversation error:", err.message);
    sendEvent(res, "error", { error: "Failed to get a response from the agent" });
  } finally {
    res.end();
  }
}

async function deleteConversation(req, res) {
  const conversation = await Conversation.findByIdAndDelete(req.params.id);

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  return res.status(204).send();
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
  startSSE(res);

  try {
    const history = [
      ...conversation.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ];

    const { response, searches, toolCalls } = await runAgentStream(history, (token) =>
      sendEvent(res, "token", { token })
    );

    conversation.messages.push({ role: "user", content: userMessage });
    conversation.messages.push({ role: "assistant", content: response, searches, toolCalls });
    await conversation.save();

    sendEvent(res, "done", { conversation });
  } catch (err) {
    console.error("Add message error:", err.message);
    sendEvent(res, "error", { error: "Failed to get a response from the agent" });
  } finally {
    res.end();
  }
}

module.exports = {
  listConversations,
  getConversation,
  createConversation,
  deleteConversation,
  addMessage,
};
