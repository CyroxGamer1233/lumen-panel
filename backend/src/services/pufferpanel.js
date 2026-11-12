const TOKEN_TIMEOUT_MS = 10_000;
function readConfig() {
  const baseUrl = (process.env.PUFFERPANEL_URL || "").trim().replace(/\/+$/, "");
  const clientId = (process.env.PUFFERPANEL_CLIENT_ID || "").trim();
  const clientSecret = process.env.PUFFERPANEL_CLIENT_SECRET || "";
  const missing = [];
  if (!baseUrl) missing.push("PUFFERPANEL_URL");
  if (!clientId) missing.push("PUFFERPANEL_CLIENT_ID");
  if (!clientSecret) missing.push("PUFFERPANEL_CLIENT_SECRET");
  if (missing.length) return { configured: false, missing };

  let parsed;
  try { parsed = new URL(baseUrl); } catch {
    return { configured: false, missing: [], invalid: "PUFFERPANEL_URL must be a valid URL." };
  }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/" ||
      (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localHost))) {
    return { configured: false, missing: [], invalid: "PUFFERPANEL_URL must be an HTTPS origin (HTTP is allowed only for localhost development)." };
  }
  return { configured: true, missing: [], baseUrl, clientId, clientSecret, hostname: parsed.host };
}

export function getPufferPanelStatus() {
  const config = readConfig();
  return {
    configured: config.configured,
    hostname: config.configured ? config.hostname : null,
    missing: config.missing,
    error: config.invalid || null,
    mode: "oauth-connection-test-only"
  };
}

export async function testPufferPanelConnection() {
  const config = readConfig();
  if (!config.configured) {
    const error = new Error(config.invalid || "PufferPanel integration is not configured.");
    error.code = config.invalid ? "PUFFER_INVALID_CONFIG" : "PUFFER_NOT_CONFIGURED";
    error.publicMessage = config.invalid || "Configure all PufferPanel integration settings on the server first.";
    throw error;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret
  });
  let response;
  try {
    response = await fetch(config.baseUrl + "/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body,
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
      redirect: "error"
    });
  } catch {
    const error = new Error("Could not reach the configured PufferPanel OAuth endpoint.");
    error.code = "PUFFER_UNREACHABLE";
    error.publicMessage = error.message;
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.access_token !== "string" || !payload.access_token ||
      (payload.token_type && String(payload.token_type).toLowerCase() !== "bearer")) {
    const error = new Error("PufferPanel rejected the OAuth client credentials. Check the client and permissions.");
    error.code = "PUFFER_AUTH_FAILED";
    error.publicMessage = error.message;
    throw error;
  }

  const expiresIn = Number(payload.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn < 1) {
    const error = new Error("PufferPanel returned an invalid OAuth token lifetime.");
    error.code = "PUFFER_BAD_TOKEN";
    error.publicMessage = error.message;
    throw error;
  }
  // The connection test discards the access token immediately; later milestones
  // will add a scoped API client with explicit token lifecycle management.
  return { expiresIn };
}
