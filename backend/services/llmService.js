const axios = require("axios");
const env = require("../config/env");
const { webSearch } = require("./tavilyService");
const { getWeather } = require("./weatherService");
const { generateImage } = require("./imageGenService");
const { wikipediaLookup } = require("./wikipediaService");
const { readPage } = require("./readerService");
const { summarizeRepo } = require("./githubRepoService");
const { runCode } = require("./codeExecService");

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
  {
    type: "function",
    function: {
      name: "explain_github_repo",
      description:
        "Fetch and explain a GitHub repository's purpose, architecture, and structure from its URL. Use when the user shares a GitHub link and wants to know what the project is/does.",
      parameters: {
        type: "object",
        properties: {
          repoUrl: {
            type: "string",
            description: "The GitHub repository URL or owner/repo shorthand.",
          },
        },
        required: ["repoUrl"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_code",
      description:
        "Execute a code snippet in a sandbox and return its real stdout/stderr. Use for math, data processing, or verifying that code actually works, rather than guessing the output.",
      parameters: {
        type: "object",
        properties: {
          language: {
            type: "string",
            description: "The programming language to run the code in, e.g. 'python', 'javascript', 'go'.",
          },
          code: {
            type: "string",
            description:
              "The raw source code to execute — plain code only, with NO surrounding ``` markdown fence and no language tag line.",
          },
        },
        required: ["language", "code"],
      },
    },
  },
];

async function callLLM(messages, activeTools) {
  const { data } = await axios.post(
    GROQ_URL,
    {
      model: env.llmModel,
      messages,
      tools: activeTools,
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

// Some models occasionally hallucinate a tool call as plain text instead of
// using the structured tool_calls delta — e.g. a full call like
// `<get_weather>{"location": "Pune"}"</function>`, or just a stray leftover
// tag like `</read_page>` with nothing else in the reply. Both are scoped to
// the actual registered tool names (plus the generic "function" tag) only,
// so this never touches unrelated angle-bracket content like HTML/JSX in a
// code answer.
const TOOL_NAMES = tools.map((t) => t.function.name).join("|");
const TAG_NAMES = `${TOOL_NAMES}|function`;
const FAKE_TOOL_CALL_PATTERN = new RegExp(
  `<\\|?/?(?:${TOOL_NAMES})\\|?>\\s*\\{[^{}]*\\}\\s*"?\\s*(?:<\\/?function>)?` + // full call
    `|<\\|?/?(?:${TAG_NAMES})\\|?>`, // bare open/close tag left over
  "gi"
);

function stripFakeToolCallSyntax(text) {
  return text.replace(FAKE_TOOL_CALL_PATTERN, "").trim();
}

async function streamLLM(messages, onToken, activeTools) {
  let response;
  try {
    response = await axios.post(
      GROQ_URL,
      {
        model: env.llmModel,
        messages,
        tools: activeTools,
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
  // Content is held back until the stream ends rather than forwarded
  // token-by-token, so a hallucinated tool-call string never reaches the
  // UI even mid-stream. This trades true incremental streaming for
  // correctness — see runAgentStream, which fakes token pacing on replay.
  const rawTokens = [];

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
          rawTokens.push(delta.content);
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

  const cleaned = stripFakeToolCallSyntax(content);

  if (cleaned) {
    // Replay as chunks so the UI still gets a streaming feel, now that the
    // full text is known to be safe to show.
    for (const chunk of cleaned.match(/.{1,12}/gs) || []) {
      onToken(chunk);
    }
  }

  return {
    role: "assistant",
    content: cleaned || null,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

const SYSTEM_PROMPT =
  "You are a helpful agent with access to tools: web_search (live web search), get_weather (current + 3-day forecast), generate_image (text-to-image), wikipedia_lookup (encyclopedic summaries), read_page (fetch the full text of a specific URL), explain_github_repo (fetch a GitHub repo's metadata, README, file tree, and key source files), and run_code (execute a code snippet in a sandbox and return real stdout/stderr). Use web_search for current or factual information you're not certain about, and cite sources briefly. Use get_weather for weather questions, wikipedia_lookup for well-established factual/biographical topics, generate_image when asked to create or draw something, and read_page when you need the full content of a specific link rather than just a search snippet. Use explain_github_repo whenever the user shares a GitHub link and wants to understand the project — then give a real architectural explanation covering the project's purpose, its structure (main folders/modules), key entry points, and notable dependencies or frameworks, not just a one-line restatement of the description. If the tool result has no README, base the explanation on the file tree and the key source files it fetched instead. Always write code in a fenced Markdown code block with the correct language tag (e.g. ```python). Use run_code when the user wants code actually executed or its real output verified (e.g. a computed result, or 'run this and show me') — not for every code snippet you write, only when execution is needed or explicitly requested. If run_code returns an error because the sandbox is unavailable, just say briefly that execution isn't available right now and give the code as a normal code block — do not fabricate compiler/terminal commands to work around it. When you call generate_image, the image is already generated and will be shown to the user automatically by the app — just give a short, confident reply (e.g. \"Here's your image.\"). Never say the image URL might not load, might take time, or needs to be visited manually — the UI already handles displaying it. If the user's message includes an 'Attached file:' section, answer directly from that content — it is the full document, already provided to you.";

const DEEP_RESEARCH_SUFFIX =
  " Deep research mode is ON: this question needs a thorough answer. Before answering, use web_search multiple times with different, complementary queries to cover the topic from several angles, and use read_page on the most promising results to get full context rather than relying on snippets alone. Then produce a well-organized, structured report with headings and a brief summary of sources — not a short answer.";

function buildMessages(history, { deepResearch = false } = {}) {
  return [
    { role: "system", content: deepResearch ? SYSTEM_PROMPT + DEEP_RESEARCH_SUFFIX : SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
}

// The small/fast models used here don't reliably follow a prompt-only
// instruction to skip search tools when a file is attached (observed:
// searching the web anyway, or inventing a fake read_page call for the
// file). Actually removing the retrieval tools from the request when the
// latest user message carries attached-file content is the only fix that
// held up under repeated testing — generate_image stays available since
// it's unrelated to information retrieval.
const RETRIEVAL_TOOL_NAMES = new Set(["web_search", "wikipedia_lookup", "read_page", "explain_github_repo"]);
const toolsWithoutRetrieval = tools.filter((t) => !RETRIEVAL_TOOL_NAMES.has(t.function.name));

function toolsFor(history) {
  const latestUserMessage = [...history].reverse().find((m) => m.role === "user");
  const hasAttachedFile = latestUserMessage?.content?.includes("\nAttached file:");
  return hasAttachedFile ? toolsWithoutRetrieval : tools;
}

const MAX_TOOL_ROUNDS = 5;
const MAX_TOOL_ROUNDS_DEEP = 10;

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

  if (name === "explain_github_repo") {
    const repo = await summarizeRepo(args.repoUrl);
    return { kind: "github_repo", data: repo, forLLM: repo };
  }

  if (name === "run_code") {
    const run = await runCode(args.language, args.code);
    return { kind: "code_exec", data: run, forLLM: run };
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
async function runAgent(history, { deepResearch = false } = {}) {
  const messages = buildMessages(history, { deepResearch });
  const activeTools = toolsFor(history);
  const searches = [];
  const toolCalls = [];
  const maxRounds = deepResearch ? MAX_TOOL_ROUNDS_DEEP : MAX_TOOL_ROUNDS;

  for (let round = 0; round < maxRounds; round += 1) {
    let message = await callLLM(messages, activeTools);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      if (!message.content) {
        message = await callLLM(messages, activeTools);
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
async function runAgentStream(history, onToken, { deepResearch = false } = {}) {
  const messages = buildMessages(history, { deepResearch });
  const activeTools = toolsFor(history);
  const searches = [];
  const toolCalls = [];
  const maxRounds = deepResearch ? MAX_TOOL_ROUNDS_DEEP : MAX_TOOL_ROUNDS;

  for (let round = 0; round < maxRounds; round += 1) {
    let message = await streamLLM(messages, onToken, activeTools);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      if (!message.content) {
        message = await streamLLM(messages, onToken, activeTools);
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

// Produces a short, human-friendly conversation title from the first
// exchange. Runs without tools (single quick completion) and is best-effort
// — callers should fall back to a truncated title if this fails.
async function generateTitle(userMessage, assistantResponse) {
  try {
    const { data } = await axios.post(
      GROQ_URL,
      {
        model: env.llmModel,
        messages: [
          {
            role: "system",
            content:
              "Write a short conversation title (max 6 words, no quotes, no trailing period) summarizing the topic of this exchange. Reply with only the title.",
          },
          { role: "user", content: `User: ${userMessage}\nAssistant: ${(assistantResponse || "").slice(0, 500)}` },
        ],
        max_tokens: 20,
      },
      {
        headers: {
          Authorization: `Bearer ${env.llmApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const title = data.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, "");
    return title || null;
  } catch {
    return null;
  }
}

// Suggests 2-3 short follow-up questions a user might ask next, based on
// the latest exchange. Best-effort — callers should treat a failure as
// "no suggestions" rather than surfacing an error.
async function generateFollowUps(userMessage, assistantResponse) {
  try {
    const { data } = await axios.post(
      GROQ_URL,
      {
        model: env.llmModel,
        messages: [
          {
            role: "system",
            content:
              'Suggest 2-3 short, natural follow-up questions the user might ask next, based on this exchange. Reply with ONLY a JSON object of the exact shape {"questions": ["question one", "question two"]}. No other text.',
          },
          { role: "user", content: `User: ${userMessage}\nAssistant: ${(assistantResponse || "").slice(0, 800)}` },
        ],
        max_tokens: 150,
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${env.llmApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const raw = data.choices[0]?.message?.content;
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : Object.values(parsed).find((v) => Array.isArray(v));
    if (!Array.isArray(list)) return [];

    return list.filter((q) => typeof q === "string" && q.trim()).slice(0, 3);
  } catch {
    return [];
  }
}

module.exports = { runAgent, runAgentStream, generateTitle, generateFollowUps };
