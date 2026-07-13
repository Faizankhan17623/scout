const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const connectDB = require("./config/db");
const conversationRoutes = require("./routes/conversationRoutes");

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api", conversationRoutes);

connectDB().then(() => {
  app.listen(env.port, () => {
    console.log(`Scout backend listening on port ${env.port}`);
  });
});
