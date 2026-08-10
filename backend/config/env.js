require("dotenv").config();

const env = {
  port: process.env.PORT || 5000,
  llmApiKey: process.env.GROQ_API_KEY || "",
  llmModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
  jinaApiKey: process.env.JINA_API_KEY || "",
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/agnet",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "",
  adminTokenTtl: process.env.ADMIN_TOKEN_TTL || "7d",
};

module.exports = env;
