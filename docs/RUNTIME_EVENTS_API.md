# Runtime Event History API

Milestone 13 adds an append-only activity history for each server.

## Endpoint

`GET /api/servers/:id/events`

- Requires a signed-in user.
- The server must belong to the signed-in user, unless the user is an administrator.
- Returns the latest 50 events, newest first.
- Response shape: `{ "events": [...], "limit": 50 }`.

Each event includes:
- `id`: event ID
- `event_type`: `runtime_status` or `power_request`
- `status`: node lifecycle state or requested power action
- `message`: optional short note
- `created_at`: database timestamp
- `node_name`: node that reported the event, when applicable
- `actor_name`: account that made a power request, when applicable

## What is recorded

1. An accepted node status report is appended to `server_activity_events` after the server-to-node assignment check succeeds.
2. A valid, authorized Start/Stop/Restart request is logged before the API returns `503 RUNTIME_NOT_CONNECTED` with `executed: false`.

## Security and limitations

- Node reports are authenticated with the existing node token and scoped to servers assigned to that node.
- User event reads enforce server ownership or administrator access.
- Event history is read-only from the browser; there is no browser endpoint to create or edit events.
- This is an audit trail of reports and requests, not independent verification of a running process.
- The current Codespaces agent sends heartbeats only. It does not report lifecycle events or control Minecraft.
- No Docker socket, Wings API, arbitrary shell command, or Minecraft process execution is introduced.


## Node agent event reporting (Milestone 14)

The node agent reports two node-level diagnostic events to `POST /api/node/events` using its existing Bearer node token:

- `agent_started` — sent when the development agent starts.
- `heartbeat_accepted` — sent after the panel accepts a heartbeat.

The endpoint accepts only these fixed event types, trims messages to 200 characters, applies the node API rate limit, and associates each event with the authenticated node. Admins can read the latest 50 events with `GET /api/admin/nodes/:id/events`.

The Nodes → Details page displays this node-agent activity. It is separate from per-server Activity History: these events do not claim that Minecraft is installed or running. The agent still performs heartbeat reporting only; it does not execute shell commands, use Docker, or control Minecraft.


## Node agent health diagnostics (Milestone 15)

The development agent reports its communication health to `POST /api/node/health` with its existing Bearer node token. The fixed status allowlist is `healthy` or `degraded`; the request includes a bounded consecutive-failure count and an optional message capped at 200 characters. Reports are rate-limited and scoped to the authenticated, enabled node.

The admin node list returns the last health status, report timestamp and age, consecutive failures, and last diagnostic message. A node is shown as `stale` when its heartbeat is missing or older than 90 seconds; disabled nodes are shown as `disabled`. A health report is agent-reported diagnostic information, not independent host verification or Minecraft process telemetry.

If the panel is unreachable, the agent cannot deliver a fresh degraded report; the dashboard will eventually mark its last report stale.


## Node agent reliability and recovery (Milestone 16)

The development agent uses a 30-second heartbeat interval after successful communication. When a heartbeat fails or is rejected, it retries with exponential backoff and bounded jitter, capped at five minutes. A successful heartbeat resets the failure counter and returns to the normal interval. Ctrl+C or a termination signal wakes the retry wait and exits the loop cleanly. The agent never prints its node token. This improves communication recovery only; it does not add process execution, Docker access, or Minecraft power control.
