const express = require("express");
const rateLimit = require("express-rate-limit");
const { login, summary, visits, uniqueIps, activity } = require("../controllers/adminController");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
});

router.post("/login", loginLimiter, login);
router.get("/summary", requireAdmin, summary);
router.get("/visits", requireAdmin, visits);
router.get("/ips", requireAdmin, uniqueIps);
router.get("/activity", requireAdmin, activity);

module.exports = router;
