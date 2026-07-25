const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const connectDB = require("./config/db");
const conversationRoutes = require("./routes/conversationRoutes");
const voiceRoutes = require("./routes/voiceRoutes");
const fileRoutes = require("./routes/fileRoutes");

const app = express();

app.use(cors({ origin: env.corsOrigin, allowedHeaders: ["Content-Type", "X-Session-Token"] }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api", conversationRoutes);
app.use("/api", voiceRoutes);
app.use("/api", fileRoutes);

connectDB().then(() => {
  app.listen(env.port, () => {
    console.log(`Scout backend listening on port ${env.port}`);
  });
});
