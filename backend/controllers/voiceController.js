const { transcribeAudio, synthesizeSpeech } = require("../services/voiceService");

async function transcribe(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "audio file is required" });
  }

  try {
    const text = await transcribeAudio(req.file.buffer, req.file.originalname);
    return res.json({ text });
  } catch (err) {
    console.error("Transcribe error:", err.message);
    return res.status(502).json({ error: "Failed to transcribe audio" });
  }
}

async function speak(req, res) {
  const { text, voice } = req.body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  try {
    const audio = await synthesizeSpeech(text.trim(), voice);
    res.set("Content-Type", "audio/wav");
    return res.send(audio);
  } catch (err) {
    console.error("Speak error:", err.message);
    return res.status(502).json({ error: "Failed to synthesize speech" });
  }
}

module.exports = { transcribe, speak };
