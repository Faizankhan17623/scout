const { runAgent } = require("../services/llmService");
const Conversation = require("../models/Conversation");

async function chat(req, res) {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const { response, searches } = await runAgent(prompt.trim());

    const conversation = await Conversation.create({
      prompt: prompt.trim(),
      response,
      searches,
    });

    return res.json({
      id: conversation._id,
      response,
      searches,
    });
  } catch (err) {
    console.error("Chat error:", err.response?.data || err.message);
    return res.status(502).json({ error: "Failed to get a response from the agent" });
  }
}

module.exports = { chat };
