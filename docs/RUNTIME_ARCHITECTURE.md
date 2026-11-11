# Lumen Runtime Architecture — Milestone 11

## Purpose

Define the boundary between the Lumen Panel API and a future trusted Minecraft runtime. This document is an architecture contract, not an installed runtime. The current Codespaces agent remains heartbeat-only.

## Components and trust boundaries

1. **Browser** — talks only to the Lumen HTTPS API using the user's session and CSRF token. It never receives node credentials, Wings credentials, Docker access, or host-shell access.
2. **Lumen API** — authenticates users, checks server ownership/admin role, validates requested actions, records server state, and brokers work to the assigned node.
3. **PostgreSQL** — stores users, servers, nodes, allocations, runtime observations, and eventually a durable action queue.
4. **Node agent / runtime adapter** — runs on a separately managed Linux host. It authenticates outbound to the panel, reports health, and accepts only narrowly defined, authorized server operations.
5. **Minecraft process/container** — isolated per server with explicit CPU, memory, disk, network, and filesystem limits. The runtime adapter must not expose arbitrary host commands.

## Required communication model

- Prefer outbound node-to-panel HTTPS connections; do not expose an unauthenticated agent control port to the public internet.
- Authenticate every node request. Store only token hashes in the panel database; keep raw credentials in a root-readable secret store on the node.
- Use TLS, request size limits, rate limits, credential rotation/revocation, and replay-resistant request authentication for command delivery.
- Scope every action to a registered node and a server assigned to that node.
- Treat node-reported data as untrusted observations; validate types, lengths, timestamps, and allowed state transitions.
- Never put node credentials, Docker socket paths, or Wings API tokens in frontend code, browser storage, API responses, or logs.

## Server lifecycle contract

Allowed lifecycle states:

- `pending` — configuration exists; no runtime instance confirmed.
- `installing` — a trusted runtime has accepted a provisioning job.
- `starting` — start request accepted and process startup is being observed.
- `running` — runtime has confirmed the process is running.
- `stopping` — stop request accepted and shutdown is being observed.
- `stopped` — runtime has confirmed no process is running.
- `error` — runtime reported a failure; a safe, bounded error summary is available.
- `unavailable` — the assigned node has not reported recently or runtime state cannot be verified.

The panel must not mark a server as running merely because a request was queued. State changes to running/stopped only after an authenticated runtime observation. A stale node heartbeat should make runtime state unavailable, not leave a misleading running badge.

## Power action protocol (future implementation)

1. Browser sends `POST /api/servers/:id/power` with `start`, `stop`, or `restart`.
2. API validates session, CSRF, server ID, ownership/admin role, assigned enabled node, and current lifecycle state.
3. API creates a durable action record with a unique action ID and idempotency key. Repeated submissions must not execute duplicate actions.
4. The node retrieves authorized work over its authenticated outbound channel.
5. The node verifies node ID, server assignment, action allowlist, expiry, and action ID before dispatching through a restricted runtime adapter.
6. Node reports accepted/completed/failed results. The API records the result and waits for a separate runtime observation before changing lifecycle state.
7. Timeouts and lost node connections produce an explicit unavailable/unknown result; they must never be reported as successful execution.

## Runtime adapter constraints

- No arbitrary shell command endpoint, command strings supplied by the browser, or general-purpose file execution.
- No direct Docker socket access from the panel API or browser.
- Use a maintained isolation/runtime layer (for example, a properly configured Wings installation) rather than writing a custom container manager.
- Enforce per-server resource limits and filesystem boundaries.
- Use a fixed allowlist of lifecycle operations; validate all IDs and payloads on both panel and node.
- Log actor, server, node, action ID, timestamps, and outcome without logging credentials.
- Require explicit operator provisioning and review before enabling production execution.

## Current implementation status

- Existing node registration and heartbeat APIs are present.
- Existing `node-agent/agent.js` only sends heartbeats; it does not poll for jobs or control processes.
- Existing power API intentionally returns `RUNTIME_NOT_CONNECTED` and `executed: false`.
- No Minecraft process, Docker container, Wings instance, live console, file manager, or live telemetry is connected by this milestone.

## Acceptance checklist for a future runtime milestone

- [ ] Dedicated Linux host is available and maintained.
- [ ] Runtime adapter is installed with least privilege and isolation.
- [ ] Node credentials can be rotated and revoked.
- [ ] Authenticated outbound job delivery is implemented.
- [ ] Actions are durable, idempotent, expiring, and node/server scoped.
- [ ] Runtime observations drive lifecycle state.
- [ ] Unauthorized, duplicate, stale, and malformed requests are rejected.
- [ ] Tests cover node offline, timeouts, retries, ownership, and cross-node assignment.
- [ ] Security review is complete before real power actions are enabled.
