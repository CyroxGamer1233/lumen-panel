# Node Alerts API — Milestone 18

## Alert generation

The authenticated node agent posts host metrics to `POST /api/node/metrics`. The panel evaluates CPU and memory percentages on each accepted report.

- Warning: value is at least 90%.
- Critical: value is at least 95%.
- An active alert is updated on subsequent high readings instead of creating a new row every 30 seconds.
- When a metric falls below 90%, its active alert is marked resolved.
- Alert history is retained per node, with the latest 50 entries returned to admins.

Alert types:
- `cpu_high`
- `memory_high`

## Admin endpoint

`GET /api/admin/nodes/:id/alerts`

Requires an authenticated admin session. Returns the latest 50 alerts for an existing node, newest first. The endpoint does not expose node tokens.

## Limitations

- Alerts are evaluated when a valid metrics report arrives. If a node stops reporting, its telemetry becomes stale according to the existing 90-second freshness indicator; this implementation does not run a background scheduler to generate an offline alert.
- Alert thresholds are currently fixed at 90% and 95%; no user-configurable notification delivery is included.
- Metrics and alerts are host-level only, not per-Minecraft-server or container metrics.
- Alerts are shown in the admin node details page. No email, SMS, push notification or external paging is sent.
