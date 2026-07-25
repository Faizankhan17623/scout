const axios = require("axios");
const env = require("../config/env");

const READER_URL = "https://r.jina.ai";

async function readPage(url) {
  const headers = { Accept: "application/json" };
  if (env.jinaApiKey) {
    headers.Authorization = `Bearer ${env.jinaApiKey}`;
  }

  let data;
  try {
    ({ data } = await axios.get(`${READER_URL}/${url}`, { headers }));
  } catch (err) {
    const status = err.response?.status;
    if (status === 401 || status === 402) {
      throw new Error(
        "Jina Reader's free token allowance (10,000,000 tokens, one-time) appears to be exhausted or the API key is invalid. Get a new key at https://jina.ai/reader or remove JINA_API_KEY to fall back to the keyless tier."
      );
    }
    if (status === 429) {
      throw new Error("Jina Reader rate limit hit — try again in a moment.");
    }
    throw err;
  }

  const payload = data.data || data;
  return {
    title: payload.title,
    url: payload.url || url,
    content: (payload.content || "").slice(0, 6000),
  };
}

module.exports = { readPage };
