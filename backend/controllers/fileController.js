const { extractText } = require("../services/fileService");

async function extract(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "file is required" });
  }

  try {
    const result = await extractText(req.file);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

module.exports = { extract };
