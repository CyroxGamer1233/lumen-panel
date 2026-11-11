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
