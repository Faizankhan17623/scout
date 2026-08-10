const Visit = require("../models/Visit");

const SKIP_PREFIXES = ["/api/health", "/api/admin"];

function trackVisit(req, res, next) {
  const shouldSkip = SKIP_PREFIXES.some((prefix) => req.path.startsWith(prefix));

  if (!shouldSkip) {
    Visit.create({
      ip: req.ip || "",
      sessionToken: req.header("X-Session-Token") || null,
      path: req.path,
      method: req.method,
      userAgent: req.header("User-Agent") || "",
    }).catch((err) => console.error("Visit tracking error:", err.message));
  }

  next();
}

module.exports = trackVisit;
