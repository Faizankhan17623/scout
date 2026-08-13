const axios = require("axios");

const JUDGE0_URL = "https://ce.judge0.com";
const MAX_OUTPUT_CHARS = 4000;
const TIMEOUT_MS = 20000;

// Judge0 identifies languages by numeric ID rather than name. Maps common
// aliases the model might use to the newest available runtime of each.
const LANGUAGE_IDS = {
  python: 113,
  python3: 113,
  py: 113,
  javascript: 102,
  js: 102,
  node: 102,
  nodejs: 102,
  typescript: 101,
  ts: 101,
  go: 107,
  golang: 107,
  java: 91,
  "c++": 105,
  cpp: 105,
  c: 50,
  "c#": 51,
  csharp: 51,
  ruby: 72,
  rust: 108,
  php: 98,
  bash: 46,
  shell: 46,
  sh: 46,
};

function truncate(text) {
  if (!text) return "";
  return text.length > MAX_OUTPUT_CHARS
    ? `${text.slice(0, MAX_OUTPUT_CHARS)}\n… (output truncated)`
    : text;
}

// Models occasionally pass their own displayed ```lang fence (including the
// backtick lines) as the code argument instead of just the source inside it.
// Strip a wrapping fence if present so execution doesn't fail on stray
// backticks the user never wrote.
function stripCodeFence(code) {
  const fenced = String(code).trim().match(/^```[\w+-]*\n([\s\S]*?)\n?```$/);
  return fenced ? fenced[1] : code;
}

async function runCode(language, code) {
  const languageId = LANGUAGE_IDS[String(language || "").trim().toLowerCase()];
  if (!languageId) {
    throw new Error(
      `Unsupported language "${language}". Supported: ${Object.keys(LANGUAGE_IDS).join(", ")}.`
    );
  }

  const source = stripCodeFence(code);

  let data;
  try {
    ({ data } = await axios.post(
      `${JUDGE0_URL}/submissions/?base64_encoded=false&wait=true`,
      { source_code: source, language_id: languageId },
      { timeout: TIMEOUT_MS, headers: { "Content-Type": "application/json" } }
    ));
  } catch (err) {
    if (err.response?.status === 429) {
      throw new Error("Code execution sandbox rate limit hit — try again in a moment.");
    }
    if (err.code === "ECONNABORTED") {
      throw new Error("Code execution timed out — the public sandbox may be under load.");
    }
    throw new Error("Couldn't reach the code execution sandbox — try again in a moment.");
  }

  return {
    language,
    code: source,
    stdout: truncate(data.stdout),
    stderr: truncate(data.stderr || data.compile_output),
    exitCode: data.status?.id === 3 ? 0 : data.status?.id ?? null,
    status: data.status?.description || "Unknown",
  };
}

module.exports = { runCode };
