# Lumen Panel

An original, Pterodactyl-style Minecraft hosting control panel with a custom Lumen interface.

## Current build

- Responsive React dashboard with a minimal black-and-yellow Lumen interface
- PostgreSQL-backed user accounts and server-side sessions
- Argon2id password hashing, login rate limiting, CSRF protection and role-aware API middleware
- Secure, HTTP-only session cookies
- Admin-only user and node management APIs
- Secure node registry: one-time node token issuance, SHA-256 token-hash storage, disable support, and authenticated heartbeat endpoint
- Express API health endpoint and Vite development proxy
- Server inventory is PostgreSQL-backed; live metrics, console, file access, and power controls are not available yet

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- PostgreSQL database
- GitHub Codespaces or a local development environment

## Configure PostgreSQL and authentication

1. Create a PostgreSQL database using a provider you trust.
2. In Codespaces, open **Settings → Secrets and variables → Codespaces** and add these secrets:
   - `DATABASE_URL`: your PostgreSQL connection string
   - `SESSION_SECRET`: a random secret with at least 32 characters
3. Do not commit `.env` files or paste database credentials into chat.
4. In the Codespaces terminal, create `backend/.env` from the example and set the values locally:

```bash
cp backend/.env.example backend/.env
```

Set `DATABASE_URL` and `SESSION_SECRET` in `backend/.env` using your Codespaces secrets. For local development, `DATABASE_SSL=false` may be appropriate only when your local PostgreSQL server does not use TLS. For hosted PostgreSQL, use the provider's TLS connection settings.

Generate a session secret locally with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The API creates the `users` table and the PostgreSQL session table automatically on startup.

## Run in GitHub Codespaces

From the repository root:

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
npm run dev
```

- Frontend: port **5173**
- Backend API: port **3000**

Open forwarded port 5173. The API health endpoint is available at forwarded port 3000 plus `/api/health`. It reports whether PostgreSQL is connected.

## Create the first administrator

New registrations always receive the `user` role. After creating your account, promote your own account from the trusted PostgreSQL SQL console:

```sql
UPDATE users
SET role = 'admin', updated_at = NOW()
WHERE email = 'your-account@example.com';
```

Replace the email with the address used for your account. Never expose an admin role selector in public registration.

The admin-only endpoint is `GET /api/admin/users`. It returns user account metadata only and is protected by a server-side role check.

## Project structure

```text
lumen-panel/
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── AuthScreen.jsx
│       ├── auth.css
│       ├── main.jsx
│       └── styles.css
├── backend/
│   ├── src/server.js
│   ├── .env.example
│   └── package.json
└── package.json
```


## Node integration foundation (Milestone 3)

This milestone adds the panel-side node registry. It does **not** install a Minecraft host, Docker, Wings, or a node agent.

Admin API (requires a signed-in admin session; write requests also require the `X-CSRF-Token` header):

- `GET /api/admin/nodes` — list registered nodes and their online/offline/disabled state.
- `POST /api/admin/nodes` with `{ "name": "Lucknow Node 1" }` — create a node and return its token once.
- `POST /api/admin/nodes/:id/disable` — revoke a node's access.

Node API:

- `POST /api/node/heartbeat` — authenticated node heartbeat. Send the node token as `Authorization: Bearer lmn_node_...` and an optional `{ "agentVersion": "0.1.0" }` JSON body.
- A node is shown as online for 90 seconds after its latest heartbeat. Heartbeats are rate-limited.

**Token safety:** the full node token is returned only when the node is created. The database stores only its SHA-256 hash. The admin receives the token once during node creation so it can be provisioned onto the Linux host. Do not hard-code it in frontend source, persist it in browser storage, or share it in screenshots, Git commits, or chat. Store it on the Linux node in a root-readable environment file. Disabling a node immediately prevents further heartbeats.

**Current limitation:** no node agent is included yet, so nodes remain offline until a trusted agent is installed and configured. The heartbeat endpoint only records presence and agent version; it does not run shell commands, control Docker, or start Minecraft servers. Real server power controls, console streaming, file access, and live metrics are a later milestone.

## Planned production architecture

- Panel frontend: React + Vite
- Panel API: Node.js + Express
- Database and sessions: PostgreSQL
- Cache and jobs: Redis
- Game nodes: Pterodactyl Wings
- Container isolation: Docker managed by Wings

The Lumen API owns authentication, authorization, server metadata and panel business logic. Node credentials remain server-side. Never expose Wings API tokens, Docker sockets, or unrestricted host shell access to the browser.

## Important limitations

Authentication requires a reachable PostgreSQL database and valid environment variables. Live metrics and server controls are not available yet; the panel does not currently provision or start Minecraft. Real hosting requires a separate Linux host with a properly installed and secured node integration, followed by authenticated API integration.


## Server inventory foundation (Milestone 7)

- Admins can create server configuration records from the Servers page.
- Server records are stored in PostgreSQL and associated with their account and, optionally, an enabled node.
- Supported initial software choices: Paper, Vanilla, and Fabric.
- Memory and storage values are validated by the API; game versions are validated as short version strings.
- The API returns only the signed-in user's servers unless the account is an administrator.
- New records use the `pending` status. Creating a record does not provision files, download a server jar, create a container, or start Minecraft.
- Power controls, console, file manager, player counts, and live resource usage remain unavailable until a properly secured production node integration is implemented.

## Server configuration and allocations (Milestone 8)

- Administrators can edit server name, Minecraft software, game version, memory limit, and storage limit.
- Administrators can add an allocation to an enabled node using a valid IPv4/IPv6 bind address and TCP port (1024–65535).
- The database prevents duplicate IP/port pairs on the same node and prevents one allocation from being assigned to multiple servers.
- A server can only use an allocation belonging to its assigned node.
- Allocation records are configuration metadata only. Adding an allocation does not open a firewall port, bind a socket, create a container, or start Minecraft.
- Use an address and port that are actually configured and available on the host. Do not assume that entering an IP/port here makes it reachable from the internet.
- This milestone does not add live server power controls, console access, file access, or resource telemetry.


## Individual server dashboard (Milestone 9)

- Users can open a dedicated details page for each server from the Overview or Servers page.
- The dashboard displays saved server identity, software/version, assigned node, allocation, memory limit, and storage quota.
- Console and player panels clearly show that live data is not connected yet; they do not display fabricated server output or player counts.
- Resource values are configured limits, not live usage measurements.
- The dashboard is a presentation layer for saved configuration only. It does not start, stop, or otherwise control a Minecraft process.


## Server power control readiness (Milestone 10)

- The server details page includes Start, Restart, and Stop request controls.
- Requests require an authenticated session, CSRF validation, a valid server ID, and server ownership (or administrator access).
- The API currently returns `RUNTIME_NOT_CONNECTED` with `executed: false`. This is an intentional safety gate: no Minecraft process is started, stopped, or restarted.
- A trusted runtime and node-side authorization protocol must be implemented and reviewed before these controls can execute real power actions.


## Secure runtime architecture (Milestone 11)

- Added [the runtime architecture contract](docs/RUNTIME_ARCHITECTURE.md), defining browser/API/node trust boundaries, the future authenticated job flow, lifecycle states, and security requirements.
- Defines how Start/Stop/Restart requests must be authorized, queued, delivered, deduplicated, and confirmed by runtime observations.
- This milestone is documentation and architecture only. It does not install Wings or Docker, add command execution, or enable real Minecraft power actions.
- The existing node agent remains heartbeat-only, and the power API continues to return `RUNTIME_NOT_CONNECTED` until a separately provisioned and reviewed runtime exists.
