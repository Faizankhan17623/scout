const {
  verifyAdminCredentials,
  issueToken,
  getSummary,
  getVisits,
  getActivity,
} = require("../services/adminService");

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const admin = await verifyAdminCredentials(email, password);
    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = issueToken(admin);
    return res.json({ token });
  } catch (err) {
    console.error("Admin login error:", err.message);
    return res.status(500).json({ error: "Login failed" });
  }
}

async function summary(req, res) {
  try {
    const data = await getSummary();
    return res.json(data);
  } catch (err) {
    console.error("Admin summary error:", err.message);
    return res.status(500).json({ error: "Failed to load summary" });
  }
}

async function visits(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const data = await getVisits({ page, limit });
    return res.json(data);
  } catch (err) {
    console.error("Admin visits error:", err.message);
    return res.status(500).json({ error: "Failed to load visits" });
  }
}

async function activity(req, res) {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
    const data = await getActivity({ days });
    return res.json({ activity: data });
  } catch (err) {
    console.error("Admin activity error:", err.message);
    return res.status(500).json({ error: "Failed to load activity" });
  }
}

module.exports = { login, summary, visits, activity };
