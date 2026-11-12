# Node Metrics API — Milestone 17

## Scope

The node agent reports host-level resource readings to the panel. This is not per-Minecraft-server or container telemetry and does not execute commands.

## Endpoint

`POST /api/node/metrics`

Authentication:
- `Authorization: Bearer <node-token>`
- `Content-Type: application/json`

Example body:

```json
{
  "cpuUsagePercent": 12.5,
  "memoryTotalBytes": 8589934592,
  "memoryUsedBytes": 4294967296,
  "uptimeSeconds": 86400,
  "processRssBytes": 52428800,
  "load1m": 0.42
}
```

- `cpuUsagePercent`: number from 0 to 100, or `null` until a second CPU sample is available.
- Memory, uptime and process RSS fields: non-negative safe integers; total memory must be greater than zero and used memory cannot exceed total.
- `load1m`: finite non-negative number, bounded by the API.
- The API accepts reports only from an enabled node authenticated with its node token.
- The API stores only the latest metrics snapshot for each node.

Success response: HTTP 202 with `accepted` and `reported_at`.

## Admin view

The admin Node Details page displays CPU, host memory, OS uptime, agent process RSS, one-minute load average and report time. A report older than 90 seconds is marked stale; missing reports are shown as no data.

## Limitations and safety

- Metrics describe the operating environment where the agent runs. In GitHub Codespaces, these are Codespaces/container host readings, not a production VPS.
- Metrics do not represent a specific Minecraft server, Docker container or Java process.
- The agent sends telemetry over its authenticated panel connection and does not execute shell commands or access Docker.
- CPU usage is calculated between consecutive agent samples; the first sample is shown as collecting.
