import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

app.disable("x-powered-by");
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

app.get("/api/overview", (_req, res) => {
  res.json({
    mode: "demo",
    nodes: [{ id: "local-dev", name: "Local development", status: "not_connected" }],
    servers: [{
      id: "lumen-smp",
      name: "Lumen SMP",
      game: "Minecraft Java",
      software: "Paper",
      version: "1.21.x",
      status: "demo",
      players: { online: 0, limit: 10 },
      resources: {
        cpuPercent: 12.4,
        memoryMb: 2150,
        memoryLimitMb: 5120,
        diskMb: 8806,
        diskLimitMb: 30720
      }
    }]
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Lumen Panel API listening on 0.0.0.0:${port}`);
  console.log(`Allowed frontend origin: ${allowedOrigin}`);
});
