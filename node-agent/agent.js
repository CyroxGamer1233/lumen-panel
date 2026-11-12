import process from "node:process";
import os from "node:os";

const token = process.env.LUMEN_NODE_TOKEN;
const panelUrl = (process.env.LUMEN_PANEL_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const version = process.env.LUMEN_AGENT_VERSION || "0.1.0";
const baseIntervalMs = 30_000;
const maxRetryMs = 5 * 60_000;
let sleepTimer = null;
let wakeSleep = null;

if (!token || !/^lmn_node_[A-Za-z0-9_-]{40,}$/.test(token)) {
  console.error("Missing or invalid LUMEN_NODE_TOKEN. Set it in node-agent/.env.");
  process.exit(1);
}

let target;
try {
  target = new URL(panelUrl);
} catch {
  console.error("LUMEN_PANEL_URL must be a valid URL.");
  process.exit(1);
}

// This development agent intentionally only talks to the API on this Codespace.
if (!["127.0.0.1", "localhost"].includes(target.hostname)) {
  console.error("For this Codespaces-only milestone, LUMEN_PANEL_URL must use localhost or 127.0.0.1.");
  process.exit(1);
}

const heartbeatUrl = `${panelUrl}/api/node/heartbeat`;
const eventsUrl = `${panelUrl}/api/node/events`;
const healthUrl = `${panelUrl}/api/node/health`;
const metricsUrl = `${panelUrl}/api/node/metrics`;
let previousCpuSnapshot = null;
let stopping = false;
let consecutiveFailures = 0;
let lastErrorMessage = null;

async function reportEvent(eventType, message) {
  try {
    const response = await fetch(eventsUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ eventType, message }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error(`[Lumen Agent] Event report rejected: HTTP ${response.status} — ${body.error || "request failed"}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[Lumen Agent] Event report unavailable: ${error.message}`);
    return false;
  }
}

async function reportHealth(status, message = null) {
  try {
    const response = await fetch(healthUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status,
        consecutiveFailures,
        message: message ? String(message).slice(0, 200) : null
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error(`[Lumen Agent] Health report rejected: HTTP ${response.status} — ${body.error || "request failed"}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[Lumen Agent] Health report unavailable: ${error.message}`);
    return false;
  }
}


function readCpuSnapshot() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    const times = cpu.times;
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.idle + times.irq;
  }
  return { idle, total };
}

function readCpuUsagePercent() {
  const current = readCpuSnapshot();
  const previous = previousCpuSnapshot;
  previousCpuSnapshot = current;
  if (!previous) return null;
  const totalDelta = current.total - previous.total;
  const idleDelta = current.idle - previous.idle;
  if (totalDelta <= 0) return null;
  return Math.round(Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100)) * 10) / 10;
}

async function reportMetrics() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsed = Math.max(0, totalMemory - freeMemory);
  const rss = process.memoryUsage().rss;
  const payload = {
    cpuUsagePercent: readCpuUsagePercent(),
    memoryTotalBytes: totalMemory,
    memoryUsedBytes: memoryUsed,
    uptimeSeconds: Math.floor(os.uptime()),
    processRssBytes: rss,
    load1m: Number(os.loadavg()[0].toFixed(2))
  };
  try {
    const response = await fetch(metricsUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error(`[Lumen Agent] Metrics report rejected: HTTP ${response.status} — ${body.error || "request failed"}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[Lumen Agent] Metrics report unavailable: ${error.message}`);
    return false;
  }
}

async function heartbeat() {
  try {
    const response = await fetch(heartbeatUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ agentVersion: version }),
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      consecutiveFailures = Math.min(1000, consecutiveFailures + 1);
      lastErrorMessage = `Heartbeat rejected (HTTP ${response.status}): ${body.error || "request failed"}`.slice(0, 200);
      console.error(`[Lumen Agent] ${lastErrorMessage}`);
      if (response.status === 401) {
        console.error("[Lumen Agent] Check that this node is enabled and its token is correct.");
      }
      await reportHealth("degraded", lastErrorMessage);
      return false;
    }

    const result = await response.json();
    consecutiveFailures = 0;
    lastErrorMessage = null;
    console.log(`[Lumen Agent] Connected • v${version} • next heartbeat in ${result.next_heartbeat_seconds || 30}s`);
    await reportHealth("healthy");
    await reportMetrics();
    await reportEvent("heartbeat_accepted", `Heartbeat accepted • agent v${version}`);
    return true;
  } catch (error) {
    consecutiveFailures = Math.min(1000, consecutiveFailures + 1);
    lastErrorMessage = `API unavailable: ${error.message}`.slice(0, 200);
    console.error(`[Lumen Agent] ${lastErrorMessage}`);
    await reportHealth("degraded", lastErrorMessage);
    return false;
  }
}

function retryDelayMs() {
  const exponent = Math.min(Math.max(consecutiveFailures - 1, 0), 4);
  const backoff = Math.min(maxRetryMs, baseIntervalMs * (2 ** exponent));
  const jitter = 0.8 + Math.random() * 0.4;
  return Math.min(maxRetryMs, Math.round(backoff * jitter));
}

function sleep(ms) {
  return new Promise(resolve => {
    wakeSleep = resolve;
    sleepTimer = setTimeout(() => {
      sleepTimer = null;
      wakeSleep = null;
      resolve();
    }, ms);
  });
}

function stop() {
  if (stopping) return;
  stopping = true;
  if (sleepTimer) clearTimeout(sleepTimer);
  sleepTimer = null;
  if (wakeSleep) wakeSleep();
  wakeSleep = null;
  console.log("\n[Lumen Agent] Shutdown requested.");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

console.log("[Lumen Agent] Starting development agent with host telemetry.");
console.log(`[Lumen Agent] API: ${heartbeatUrl}`);
await reportEvent("agent_started", `Agent v${version} started`);
let connected = await heartbeat();

while (!stopping) {
  const delay = connected ? baseIntervalMs : retryDelayMs();
  console.log(`[Lumen Agent] Next ${connected ? "heartbeat" : "retry"} in ${Math.round(delay / 1000)}s.`);
  await sleep(delay);
  if (!stopping) connected = await heartbeat();
}

console.log("[Lumen Agent] Shutdown complete.");
