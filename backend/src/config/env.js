require("dotenv").config();

const env = {
  port: process.env.PORT || 5000,
  llmApiKey: process.env.GROQ_API_KEY || "",
  llmModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/agnet",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};

module.exports = env;
