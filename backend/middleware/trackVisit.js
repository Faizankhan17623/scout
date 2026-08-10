const Visit = require("../models/Visit");

const SKIP_PREFIXES = ["/api/health", "/api/admin"];

// The X-Forwarded-For chain is "client, proxy1, proxy2, ...", so the first
// entry is always the original client regardless of how many proxy hops
// (Render's load balancer, etc.) sit in front of the app. req.ip depends on
// Express's trust-proxy hop count matching the real proxy count exactly,
// which is fragile — reading the header directly avoids that mismatch.
function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || "";
}

function trackVisit(req, res, next) {
  const shouldSkip = SKIP_PREFIXES.some((prefix) => req.path.startsWith(prefix));

  if (!shouldSkip) {
    Visit.create({
      ip: clientIp(req),
      sessionToken: req.header("X-Session-Token") || null,
      path: req.path,
      method: req.method,
      userAgent: req.header("User-Agent") || "",
    }).catch((err) => console.error("Visit tracking error:", err.message));
  }

  next();
}

module.exports = trackVisit;
