const axios = require("axios");
const env = require("../config/env");

const TAVILY_URL = "https://api.tavily.com/search";

async function webSearch(query) {
  const { data } = await axios.post(
    TAVILY_URL,
    {
      query,
      max_results: 5,
      search_depth: "basic",
    },
    {
      headers: {
        Authorization: `Bearer ${env.tavilyApiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  return (data.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));
}

module.exports = { webSearch };
