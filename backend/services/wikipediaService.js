const axios = require("axios");

const SEARCH_URL = "https://en.wikipedia.org/w/api.php";
const SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary";
const USER_AGENT = "Scout/1.0 (https://github.com/Faizankhan17623/scout)";

async function wikipediaLookup(query) {
  const { data: searchData } = await axios.get(SEARCH_URL, {
    params: {
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: 1,
      format: "json",
    },
    headers: { "User-Agent": USER_AGENT },
  });

  const hit = searchData.query?.search?.[0];
  if (!hit) {
    throw new Error(`No Wikipedia article found for "${query}"`);
  }

  const { data: summary } = await axios.get(`${SUMMARY_URL}/${encodeURIComponent(hit.title)}`, {
    headers: { "User-Agent": USER_AGENT },
  });

  return {
    title: summary.title,
    extract: summary.extract,
    url: summary.content_urls?.desktop?.page,
    thumbnail: summary.thumbnail?.source,
  };
}

module.exports = { wikipediaLookup };
