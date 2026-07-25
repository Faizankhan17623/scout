const pdfParse = require("pdf-parse");

const MAX_EXTRACTED_CHARS = 12000;

const SUPPORTED_TYPES = new Set(["application/pdf", "text/plain", "text/markdown", "text/csv"]);

async function extractText(file) {
  if (!SUPPORTED_TYPES.has(file.mimetype) && !file.mimetype.startsWith("text/")) {
    throw new Error(
      `Unsupported file type "${file.mimetype}". Only PDF and plain text files are supported right now.`
    );
  }

  let text;
  if (file.mimetype === "application/pdf") {
    const parsed = await pdfParse(file.buffer);
    text = parsed.text;
  } else {
    text = file.buffer.toString("utf8");
  }

  text = text.trim();
  if (!text) {
    throw new Error("No readable text was found in this file.");
  }

  return {
    filename: file.originalname,
    content: text.slice(0, MAX_EXTRACTED_CHARS),
    truncated: text.length > MAX_EXTRACTED_CHARS,
  };
}

module.exports = { extractText };
