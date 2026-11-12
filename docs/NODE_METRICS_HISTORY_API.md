# Node Performance History API — Milestone 19

## Overview

The node agent continues to send host metrics to `POST /api/node/metrics` every 30 seconds. The panel now stores a historical sample for each accepted report and exposes downsampled history for the admin Node Details graphs.

Stored history fields:
- CPU usage percentage (may be null during the first CPU sample)
- Memory used percentage
- One-minute system load average
- Sample timestamp

History is retained for seven days. Expired rows for a node are pruned when that node submits its next accepted metrics report. A paused or offline node does not generate new samples.

## Admin endpoint

`GET /api/admin/nodes/:id/metrics-history?range=24h`

Requires an authenticated administrator session.

Supported ranges and aggregation buckets:

| Range | Bucket |
|---|---|
| `1h` | 1 minute |
| `6h` | 5 minutes |
| `24h` | 15 minutes |
| `7d` | 1 hour |

The API returns chronological aggregate points with average/minimum/maximum CPU, average memory percentage, average load, and sample count. Responses are capped at 500 buckets.

Example response:

```json
{
  "node_id": "1",
  "range": "24h",
  "retention_days": 7,
  "points": [
    {
      "bucket_at": "2026-11-12T10:00:00.000Z",
      "cpu_avg": 18.4,
      "cpu_min": 7.2,
      "cpu_max": 31.6,
      "memory_avg": 62.1,
      "load_avg": 0.42,
      "sample_count": 30
    }
  ]
}
```

## Dashboard

Nodes → Details includes:
- CPU and memory history graph
- System load average graph
- 1-hour, 6-hour, 24-hour and 7-day range controls
- Average CPU, peak CPU and average memory summaries
- Automatic refresh while the Node Details page is open

Historical graphs begin collecting after this milestone is deployed. Existing latest-metric rows are not backfilled into history.

## Data and platform limitations

- Metrics describe the environment where the node agent runs. In GitHub Codespaces, these are Codespaces/container readings, not a production VPS.
- These are host-level readings, not per-Minecraft-server, Docker-container or Java-process metrics.
- History is not generated while the agent is offline or Codespaces is stopped.
- Seven-day retention cleanup runs when new metrics arrive; it is not a separate scheduled database job.
- The time-bucket query uses PostgreSQL `date_bin` and therefore requires PostgreSQL 14 or newer.
- The agent remains a development telemetry agent. It does not execute shell commands, access Docker, or control Minecraft processes.
