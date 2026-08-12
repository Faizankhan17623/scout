const axios = require("axios");
const env = require("../config/env");

const API_URL = "https://api.github.com";

const REPO_URL_PATTERN = /^(?:https?:\/\/(?:www\.)?github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/.*)?\/?$/;

// Manifest/config files that hint at what a project is and how it's run.
const MANIFEST_NAMES = new Set([
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "go.mod",
  "cargo.toml",
  "pom.xml",
  "composer.json",
]);

// Common entry-point basenames (extension-agnostic), matched at the repo
// root or one folder deep (e.g. "backend/server.js").
const ENTRY_BASENAMES = new Set(["main", "index", "app", "server"]);

const MAX_KEY_FILES = 8;
const MAX_FILE_BYTES = 6000;
const MAX_TREE_ENTRIES = 300;

function parseRepoUrl(input) {
  const match = String(input || "").trim().match(REPO_URL_PATTERN);
  if (!match) {
    throw new Error(`"${input}" doesn't look like a GitHub repo URL or owner/repo.`);
  }
  return { owner: match[1], repo: match[2] };
}

function authHeaders() {
  const headers = { Accept: "application/vnd.github+json" };
  if (env.githubToken) {
    headers.Authorization = `Bearer ${env.githubToken}`;
  }
  return headers;
}

async function githubGet(path, config) {
  try {
    return await axios.get(`${API_URL}${path}`, { headers: authHeaders(), ...config });
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) {
      throw new Error("That GitHub repository doesn't exist or is private.");
    }
    if (status === 403 && err.response?.headers?.["x-ratelimit-remaining"] === "0") {
      throw new Error(
        "GitHub API rate limit hit (60 requests/hour without a token). Set GITHUB_TOKEN to raise it to 5,000/hour."
      );
    }
    throw err;
  }
}

function pickKeyFilePaths(fileTree) {
  const manifests = [];
  const entries = [];

  for (const path of fileTree) {
    const depth = path.split("/").length;
    const basename = path.split("/").pop();
    const lower = basename.toLowerCase();

    if (depth <= 2 && MANIFEST_NAMES.has(lower)) {
      manifests.push(path);
      continue;
    }

    if (depth <= 2) {
      const stem = lower.replace(/\.[^.]+$/, "");
      if (ENTRY_BASENAMES.has(stem)) {
        entries.push(path);
      }
    }
  }

  return [...manifests, ...entries].slice(0, MAX_KEY_FILES);
}

async function fetchFileContent(owner, repo, path) {
  const { data } = await githubGet(`/repos/${owner}/${repo}/contents/${path}`);
  if (data.encoding !== "base64" || !data.content) return null;
  const content = Buffer.from(data.content, "base64").toString("utf8");
  return { path, content: content.slice(0, MAX_FILE_BYTES) };
}

async function summarizeRepo(repoUrl) {
  const { owner, repo } = parseRepoUrl(repoUrl);

  const { data: meta } = await githubGet(`/repos/${owner}/${repo}`);
  const defaultBranch = meta.default_branch || "main";

  const { data: treeData } = await githubGet(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(defaultBranch)}`,
    { params: { recursive: 1 } }
  );
  const fileTree = (treeData.tree || [])
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path);

  let readme = null;
  try {
    const { data: readmeData } = await githubGet(`/repos/${owner}/${repo}/readme`);
    if (readmeData.encoding === "base64" && readmeData.content) {
      readme = Buffer.from(readmeData.content, "base64").toString("utf8").slice(0, MAX_FILE_BYTES);
    }
  } catch {
    readme = null; // No README — the key-file fallback below covers this.
  }

  const keyFilePaths = pickKeyFilePaths(fileTree);
  const keyFileResults = await Promise.all(
    keyFilePaths.map((path) => fetchFileContent(owner, repo, path).catch(() => null))
  );
  const keyFiles = keyFileResults.filter(Boolean);

  return {
    owner: meta.owner?.login || owner,
    repo: meta.name || repo,
    url: meta.html_url || `https://github.com/${owner}/${repo}`,
    description: meta.description || null,
    stars: meta.stargazers_count ?? 0,
    language: meta.language || null,
    topics: meta.topics || [],
    defaultBranch,
    readme,
    fileTree: fileTree.slice(0, MAX_TREE_ENTRIES),
    keyFiles,
  };
}

module.exports = { summarizeRepo };
