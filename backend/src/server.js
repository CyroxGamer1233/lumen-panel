import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(helmet());
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    name: "Lumen Panel API",
    status: "online",
    version: "0.1.0",
    timestamp: new Date().toISOString()
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Lumen Panel API listening on port ${port}`);
});
