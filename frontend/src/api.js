const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
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
async function streamRequest(path, message, onToken) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
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

export function createConversationStream(message, onToken) {
  return streamRequest("/conversations", message, onToken);
}

export function addMessageStream(id, message, onToken) {
  return streamRequest(`/conversations/${id}/messages`, message, onToken);
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
