const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
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
