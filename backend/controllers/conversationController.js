const { runAgentStream, generateTitle, generateFollowUps } = require("../services/llmService");
const Conversation = require("../models/Conversation");

function titleFromMessage(text) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

function sessionTokenOf(req) {
  const token = req.header("X-Session-Token");
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

async function listConversations(req, res) {
  const sessionToken = sessionTokenOf(req);
  if (!sessionToken) {
    return res.json({ conversations: [] });
  }

  const conversations = await Conversation.find({ sessionToken }, "title createdAt updatedAt")
    .sort({ updatedAt: -1 })
    .lean();

  return res.json({ conversations });
}

async function getConversation(req, res) {
  const sessionToken = sessionTokenOf(req);
  const conversation = await Conversation.findOne({ _id: req.params.id, sessionToken }, "-sessionToken").lean();

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

function omitSessionToken(conversation) {
  const obj = conversation.toObject ? conversation.toObject() : conversation;
  const { sessionToken, ...rest } = obj;
  return rest;
}

async function createConversation(req, res) {
  const { message, deepResearch } = req.body;
  const sessionToken = sessionTokenOf(req);

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  if (!sessionToken) {
    return res.status(400).json({ error: "X-Session-Token header is required" });
  }

  const userMessage = message.trim();
  startSSE(res);

  try {
    const { response, searches, toolCalls } = await runAgentStream(
      [{ role: "user", content: userMessage }],
      (token) => sendEvent(res, "token", { token }),
      { deepResearch: !!deepResearch }
    );

    const followUps = await generateFollowUps(userMessage, response);

    const conversation = await Conversation.create({
      title: titleFromMessage(userMessage),
      sessionToken,
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: response, searches, toolCalls, followUps },
      ],
    });

    sendEvent(res, "done", { conversation: omitSessionToken(conversation) });

    // Refine the title in the background so the response isn't held up
    // waiting on a third model call; the sidebar just updates a moment
    // later once it's ready.
    generateTitle(userMessage, response)
      .then((title) => {
        if (title) return Conversation.updateOne({ _id: conversation._id }, { title });
      })
      .catch(() => {});
  } catch (err) {
    console.error("Create conversation error:", err.message);
    sendEvent(res, "error", { error: "Failed to get a response from the agent" });
  } finally {
    res.end();
  }
}

async function deleteConversation(req, res) {
  const sessionToken = sessionTokenOf(req);
  const conversation = await Conversation.findOneAndDelete({ _id: req.params.id, sessionToken });

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  return res.status(204).send();
}

async function addMessage(req, res) {
  const { message, deepResearch } = req.body;
  const sessionToken = sessionTokenOf(req);

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const conversation = await Conversation.findOne({ _id: req.params.id, sessionToken });

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

    const { response, searches, toolCalls } = await runAgentStream(
      history,
      (token) => sendEvent(res, "token", { token }),
      { deepResearch: !!deepResearch }
    );

    const followUps = await generateFollowUps(userMessage, response);

    conversation.messages.push({ role: "user", content: userMessage });
    conversation.messages.push({ role: "assistant", content: response, searches, toolCalls, followUps });
    await conversation.save();

    sendEvent(res, "done", { conversation: omitSessionToken(conversation) });
  } catch (err) {
    console.error("Add message error:", err.message);
    sendEvent(res, "error", { error: "Failed to get a response from the agent" });
  } finally {
    res.end();
  }
}

// Edits a previous user message in place, drops everything that came after
// it, and regenerates the assistant reply from that point — i.e. branches
// the conversation from an earlier turn instead of appending to the end.
async function editMessage(req, res) {
  const { message } = req.body;
  const sessionToken = sessionTokenOf(req);
  const index = Number(req.params.index);

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const conversation = await Conversation.findOne({ _id: req.params.id, sessionToken });

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= conversation.messages.length ||
    conversation.messages[index].role !== "user"
  ) {
    return res.status(400).json({ error: "Invalid message index" });
  }

  const userMessage = message.trim();
  startSSE(res);

  try {
    const history = [
      ...conversation.messages.slice(0, index).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ];

    const { response, searches, toolCalls } = await runAgentStream(history, (token) =>
      sendEvent(res, "token", { token })
    );

    const followUps = await generateFollowUps(userMessage, response);

    conversation.messages.splice(index, conversation.messages.length - index);
    conversation.messages.push({ role: "user", content: userMessage });
    conversation.messages.push({ role: "assistant", content: response, searches, toolCalls, followUps });
    await conversation.save();

    sendEvent(res, "done", { conversation: omitSessionToken(conversation) });
  } catch (err) {
    console.error("Edit message error:", err.message);
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
  editMessage,
};
