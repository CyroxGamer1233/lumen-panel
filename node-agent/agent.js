import process from "node:process";

const token = process.env.LUMEN_NODE_TOKEN;
const panelUrl = (process.env.LUMEN_PANEL_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const version = process.env.LUMEN_AGENT_VERSION || "0.1.0";
const intervalMs = 30_000;

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
let stopping = false;

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
      console.error(`[Lumen Agent] Heartbeat rejected: HTTP ${response.status} — ${body.error || "request failed"}`);
      if (response.status === 401) {
        console.error("[Lumen Agent] Check that this node is enabled and its token is correct.");
      }
      return;
    }

    const result = await response.json();
    console.log(`[Lumen Agent] Connected • v${version} • next heartbeat in ${result.next_heartbeat_seconds || 30}s`);
  } catch (error) {
    console.error(`[Lumen Agent] API unavailable: ${error.message}`);
  }
}

function stop() {
  if (stopping) return;
  stopping = true;
  console.log("\n[Lumen Agent] Stopped.");
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

console.log("[Lumen Agent] Starting heartbeat-only development agent.");
console.log(`[Lumen Agent] API: ${heartbeatUrl}`);
await heartbeat();

while (!stopping) {
  await new Promise(resolve => setTimeout(resolve, intervalMs));
  if (!stopping) await heartbeat();
}
