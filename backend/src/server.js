import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import argon2 from "argon2";
import pg from "pg";
import { isIP } from "node:net";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
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

const nodeHeartbeatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false
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

await pool.query("CREATE TABLE IF NOT EXISTS nodes (id BIGSERIAL PRIMARY KEY, name VARCHAR(60) NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE, enabled BOOLEAN NOT NULL DEFAULT TRUE, agent_version VARCHAR(40), last_seen_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");

await pool.query(`
  CREATE TABLE IF NOT EXISTS servers (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id BIGINT REFERENCES nodes(id) ON DELETE SET NULL,
    name VARCHAR(60) NOT NULL,
    game VARCHAR(30) NOT NULL DEFAULT 'Minecraft Java',
    software VARCHAR(20) NOT NULL DEFAULT 'Paper' CHECK (software IN ('Paper', 'Vanilla', 'Fabric')),
    version VARCHAR(20) NOT NULL DEFAULT '1.21.4',
    memory_mb INTEGER NOT NULL CHECK (memory_mb BETWEEN 512 AND 16384),
    disk_gb INTEGER NOT NULL CHECK (disk_gb BETWEEN 1 AND 200),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'not_connected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);


await pool.query(`
  CREATE TABLE IF NOT EXISTS server_runtime_status (
    server_id BIGINT PRIMARY KEY REFERENCES servers(id) ON DELETE CASCADE,
    node_id BIGINT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('installing', 'starting', 'running', 'stopping', 'stopped', 'error')),
    message VARCHAR(200),
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS server_activity_events (
    id BIGSERIAL PRIMARY KEY,
    server_id BIGINT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    node_id BIGINT REFERENCES nodes(id) ON DELETE SET NULL,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(24) NOT NULL CHECK (event_type IN ('runtime_status', 'power_request')),
    status VARCHAR(24) NOT NULL,
    message VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);
await pool.query("CREATE INDEX IF NOT EXISTS server_activity_events_server_id_id_idx ON server_activity_events(server_id, id DESC)");

await pool.query(`
  CREATE TABLE IF NOT EXISTS allocations (
    id BIGSERIAL PRIMARY KEY,
    node_id BIGINT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    ip VARCHAR(45) NOT NULL,
    port INTEGER NOT NULL CHECK (port BETWEEN 1024 AND 65535),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (node_id, ip, port)
  )
`);
await pool.query("ALTER TABLE servers ADD COLUMN IF NOT EXISTS allocation_id BIGINT REFERENCES allocations(id) ON DELETE SET NULL");
await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS servers_allocation_id_unique ON servers(allocation_id) WHERE allocation_id IS NOT NULL");
const hashNodeToken = (token) => createHash("sha256").update(token).digest("hex");

const requireNodeToken = async (req, res, next) => {
  try {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer (lmn_node_[A-Za-z0-9_-]{40,})$/);
    if (!match) return res.status(401).json({ error: "Node authentication required." });
    const result = await pool.query("SELECT id FROM nodes WHERE token_hash = $1 AND enabled = TRUE", [hashNodeToken(match[1])]);
    if (!result.rowCount) return res.status(401).json({ error: "Invalid node credentials." });
    req.nodeId = result.rows[0].id;
    next();
  } catch (error) { next(error); }
};

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      name: "Lumen Panel API",
      status: "online",
      database: "connected",
      version: "0.3.0",
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
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

app.get("/api/admin/nodes", requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, name, enabled, agent_version, last_seen_at, created_at,
        CASE WHEN enabled = FALSE THEN 'disabled'
          WHEN last_seen_at > NOW() - INTERVAL '90 seconds' THEN 'online' ELSE 'offline' END AS status,
        CASE WHEN last_seen_at IS NULL THEN NULL
          ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - last_seen_at))))::INTEGER END AS heartbeat_age_seconds
      FROM nodes ORDER BY created_at DESC
    `);
    res.json({ nodes: result.rows });
  } catch (error) { next(error); }
});

app.post("/api/admin/nodes", requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (name.length < 2 || name.length > 60) return res.status(400).json({ error: "Node name must be 2–60 characters." });
    const token = "lmn_node_" + randomBytes(36).toString("base64url");
    const result = await pool.query("INSERT INTO nodes (name, token_hash) VALUES ($1, $2) RETURNING id, name, enabled, created_at", [name, hashNodeToken(token)]);
    res.status(201).json({ node: { ...result.rows[0], status: "offline" }, token, token_notice: "Copy this token now. It is shown only once." });
  } catch (error) { next(error); }
});

app.post("/api/admin/nodes/:id/disable", requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid node ID." });
    const result = await pool.query("UPDATE nodes SET enabled = FALSE WHERE id = $1 RETURNING id, name, enabled", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Node not found." });
    res.json({ node: result.rows[0] });
  } catch (error) { next(error); }
});

app.post("/api/node/heartbeat", nodeHeartbeatLimiter, requireNodeToken, async (req, res, next) => {
  try {
    const agentVersion = typeof req.body.agentVersion === "string" ? req.body.agentVersion.trim().slice(0, 40) : null;
    await pool.query("UPDATE nodes SET last_seen_at = NOW(), agent_version = $1 WHERE id = $2 AND enabled = TRUE", [agentVersion || null, req.nodeId]);
    res.json({
      accepted: true,
      node_id: req.nodeId,
      next_heartbeat_seconds: 30,
      server_time: new Date().toISOString()
    });
  } catch (error) { next(error); }
});

// Node-reported lifecycle observations. These are informational only; this endpoint
// never executes a power action or provisions a Minecraft process.
app.post("/api/node/servers/:id/status", nodeHeartbeatLimiter, requireNodeToken, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid server ID." });
    const status = typeof req.body.status === "string" ? req.body.status : "";
    const allowedStatuses = ["installing", "starting", "running", "stopping", "stopped", "error"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Choose a valid runtime status." });
    }
    const message = typeof req.body.message === "string" ? req.body.message.trim().slice(0, 200) : null;
    const server = await pool.query(
      "SELECT id FROM servers WHERE id = $1 AND node_id = $2",
      [req.params.id, req.nodeId]
    );
    if (!server.rowCount) return res.status(404).json({ error: "Server is not assigned to this node." });
    const result = await pool.query(`
      INSERT INTO server_runtime_status (server_id, node_id, status, message, reported_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (server_id) DO UPDATE
      SET node_id = EXCLUDED.node_id, status = EXCLUDED.status,
          message = EXCLUDED.message, reported_at = NOW()
      RETURNING server_id, status, message, reported_at
    `, [req.params.id, req.nodeId, status, message || null]);
    await pool.query(
      "INSERT INTO server_activity_events (server_id, node_id, event_type, status, message) VALUES ($1, $2, 'runtime_status', $3, $4)",
      [req.params.id, req.nodeId, status, message || null]
    );
    res.json({ accepted: true, observation: result.rows[0], server_time: new Date().toISOString() });
  } catch (error) { next(error); }
});

app.get("/api/servers", requireAuth, async (req, res, next) => {
  try {
    const isAdmin = (await pool.query("SELECT role FROM users WHERE id = $1", [req.session.userId])).rows[0]?.role === "admin";
    const result = await pool.query(`
      SELECT s.id, s.name, s.game, s.software, s.version, s.memory_mb, s.disk_gb,
        s.status, s.created_at, s.node_id, s.allocation_id, a.ip AS allocation_ip, a.port AS allocation_port, n.name AS node_name,
        CASE WHEN n.id IS NULL THEN 'unassigned' WHEN n.enabled = FALSE THEN 'disabled'
          WHEN n.last_seen_at > NOW() - INTERVAL '90 seconds' THEN 'online' ELSE 'offline' END AS node_status,
        CASE WHEN rs.server_id IS NULL THEN 'not_reported'
          WHEN n.enabled = FALSE OR n.last_seen_at <= NOW() - INTERVAL '90 seconds' OR n.last_seen_at IS NULL THEN 'unavailable'
          ELSE rs.status END AS runtime_status,
        rs.message AS runtime_message, rs.reported_at AS runtime_reported_at
      FROM servers s
      LEFT JOIN nodes n ON n.id = s.node_id
      LEFT JOIN allocations a ON a.id = s.allocation_id
      LEFT JOIN server_runtime_status rs ON rs.server_id = s.id AND rs.node_id = s.node_id
      ${isAdmin ? "" : "WHERE s.owner_id = $1"}
      ORDER BY s.created_at DESC
    `, isAdmin ? [] : [req.session.userId]);
    res.json({ servers: result.rows });
  } catch (error) { next(error); }
});

app.get("/api/servers/:id/events", requireAuth, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid server ID." });
    const account = await pool.query("SELECT role FROM users WHERE id = $1", [req.session.userId]);
    const isAdmin = account.rows[0]?.role === "admin";
    const server = await pool.query(
      `SELECT id FROM servers WHERE id = $1 ${isAdmin ? "" : "AND owner_id = $2"}`,
      isAdmin ? [req.params.id] : [req.params.id, req.session.userId]
    );
    if (!server.rowCount) return res.status(404).json({ error: "Server not found." });
    const result = await pool.query(`
      SELECT e.id, e.event_type, e.status, e.message, e.created_at,
        n.name AS node_name,
        CASE WHEN e.actor_user_id IS NULL THEN NULL ELSE u.name END AS actor_name
      FROM server_activity_events e
      LEFT JOIN nodes n ON n.id = e.node_id
      LEFT JOIN users u ON u.id = e.actor_user_id
      WHERE e.server_id = $1
      ORDER BY e.id DESC
      LIMIT 50
    `, [req.params.id]);
    res.json({ events: result.rows, limit: 50 });
  } catch (error) { next(error); }
});

app.post("/api/servers", requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const software = ["Paper", "Vanilla", "Fabric"].includes(req.body.software) ? req.body.software : "";
    const version = typeof req.body.version === "string" ? req.body.version.trim() : "";
    const memoryMb = Number(req.body.memoryMb);
    const diskGb = Number(req.body.diskGb);
    const nodeId = req.body.nodeId === "" || req.body.nodeId == null ? null : Number(req.body.nodeId);
    if (name.length < 2 || name.length > 60) return res.status(400).json({ error: "Server name must be 2–60 characters." });
    if (!software) return res.status(400).json({ error: "Choose valid server software." });
    if (!/^[A-Za-z0-9._-]{1,20}$/.test(version)) return res.status(400).json({ error: "Enter a valid game version." });
    if (!Number.isInteger(memoryMb) || memoryMb < 512 || memoryMb > 16384) return res.status(400).json({ error: "Memory must be between 512 and 16384 MB." });
    if (!Number.isInteger(diskGb) || diskGb < 1 || diskGb > 200) return res.status(400).json({ error: "Storage must be between 1 and 200 GB." });
    if (nodeId !== null && (!Number.isSafeInteger(nodeId) || nodeId < 1)) return res.status(400).json({ error: "Choose a valid node." });
    if (nodeId !== null) {
      const node = await pool.query("SELECT id FROM nodes WHERE id = $1 AND enabled = TRUE", [nodeId]);
      if (!node.rowCount) return res.status(400).json({ error: "Selected node is unavailable." });
    }
    const result = await pool.query(`
      INSERT INTO servers (owner_id, node_id, name, software, version, memory_mb, disk_gb)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, game, software, version, memory_mb, disk_gb, status, created_at, node_id
    `, [req.session.userId, nodeId, name, software, version, memoryMb, diskGb]);
    res.status(201).json({ server: result.rows[0] });
  } catch (error) { next(error); }
});


app.get("/api/admin/allocations", requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.node_id, n.name AS node_name, a.ip, a.port, a.created_at,
        s.id AS server_id, s.name AS server_name
      FROM allocations a JOIN nodes n ON n.id = a.node_id
      LEFT JOIN servers s ON s.allocation_id = a.id
      ORDER BY n.name, a.port
    `);
    res.json({ allocations: result.rows });
  } catch (error) { next(error); }
});

app.post("/api/admin/allocations", requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const nodeId = Number(req.body.nodeId);
    const ip = typeof req.body.ip === "string" ? req.body.ip.trim() : "";
    const port = Number(req.body.port);
    if (!Number.isSafeInteger(nodeId) || nodeId < 1) return res.status(400).json({ error: "Choose a valid node." });
    if (!isIP(ip)) return res.status(400).json({ error: "Enter a valid IPv4 or IPv6 address." });
    if (!Number.isInteger(port) || port < 1024 || port > 65535) return res.status(400).json({ error: "Port must be between 1024 and 65535." });
    const node = await pool.query("SELECT id FROM nodes WHERE id = $1 AND enabled = TRUE", [nodeId]);
    if (!node.rowCount) return res.status(400).json({ error: "Selected node is unavailable." });
    const result = await pool.query(
      "INSERT INTO allocations (node_id, ip, port) VALUES ($1, $2, $3) RETURNING id, node_id, ip, port, created_at",
      [nodeId, ip, port]
    );
    res.status(201).json({ allocation: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "This IP and port already exists on that node." });
    next(error);
  }
});

app.post("/api/servers/:id/allocation", requireAdmin, requireCsrf, async (req, res, next) => {
  const client = await pool.connect();
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid server ID." });
    const serverId = Number(req.params.id);
    const allocationId = req.body.allocationId === "" || req.body.allocationId == null ? null : Number(req.body.allocationId);
    if (allocationId !== null && (!Number.isSafeInteger(allocationId) || allocationId < 1)) return res.status(400).json({ error: "Choose a valid allocation." });
    await client.query("BEGIN");
    const server = await client.query("SELECT id, node_id FROM servers WHERE id = $1 FOR UPDATE", [serverId]);
    if (!server.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Server not found." }); }
    if (allocationId !== null) {
      const allocation = await client.query("SELECT id, node_id FROM allocations WHERE id = $1 FOR UPDATE", [allocationId]);
      if (!allocation.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Allocation not found." }); }
      if (String(allocation.rows[0].node_id) !== String(server.rows[0].node_id)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Allocation must belong to the server's assigned node." });
      }
      const used = await client.query("SELECT id FROM servers WHERE allocation_id = $1 AND id <> $2", [allocationId, serverId]);
      if (used.rowCount) { await client.query("ROLLBACK"); return res.status(409).json({ error: "This allocation is already assigned." }); }
    }
    const updated = await client.query("UPDATE servers SET allocation_id = $1 WHERE id = $2 RETURNING id, allocation_id", [allocationId, serverId]);
    await client.query("COMMIT");
    res.json({ server: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
});

app.patch("/api/servers/:id/config", requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid server ID." });
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const software = ["Paper", "Vanilla", "Fabric"].includes(req.body.software) ? req.body.software : "";
    const version = typeof req.body.version === "string" ? req.body.version.trim() : "";
    const memoryMb = Number(req.body.memoryMb);
    const diskGb = Number(req.body.diskGb);
    if (name.length < 2 || name.length > 60) return res.status(400).json({ error: "Server name must be 2–60 characters." });
    if (!software || !/^[A-Za-z0-9._-]{1,20}$/.test(version)) return res.status(400).json({ error: "Choose valid software and game version." });
    if (!Number.isInteger(memoryMb) || memoryMb < 512 || memoryMb > 16384) return res.status(400).json({ error: "Memory must be between 512 and 16384 MB." });
    if (!Number.isInteger(diskGb) || diskGb < 1 || diskGb > 200) return res.status(400).json({ error: "Storage must be between 1 and 200 GB." });
    const result = await pool.query(
      "UPDATE servers SET name = $1, software = $2, version = $3, memory_mb = $4, disk_gb = $5 WHERE id = $6 RETURNING id, name, software, version, memory_mb, disk_gb",
      [name, software, version, memoryMb, diskGb, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Server not found." });
    res.json({ server: result.rows[0] });
  } catch (error) { next(error); }
});

app.post("/api/servers/:id/power", requireAuth, requireCsrf, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid server ID." });
    const action = typeof req.body.action === "string" ? req.body.action : "";
    if (!["start", "stop", "restart"].includes(action)) {
      return res.status(400).json({ error: "Choose a valid power action." });
    }
    const account = await pool.query("SELECT role FROM users WHERE id = $1", [req.session.userId]);
    const isAdmin = account.rows[0]?.role === "admin";
    const server = await pool.query(
      `SELECT id, owner_id, node_id FROM servers WHERE id = $1 ${isAdmin ? "" : "AND owner_id = $2"}`,
      isAdmin ? [req.params.id] : [req.params.id, req.session.userId]
    );
    if (!server.rowCount) return res.status(404).json({ error: "Server not found." });
    await pool.query(
      "INSERT INTO server_activity_events (server_id, actor_user_id, event_type, status, message) VALUES ($1, $2, 'power_request', $3, $4)",
      [req.params.id, req.session.userId, action, "Not executed: secure runtime is not connected."]
    );
    return res.status(503).json({
      error: "Power controls are unavailable because no secure Minecraft runtime is connected.",
      code: "RUNTIME_NOT_CONNECTED",
      action,
      executed: false
    });
  } catch (error) { next(error); }
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

app.get("/api/overview", requireAuth, async (req, res, next) => {
  try {
    const isAdmin = (await pool.query("SELECT role FROM users WHERE id = $1", [req.session.userId])).rows[0]?.role === "admin";
    const result = await pool.query(`
      SELECT s.id, s.name, s.game, s.software, s.version, s.memory_mb, s.disk_gb,
        s.status, s.created_at, s.node_id, n.name AS node_name
      FROM servers s LEFT JOIN nodes n ON n.id = s.node_id
      ${isAdmin ? "" : "WHERE s.owner_id = $1"}
      ORDER BY s.created_at DESC
    `, isAdmin ? [] : [req.session.userId]);
    res.json({ mode: "inventory", servers: result.rows, metrics: null });
  } catch (error) { next(error); }
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
