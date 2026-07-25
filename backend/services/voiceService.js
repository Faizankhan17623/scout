const axios = require("axios");
const FormData = require("form-data");
const env = require("../config/env");

const GROQ_AUDIO_URL = "https://api.groq.com/openai/v1/audio";

async function transcribeAudio(buffer, filename) {
  const form = new FormData();
  form.append("file", buffer, filename || "audio.webm");
  form.append("model", "whisper-large-v3-turbo");

  const { data } = await axios.post(`${GROQ_AUDIO_URL}/transcriptions`, form, {
    headers: {
      Authorization: `Bearer ${env.llmApiKey}`,
      ...form.getHeaders(),
    },
  });

  return data.text;
}

async function synthesizeSpeech(text, voice = "troy") {
  const { data } = await axios.post(
    `${GROQ_AUDIO_URL}/speech`,
    {
      model: "canopylabs/orpheus-v1-english",
      voice,
      input: text,
      response_format: "wav",
    },
    {
      headers: {
        Authorization: `Bearer ${env.llmApiKey}`,
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer",
    }
  );

  return Buffer.from(data);
}

module.exports = { transcribeAudio, synthesizeSpeech };
