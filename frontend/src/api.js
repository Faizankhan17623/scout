const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const SESSION_TOKEN_KEY = "scout-session-token";
const SESSION_EXPIRY_KEY = "scout-session-expiry";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// A random per-browser token that lets a returning visitor see their own
// conversation history without any login — reissued if the previous one
// expired, refreshed on every use so an active user's window keeps sliding.
export function getSessionToken() {
  const expiry = Number(localStorage.getItem(SESSION_EXPIRY_KEY));
  const existing = localStorage.getItem(SESSION_TOKEN_KEY);

  if (existing && expiry && Date.now() < expiry) {
    localStorage.setItem(SESSION_EXPIRY_KEY, String(Date.now() + SESSION_TTL_MS));
    return existing;
  }

  const token =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(SESSION_TOKEN_KEY, token);
  localStorage.setItem(SESSION_EXPIRY_KEY, String(Date.now() + SESSION_TTL_MS));
  return token;
}

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", "X-Session-Token": getSessionToken() },
    ...options,
  });

  if (res.status === 204) {
    return null;
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

export function listConversations() {
  return request("/conversations");
}

export function getConversation(id) {
  return request(`/conversations/${id}`);
}

export function createConversation(message) {
  return request("/conversations", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function addMessage(id, message) {
  return request(`/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function deleteConversation(id) {
  return request(`/conversations/${id}`, { method: "DELETE" });
}

// Streams a conversation create/append via SSE. Calls onToken for each
// text chunk as it arrives, and resolves with the final conversation once
// the "done" event is received. Throws if the server sends an "error" event
// or the request itself fails.
async function streamRequest(path, message, onToken, { method = "POST", deepResearch = false } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Session-Token": getSessionToken() },
    body: JSON.stringify({ message, deepResearch }),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Something went wrong");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop();

    for (const raw of events) {
      const lines = raw.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!eventLine || !dataLine) continue;

      const eventName = eventLine.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim());

      if (eventName === "token") {
        onToken(data.token);
      } else if (eventName === "done") {
        return data.conversation;
      } else if (eventName === "error") {
        throw new Error(data.error || "Something went wrong");
      }
    }
  }

  throw new Error("Stream ended unexpectedly");
}

export function createConversationStream(message, onToken, deepResearch) {
  return streamRequest("/conversations", message, onToken, { deepResearch });
}

export function addMessageStream(id, message, onToken, deepResearch) {
  return streamRequest(`/conversations/${id}/messages`, message, onToken, { deepResearch });
}

export function editMessageStream(id, index, message, onToken) {
  return streamRequest(`/conversations/${id}/messages/${index}`, message, onToken, { method: "PUT" });
}

export async function extractFileText(file) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_URL}/files/extract`, {
    method: "POST",
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to read file");
  }
  return data;
}

export async function transcribeAudio(blob) {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");

  const res = await fetch(`${API_URL}/voice/transcribe`, {
    method: "POST",
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to transcribe audio");
  }
  return data.text;
}

export async function speakText(text) {
  const res = await fetch(`${API_URL}/voice/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to synthesize speech");
  }
  return res.blob();
}
