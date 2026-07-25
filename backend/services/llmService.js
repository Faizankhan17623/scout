const axios = require("axios");
const env = require("../config/env");
const { webSearch } = require("./tavilyService");
const { getWeather } = require("./weatherService");
const { generateImage } = require("./imageGenService");
const { wikipediaLookup } = require("./wikipediaService");
const { readPage } = require("./readerService");

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
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather and a 3-day forecast for a location.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City name, optionally with country, e.g. 'Lahore' or 'Paris, France'.",
          },
        },
        required: ["location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description: "Generate an image from a text description and show it to the user.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "A detailed description of the image to generate.",
          },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wikipedia_lookup",
      description: "Look up a factual, encyclopedic summary of a topic on Wikipedia.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "The topic, person, place, or thing to look up.",
          },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_page",
      description:
        "Fetch and read the full text content of a specific web page URL (e.g. one found via web_search or given by the user).",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The full URL of the page to read.",
          },
        },
        required: ["url"],
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
  "You are a helpful agent with access to tools: web_search (live web search), get_weather (current + 3-day forecast), generate_image (text-to-image), wikipedia_lookup (encyclopedic summaries), and read_page (fetch the full text of a specific URL). Use web_search for current or factual information you're not certain about, and cite sources briefly. Use get_weather for weather questions, wikipedia_lookup for well-established factual/biographical topics, generate_image when asked to create or draw something, and read_page when you need the full content of a specific link rather than just a search snippet.";

function buildMessages(history) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
}

const MAX_TOOL_ROUNDS = 5;

// Each handler receives the parsed tool-call arguments and returns
// { result, forLLM, images? }. `forLLM` is what gets serialized back to the
// model; `result`/`images` (if present) are surfaced to the frontend via
// searches/toolCalls/images so the UI can render something richer than text.
async function runToolCall(name, args) {
  if (name === "web_search") {
    const searchData = await webSearch(args.query);
    return {
      kind: "search",
      query: args.query,
      results: searchData.results,
      images: searchData.images,
      forLLM: searchData.results,
    };
  }

  if (name === "get_weather") {
    const weather = await getWeather(args.location);
    return { kind: "weather", data: weather, forLLM: weather };
  }

  if (name === "generate_image") {
    const image = generateImage(args.prompt);
    return {
      kind: "image",
      data: image,
      images: [{ url: image.url, description: args.prompt }],
      forLLM: { url: image.url },
    };
  }

  if (name === "wikipedia_lookup") {
    const article = await wikipediaLookup(args.topic);
    return { kind: "wikipedia", data: article, forLLM: article };
  }

  if (name === "read_page") {
    const page = await readPage(args.url);
    return { kind: "read_page", data: page, forLLM: page };
  }

  return { kind: "unknown", forLLM: { error: `Unknown tool: ${name}` } };
}

async function executeToolCalls(message, messages, searches, toolCalls) {
  messages.push(message);

  for (const toolCall of message.tool_calls) {
    const args = JSON.parse(toolCall.function.arguments || "{}");

    let outcome;
    try {
      outcome = await runToolCall(toolCall.function.name, args);
    } catch (err) {
      outcome = { kind: "error", forLLM: { error: err.message } };
    }

    if (outcome.kind === "search") {
      searches.push({ query: outcome.query, results: outcome.results, images: outcome.images });
    } else if (outcome.kind !== "unknown" && outcome.kind !== "error") {
      toolCalls.push({ tool: toolCall.function.name, args, kind: outcome.kind, data: outcome.data, images: outcome.images });
    }

    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify(outcome.forLLM),
    });
  }
}

// Groq occasionally ends a turn with neither content nor a tool call
// (observed under rate-limit pressure with small/fast models). Retrying
// once is enough in practice; if it happens twice in a row, surface a
// clear error instead of persisting an empty assistant message.
async function runAgent(history) {
  const messages = buildMessages(history);
  const searches = [];
  const toolCalls = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    let message = await callLLM(messages);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      if (!message.content) {
        message = await callLLM(messages);
        if (!message.tool_calls?.length && !message.content) {
          throw new Error("The model returned an empty response. Please try again.");
        }
      }
      if (!message.tool_calls || message.tool_calls.length === 0) {
        return { response: message.content, searches, toolCalls };
      }
    }

    await executeToolCalls(message, messages, searches, toolCalls);
  }

  throw new Error("Agent exceeded maximum tool-call rounds");
}

// Same as runAgent, but streams tokens as the final answer is produced.
// Tool-calling rounds happen silently (no tokens emitted) since Groq does
// not stream tool-call arguments as readable text.
async function runAgentStream(history, onToken) {
  const messages = buildMessages(history);
  const searches = [];
  const toolCalls = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    let message = await streamLLM(messages, onToken);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      if (!message.content) {
        message = await streamLLM(messages, onToken);
        if (!message.tool_calls?.length && !message.content) {
          throw new Error("The model returned an empty response. Please try again.");
        }
      }
      if (!message.tool_calls || message.tool_calls.length === 0) {
        return { response: message.content, searches, toolCalls };
      }
    }

    await executeToolCalls(message, messages, searches, toolCalls);
  }

  throw new Error("Agent exceeded maximum tool-call rounds");
}

module.exports = { runAgent, runAgentStream };
