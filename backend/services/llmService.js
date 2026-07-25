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

// Streams a single completion. If the model decides to call a tool instead
// of answering, no tokens are emitted (Groq doesn't stream tool-call
// arguments as readable text) and the assembled message is returned with
// tool_calls populated, same shape as the non-streaming response.
async function readStreamAsText(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function streamLLM(messages, onToken) {
  let response;
  try {
    response = await axios.post(
      GROQ_URL,
      {
        model: env.llmModel,
        messages,
        tools,
        tool_choice: "auto",
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${env.llmApiKey}`,
          "Content-Type": "application/json",
        },
        responseType: "stream",
      }
    );
  } catch (err) {
    if (err.response?.data?.pipe) {
      const text = await readStreamAsText(err.response.data);
      err.message = `Groq API error (${err.response.status}): ${text}`;
    }
    throw err;
  }

  let content = "";
  const toolCalls = [];
  let buffer = "";

  await new Promise((resolve, reject) => {
    response.data.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;

        let parsed;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }

        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          content += delta.content;
          onToken(delta.content);
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCalls[tc.index] || {
              id: "",
              type: "function",
              function: { name: "", arguments: "" },
            };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.function.name += tc.function.name;
            if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
            toolCalls[tc.index] = existing;
          }
        }
      }
    });

    response.data.on("end", resolve);
    response.data.on("error", reject);
  });

  return {
    role: "assistant",
    content: content || null,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

const SYSTEM_PROMPT =
  "You are a helpful agent with access to a web_search tool. Use it whenever the user's request needs current or factual information you're not certain about. Cite sources briefly when you use search results.";

function buildMessages(history) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
}

const MAX_TOOL_ROUNDS = 5;

async function executeToolCalls(message, messages, searches) {
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

async function runAgent(history) {
  const messages = buildMessages(history);
  const searches = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const message = await callLLM(messages);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { response: message.content, searches };
    }

    await executeToolCalls(message, messages, searches);
  }

  throw new Error("Agent exceeded maximum tool-call rounds");
}

// Same as runAgent, but streams tokens as the final answer is produced.
// Tool-calling rounds happen silently (no tokens emitted) since Groq does
// not stream tool-call arguments as readable text.
async function runAgentStream(history, onToken) {
  const messages = buildMessages(history);
  const searches = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const message = await streamLLM(messages, onToken);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { response: message.content, searches };
    }

    await executeToolCalls(message, messages, searches);
  }

  throw new Error("Agent exceeded maximum tool-call rounds");
}

module.exports = { runAgent, runAgentStream };
