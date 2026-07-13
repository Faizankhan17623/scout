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
      include_images: true,
      include_image_descriptions: true,
    },
    {
      headers: {
        Authorization: `Bearer ${env.tavilyApiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  const results = (data.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));

  const images = (data.images || [])
    .filter((img) => img.url)
    .map((img) => ({ url: img.url, description: img.description || "" }));

  return { results, images };
}

module.exports = { webSearch };
