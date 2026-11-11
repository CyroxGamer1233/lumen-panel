# Lumen Panel

An original, Pterodactyl-style Minecraft hosting control panel with a custom Lumen interface.

## Current build

- Responsive React dashboard with custom dark-purple Lumen styling
- PostgreSQL-backed user accounts and server-side sessions
- Argon2id password hashing, login rate limiting, CSRF protection and role-aware API middleware
- Secure, HTTP-only session cookies
- Admin-only user listing API at `GET /api/admin/users`
- Express API health endpoint and Vite development proxy
- Demo-only server status controls (not connected to a real Minecraft host)

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

## Planned production architecture

- Panel frontend: React + Vite
- Panel API: Node.js + Express
- Database and sessions: PostgreSQL
- Cache and jobs: Redis
- Game nodes: Pterodactyl Wings
- Container isolation: Docker managed by Wings

The Lumen API owns authentication, authorization, server metadata and panel business logic. Node credentials remain server-side. Never expose Wings API tokens, Docker sockets, or unrestricted host shell access to the browser.

## Important limitations

Authentication requires a reachable PostgreSQL database and valid environment variables. The dashboard's server metrics and server controls are still illustrative demo data. Real Minecraft hosting requires a separate Linux host with a properly installed and secured Wings node, followed by authenticated API integration.
