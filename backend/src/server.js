import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import argon2 from "argon2";
import pg from "pg";
import { randomBytes, timingSafeEqual } from "node:crypto";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
const isProduction = process.env.NODE_ENV === "production";
const databaseUrl = process.env.DATABASE_URL;
const sessionSecret = process.env.SESSION_SECRET;

if (!databaseUrl) throw new Error("DATABASE_URL is required. Configure PostgreSQL before starting the API.");
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET is required and must be at least 32 characters.");
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
});

const PgSession = connectPgSimple(session);
const sessionStore = new PgSession({
  pool,
  tableName: "user_sessions",
  createTableIfMissing: true
});

app.disable("x-powered-by");
if (isProduction) app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: "16kb" }));
app.use(session({
  name: "lumen.sid",
  store: sessionStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Try again later." }
});

const csrfMatches = (expected, supplied) => {
  if (typeof expected !== "string" || typeof supplied !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
};

const requireCsrf = (req, res, next) => {
  if (!csrfMatches(req.session.csrfToken, req.get("x-csrf-token"))) {
    return res.status(403).json({ error: "Security token missing or expired. Refresh and try again." });
  }
  next();
};

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Authentication required." });
  next();
};

const requireAdmin = async (req, res, next) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: "Authentication required." });
    const result = await pool.query("SELECT role FROM users WHERE id = $1", [req.session.userId]);
    if (!result.rowCount || result.rows[0].role !== "admin") {
      return res.status(403).json({ error: "Administrator access required." });
    }
    next();
  } catch (error) {
    next(error);
  }
};

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(60) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      name: "Lumen Panel API",
      status: "online",
      database: "connected",
      version: "0.2.0",
      timestamp: new Date().toISOString()
    });
  } catch {
    res.status(503).json({ name: "Lumen Panel API", status: "degraded", database: "offline" });
  }
});

app.get("/api/auth/csrf", (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString("hex");
  res.json({ csrfToken: req.session.csrfToken });
});

app.post("/api/auth/register", authLimiter, requireCsrf, async (req, res, next) => {
  try {
    if (process.env.ALLOW_REGISTRATION !== "true") {
      return res.status(403).json({ error: "Registration is currently closed." });
    }
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (name.length < 2 || name.length > 60) return res.status(400).json({ error: "Name must be 2–60 characters." });
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (password.length < 12 || password.length > 128) {
      return res.status(400).json({ error: "Password must be 12–128 characters." });
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role",
      [name, email, passwordHash]
    );
    const user = result.rows[0];
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.userId = user.id;
      req.session.csrfToken = randomBytes(32).toString("hex");
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.status(201).json({ user: publicUser(user), csrfToken: req.session.csrfToken });
      });
    });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "An account with this email already exists." });
    next(error);
  }
});

app.post("/api/auth/login", authLimiter, requireCsrf, async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const result = await pool.query(
      "SELECT id, name, email, role, password_hash FROM users WHERE email = $1",
      [email]
    );
    const user = result.rows[0];
    const valid = user && password.length <= 128
      ? await argon2.verify(user.password_hash, password).catch(() => false)
      : false;
    if (!valid) return res.status(401).json({ error: "Email or password is incorrect." });

    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.userId = user.id;
      req.session.csrfToken = randomBytes(32).toString("hex");
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.json({ user: publicUser(user), csrfToken: req.session.csrfToken });
      });
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", async (req, res, next) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: "Not signed in." });
    const result = await pool.query(
      "SELECT id, name, email, role FROM users WHERE id = $1",
      [req.session.userId]
    );
    if (!result.rowCount) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Session is no longer valid." });
    }
    res.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", requireAuth, requireCsrf, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("lumen.sid", { httpOnly: true, secure: isProduction, sameSite: "lax" });
    res.status(204).end();
  });
});

app.get("/api/admin/users", requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 100"
    );
    res.json({ users: result.rows });
  } catch (error) {
    next(error);
  }
});

app.get("/api/overview", requireAuth, (_req, res) => {
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

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
app.use((error, _req, res, _next) => {
  console.error("API error:", error.message);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Lumen Panel API listening on 0.0.0.0:${port}`);
  console.log("PostgreSQL connected; session cookies enabled.");
});
