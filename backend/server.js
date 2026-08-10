const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const connectDB = require("./config/db");
const conversationRoutes = require("./routes/conversationRoutes");
const voiceRoutes = require("./routes/voiceRoutes");
const fileRoutes = require("./routes/fileRoutes");
const adminRoutes = require("./routes/adminRoutes");
const trackVisit = require("./middleware/trackVisit");

const app = express();

app.set("trust proxy", 1);

app.use(cors({ origin: env.corsOrigin, allowedHeaders: ["Content-Type", "X-Session-Token", "Authorization"] }));
app.use(express.json());
app.use(trackVisit);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api", conversationRoutes);
app.use("/api", voiceRoutes);
app.use("/api", fileRoutes);
app.use("/api/admin", adminRoutes);

connectDB().then(() => {
  app.listen(env.port, () => {
    console.log(`Scout backend listening on port ${env.port}`);
  });
});
