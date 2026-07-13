const axios = require("axios");
const env = require("../config/env");
const { webSearch } = require("./tavilyService");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const tools = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the live web for up-to-date information, facts, news, or anything not known from training data.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to look up on the web.",
          },
        },
        required: ["query"],
      },
    },
  },
];

async function callLLM(messages) {
  const { data } = await axios.post(
    GROQ_URL,
    {
      model: env.llmModel,
      messages,
      tools,
      tool_choice: "auto",
    },
    {
      headers: {
        Authorization: `Bearer ${env.llmApiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  return data.choices[0].message;
}

async function runAgent(history) {
  const messages = [
    {
      role: "system",
      content:
        "You are a helpful agent with access to a web_search tool. Use it whenever the user's request needs current or factual information you're not certain about. Cite sources briefly when you use search results.",
    },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const searches = [];
  const MAX_TOOL_ROUNDS = 5;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const message = await callLLM(messages);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { response: message.content, searches };
    }

    messages.push(message);

    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      let results = [];

      if (toolCall.function.name === "web_search") {
        const searchData = await webSearch(args.query);
        results = searchData.results;
        searches.push({ query: args.query, results, images: searchData.images });
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(results),
      });
    }
  }

  throw new Error("Agent exceeded maximum tool-call rounds");
}

module.exports = { runAgent };
