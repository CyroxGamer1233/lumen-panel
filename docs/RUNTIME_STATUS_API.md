# Runtime Status API — Milestone 12

## Scope

This milestone adds authenticated node heartbeat health fields and a node-scoped runtime status reporting API. It does not execute commands, provision servers, or start Minecraft. The current Codespaces node agent remains heartbeat-only.

## Node heartbeat

`POST /api/node/heartbeat`

Headers:
- `Authorization: Bearer <node-token>`
- `Content-Type: application/json`

Optional body:
```json
{ "agentVersion": "0.1.0" }
```

Success response includes `accepted`, the authenticated `node_id`, `next_heartbeat_seconds`, and server time. The node's `last_seen_at` is refreshed. The admin node list exposes `heartbeat_age_seconds` and the existing health status:
- `online`: enabled node heartbeat received within 90 seconds
- `offline`: no recent heartbeat
- `disabled`: node access revoked

The admin Node Details page displays the latest heartbeat and its age. A heartbeat proves only that the agent can reach the API; it does not prove that Docker, Wings, or Minecraft is healthy.

## Runtime status reporting

`POST /api/node/servers/:id/status`

Headers:
- `Authorization: Bearer <node-token>`
- `Content-Type: application/json`

Body:
```json
{
  "status": "running",
  "message": "Optional short diagnostic"
}
```

Allowed reported statuses: `installing`, `starting`, `running`, `stopping`, `stopped`, and `error`. The API verifies that the server is assigned to the authenticated node. Reports for servers assigned to another node are rejected. Messages are trimmed and limited to 200 characters.

The latest report is stored in `server_runtime_status`, with the reporting node and timestamp. The authenticated user's `GET /api/servers` response includes:
- `runtime_status`: `not_reported`, `unavailable`, or the latest node-reported status
- `runtime_message`
- `runtime_reported_at`

A report is considered unavailable when the node is disabled or has not sent a heartbeat within 90 seconds. The dashboard labels these as node-reported observations, not independently verified process state.

## Security and limitations

- Both node endpoints require an enabled node token; only its SHA-256 hash is stored.
- Status reports are scoped to servers assigned to that node.
- Status reporting is rate-limited and accepts only a fixed status allowlist.
- The API does not accept command strings and does not expose Docker, Wings, host shell, or file operations.
- The current node agent sends heartbeats only. It does not call the runtime status endpoint.
- Until a separately reviewed runtime adapter exists, no actual Minecraft lifecycle actions are available. The power endpoint continues to return `RUNTIME_NOT_CONNECTED` with `executed: false`.
