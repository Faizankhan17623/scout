const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const ADMIN_TOKEN_KEY = "scout-admin-token";

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function adminRequest(path, options = {}) {
  const res = await fetch(`${API_URL}/admin${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(getAdminToken() ? { Authorization: `Bearer ${getAdminToken()}` } : {}),
    },
    ...options,
  });

  if (res.status === 401) {
    clearAdminToken();
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

export async function adminLogin(email, password) {
  const data = await adminRequest("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAdminToken(data.token);
  return data.token;
}

export function getSummary() {
  return adminRequest("/summary");
}

export function getVisits(page = 1, limit = 50) {
  return adminRequest(`/visits?page=${page}&limit=${limit}`);
}

export function getUniqueIps(page = 1, limit = 50) {
  return adminRequest(`/ips?page=${page}&limit=${limit}`);
}

export function getActivity(days = 14) {
  return adminRequest(`/activity?days=${days}`);
}
