# Lumen + PufferPanel integration (Milestone 1)

Lumen remains the customer-facing account and hosting dashboard. PufferPanel is the planned Minecraft server-management engine. The integration is deliberately being introduced in small, verifiable steps.

## What this milestone implements

- Server-side configuration for a PufferPanel URL and OAuth2 client credentials.
- Admin-only configuration status endpoint: `GET /api/admin/integrations/pufferpanel`.
- Admin-only OAuth credential test: `POST /api/admin/integrations/pufferpanel/test` (requires the Lumen session and CSRF header).
- OAuth tokens are kept only in backend process memory. The token and client secret are never returned to the browser or written to logs.
- The connection test is rate-limited and uses a 10-second timeout. HTTPS is required except for localhost development.

## Configure later, when a PufferPanel instance exists

Set these values in the backend environment (Codespaces Secrets or the server's protected environment file):

- `PUFFERPANEL_URL`: PufferPanel origin, for example `https://panel.example.net` (no path).
- `PUFFERPANEL_CLIENT_ID`: OAuth2 client ID created in PufferPanel.
- `PUFFERPANEL_CLIENT_SECRET`: matching OAuth2 client secret.

Do not commit real values, paste them into chat, or put them in frontend variables. Never use a personal administrator password as an integration credential. Create a dedicated, least-privilege OAuth client. PufferPanel uses OAuth2 client-credentials authentication; the client must be provisioned inside PufferPanel before this test can succeed.

## Current limitations

This milestone only verifies that PufferPanel accepts the OAuth client credentials. It does not yet prove that the client has server-management permissions, create or assign PufferPanel users, provision Minecraft servers, synchronize allocations, proxy console/files, or execute power actions. Lumen's existing server records and power endpoint remain unchanged and no Minecraft process is started.

The next integration step must map the exact PufferPanel v3 API endpoints and permission scopes, then create a server-side identity/ownership mapping before enabling customer actions. Do not expose PufferPanel admin credentials or OAuth tokens to the browser.

## Official references

- PufferPanel API authentication: https://github.com/PufferPanel/PufferPanel/blob/v3/api.md
- PufferPanel OAuth token endpoint: https://docs.pufferpanel.com/en/3.x/
- PufferPanel configuration: https://docs.pufferpanel.com/en/3.x/guides/config.html
