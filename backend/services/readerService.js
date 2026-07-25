const axios = require("axios");
const env = require("../config/env");

const READER_URL = "https://r.jina.ai";

async function readPage(url) {
  const headers = { Accept: "application/json" };
  if (env.jinaApiKey) {
    headers.Authorization = `Bearer ${env.jinaApiKey}`;
  }

  const { data } = await axios.get(`${READER_URL}/${url}`, { headers });

  const payload = data.data || data;
  return {
    title: payload.title,
    url: payload.url || url,
    content: (payload.content || "").slice(0, 6000),
  };
}

module.exports = { readPage };
