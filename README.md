# Lumen Panel

An original, Pterodactyl-style Minecraft hosting control panel with a custom Lumen interface.

## Current build

- Responsive React dashboard with custom dark-purple Lumen styling
- Sidebar navigation, server overview, resource cards and activity panels
- Express API health endpoint
- Vite development proxy so the frontend can call the backend at `/api`
- Demo-only server status controls (not connected to a real Minecraft host)

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- GitHub Codespaces or a local development environment

## Run in GitHub Codespaces

Open a terminal at the repository root and run:

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
npm run dev
```

The workspace starts both services:
- Frontend: port **5173**
- Backend API: port **3000**

Open the forwarded **5173** port to view Lumen Panel. The frontend Vite server proxies requests under `/api` to the backend on port 3000.

Check the API directly using the forwarded **3000** port and path:

```
/api/health
```

## Project structure

```text
lumen-panel/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   └── vite.config.js
├── backend/
│   ├── src/server.js
│   ├── .env.example
│   └── package.json
├── package.json
└── README.md
```

## Planned production architecture

- Panel frontend: React + Vite
- Panel API: Node.js + Express
- Database: PostgreSQL
- Cache and jobs: Redis
- Game nodes: Pterodactyl Wings
- Container isolation: Docker managed by Wings

The Lumen API will own user authentication, authorization, server metadata and panel-specific business logic. A future node adapter will communicate with Wings using server-side credentials. Never expose Wings API tokens, Docker sockets, or unrestricted host shell access to the browser.

## Important limitations

The current dashboard displays illustrative demo metrics. Start/stop controls only change local UI state. They do not start, stop, or restart a real Minecraft server. Real hosting requires a separate Linux host with a properly installed and secured Wings node, followed by authenticated API integration.
