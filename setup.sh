#!/usr/bin/env bash
set -euo pipefail

mkdir -p frontend/src backend/src

cat > package.json <<'EOF'
{
  "name": "lumen-panel",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm:dev:api\" \"npm:dev:web\"",
    "dev:api": "npm --prefix backend run dev",
    "dev:web": "npm --prefix frontend run dev -- --host 0.0.0.0",
    "build": "npm --prefix frontend run build"
  },
  "devDependencies": { "concurrently": "^9.1.2" }
}
EOF

cat > frontend/package.json <<'EOF'
{
  "name": "lumen-panel-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build" },
  "dependencies": {
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": { "@vitejs/plugin-react": "^4.3.4", "vite": "^6.0.5" }
}
EOF

cat > frontend/index.html <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#090914" />
    <title>Lumen Panel</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

cat > frontend/vite.config.js <<'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { host: "0.0.0.0", port: 5173 }
});
EOF

cat > frontend/src/main.jsx <<'EOF'
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>
);
EOF

cat > frontend/src/App.jsx <<'EOF'
import { useEffect, useState } from "react";
import {
  Activity, Bell, Box, ChevronDown, Cpu, Database, FileText, Gauge,
  HardDrive, LayoutDashboard, LifeBuoy, Menu, MoreHorizontal, Plus,
  Power, Search, Server, Settings, ShieldCheck, Terminal, Users, Wifi, Zap
} from "lucide-react";

const groups = [
  { label: "WORKSPACE", links: [["Overview", LayoutDashboard], ["Servers", Server], ["Databases", Database], ["Backups", HardDrive]] },
  { label: "MANAGEMENT", links: [["Users", Users], ["Nodes", Box], ["Activity", Activity], ["Settings", Settings]] }
];

export default function App() {
  const [page, setPage] = useState("Overview");
  const [menu, setMenu] = useState(false);
  const [api, setApi] = useState("checking");
  const [server, setServer] = useState("Running");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(() => setApi("online")).catch(() => setApi("offline"));
  }, []);

  function navigate(name) {
    setPage(name);
    setMenu(false);
    setNotice(name === "Overview" ? "" : name + " is planned for a future build.");
  }

  function toggleServer() {
    setServer(server === "Running" ? "Stopped" : "Running");
    setNotice("Demo control only. Connect a Wings node before controlling a real server.");
  }

  return <div className="shell">
    <aside className={`sidebar ${menu ? "open" : ""}`}>
      <div className="brand"><div className="brand-icon"><Zap fill="currentColor" size={21}/></div><div><b>LUMEN<span>.</span></b><small>CONTROL CENTER</small></div><button className="close" onClick={() => setMenu(false)}>×</button></div>
      <button className="workspace"><div className="workspace-logo">L</div><span><b>Lumen Workspace</b><small>Personal workspace</small></span><ChevronDown size={15}/></button>
      <div className="search"><Search size={15}/>Quick search <kbd>⌘ K</kbd></div>
      {groups.map(g => <div className="nav-group" key={g.label}><label>{g.label}</label>{g.links.map(([name, Icon]) => <button key={name} className={page === name ? "nav active" : "nav"} onClick={() => navigate(name)}><Icon size={17}/>{name}{name === "Servers" && <em>1</em>}</button>)}</div>)}
      <div className="side-bottom"><div className="help"><LifeBuoy size={17}/><b>Need a hand?</b><p>Explore guides and learn your way around Lumen.</p><button onClick={() => setNotice("Documentation is coming soon.")}>Open documentation ↗</button></div><div className="profile"><div className="avatar">S</div><span><b>Workspace Owner</b><small>Administrator</small></span><MoreHorizontal size={18}/></div></div>
    </aside>

    <main>
      <header className="topbar"><div className="crumb"><button className="hamb" onClick={() => setMenu(!menu)}><Menu size={19}/></button><span>Workspace</span><i>/</i><b>{page}</b></div><div className="top-right"><span className="api"><i className={api === "online" ? "good" : api === "offline" ? "bad" : ""}/>{api === "online" ? "API online" : api === "offline" ? "API offline" : "API checking"}</span><button className="bell"><Bell size={18}/></button><div className="avatar">S</div></div></header>
      <div className="content">
        <div className="welcome"><div><label className="eyebrow">✦ YOUR CONTROL CENTER</label><h1>{page === "Overview" ? "Good afternoon." : page + "."}</h1><p>Here’s what’s happening with your infrastructure today.</p></div><button className="primary" onClick={() => setNotice("Server provisioning will be available after node integration.")}><Plus size={17}/> Create server</button></div>
        {notice && <div className="notice"><ShieldCheck size={16}/>{notice}<button onClick={() => setNotice("")}>×</button></div>}
        <section className="stats">
          <article className="stat"><div className="stat-head">ACTIVE SERVERS <Server/></div><strong>01 <small>/ 05</small></strong><p>● 1 server configured</p></article>
          <article className="stat"><div className="stat-head">CPU USAGE <Cpu/></div><strong>12.4<small>%</small></strong><div className="meter"><i style={{width:"12.4%"}}/></div><p>Demo resource data</p></article>
          <article className="stat"><div className="stat-head">MEMORY <Gauge/></div><strong>2.1 <small>GB</small></strong><div className="meter"><i style={{width:"42%"}}/></div><p>Of 5 GB allocated · Demo</p></article>
          <article className="stat"><div className="stat-head">STORAGE <HardDrive/></div><strong>8.6 <small>GB</small></strong><div className="meter"><i style={{width:"28%"}}/></div><p>Of 30 GB allocated · Demo</p></article>
        </section>

        <div className="section-title"><div><h2>Your servers</h2><p>Manage and monitor your game instances.</p></div><button onClick={() => navigate("Servers")}>View all ↗</button></div>
        <section className="server-card">
          <div className="server-top"><div className="game-icon"><Box size={24}/></div><div className="server-name"><div><h3>Lumen SMP</h3><span className={server === "Running" ? "running" : "stopped"}>● {server}</span></div><p>minecraft-java · Paper · Survival</p><small><Wifi size={13}/> No node connected <span> <Users size={13}/> 0 / 10 players</span></small></div><button className="dots"><MoreHorizontal/></button></div>
          <div className="server-bottom"><div className="resource"><div><span>CPU</span><b>12%</b></div><div className="meter"><i style={{width:"12%"}}/></div></div><div className="resource"><div><span>MEMORY</span><b>1.2 / 3 GB</b></div><div className="meter"><i style={{width:"40%"}}/></div></div><div className="server-buttons"><button onClick={() => setNotice("Console preview only. Connect a Wings node for live logs.")}><Terminal size={15}/> Console</button><button className="server-toggle" onClick={toggleServer}><Power size={15}/>{server === "Running" ? "Stop" : "Start"}</button></div></div>
        </section>

        <div className="lower">
          <section className="panel"><div className="panel-head"><div><h2>Resource activity</h2><p>Node performance over time</p></div><span>Last 24 hours⌄</span></div><div className="chart"><div className="y-axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div className="plot"><div className="gridlines"><i/><i/><i/><i/><i/></div><svg viewBox="0 0 600 170" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#987aff" stopOpacity=".3"/><stop offset="100%" stopColor="#987aff" stopOpacity="0"/></linearGradient></defs><path d="M0 125 C35 118 38 90 75 102 S125 120 150 86 S200 96 225 75 S270 91 300 65 S345 83 375 70 S425 94 450 60 S500 76 525 48 S570 63 600 38 L600 170 L0 170Z" fill="url(#area)"/><path d="M0 125 C35 118 38 90 75 102 S125 120 150 86 S200 96 225 75 S270 91 300 65 S345 83 375 70 S425 94 450 60 S500 76 525 48 S570 63 600 38" fill="none" stroke="#a38aff" strokeWidth="2.5"/></svg><div className="x-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Now</span></div></div></div><div className="legend"><span>● CPU usage</span><span>● Memory usage</span><small>Illustrative preview data</small></div></section>
          <section className="panel activity"><div className="panel-head"><div><h2>Recent activity</h2><p>Latest workspace events</p></div><MoreHorizontal size={18}/></div><div className="event"><div className="event-icon">↻</div><div><b>Server status preview</b><p>Lumen SMP marked as {server.toLowerCase()}</p><small>Just now · Local demo</small></div></div><div className="event"><div className="event-icon purple">⌘</div><div><b>Workspace initialized</b><p>Lumen Panel project created</p><small>Today · Setup</small></div></div><div className="event"><div className="event-icon blue">☁</div><div><b>API health check</b><p>{api === "online" ? "Backend connection successful" : "Waiting for backend"}</p><small>Today · System</small></div></div></section>
        </div>
        <footer>© 2026 Lumen Panel <span>● Built for your servers</span><span>Version 0.1.0 · Preview</span></footer>
      </div>
    </main>
  </div>;
}
EOF

cat > frontend/src/styles.css <<'EOF'
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
:root{font-family:'DM Sans',sans-serif;color:#eeeefa;background:#090914;font-synthesis:none;text-rendering:optimizeLegibility}*{box-sizing:border-box}body{margin:0;min-width:320px;background:#090914}button{font:inherit;cursor:pointer}.shell{min-height:100vh}.sidebar{position:fixed;inset:0 auto 0 0;width:252px;background:#0d0d1a;border-right:1px solid #222136;padding:25px 16px 15px;display:flex;flex-direction:column;z-index:5}.brand{display:flex;align-items:center;gap:11px;padding:0 9px 27px}.brand-icon{width:36px;height:36px;border-radius:11px;background:linear-gradient(145deg,#9a79ff,#6044d8);display:grid;place-items:center;color:white;box-shadow:0 5px 22px #7857ff55}.brand b{font:700 20px 'Space Grotesk';letter-spacing:2px}.brand b span{color:#9b7dff}.brand small{display:block;font-size:8px;letter-spacing:2px;color:#77758e;margin-top:2px}.close{display:none;margin-left:auto;background:none;border:0;color:#aaa;font-size:23px}.workspace{width:100%;display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #29273e;border-radius:10px;background:#151426;color:#eeeefa;text-align:left}.workspace-logo,.avatar{display:grid;place-items:center;border-radius:9px;background:linear-gradient(140deg,#8c6cff,#5141a8);font-weight:700;color:white;width:30px;height:30px}.workspace span,.profile span{display:grid;gap:3px;flex:1}.workspace b,.profile b{font-size:11px}.workspace small,.profile small{font-size:10px;color:#77768e}.search{height:37px;margin:17px 0 24px;padding:0 10px;display:flex;align-items:center;gap:9px;border:1px solid #242238;border-radius:8px;color:#77768e;font-size:11px}.search kbd{margin-left:auto;background:#222137;border-radius:4px;padding:3px 5px;font-size:9px}.nav-group{margin-bottom:23px}.nav-group label{display:block;font-size:9px;letter-spacing:1.5px;color:#66657c;font-weight:700;padding:0 10px 9px}.nav{width:100%;height:39px;border:0;background:none;color:#9694ab;display:flex;align-items:center;gap:12px;padding:0 11px;border-radius:8px;font-size:12px;text-align:left;margin:2px 0}.nav:hover{background:#19182a;color:#ddd9f5}.nav.active{color:#c7baff;background:linear-gradient(90deg,#6e50d526,#6e50d508);box-shadow:inset 2px 0 #9b7bff}.nav em{margin-left:auto;font-style:normal;font-size:10px;background:#292443;padding:2px 7px;border-radius:10px;color:#b5a4ff}.side-bottom{margin-top:auto}.help{border:1px solid #28243d;border-radius:10px;padding:13px;background:linear-gradient(145deg,#1b1830,#121220);margin-bottom:15px;color:#a58aff}.help b{display:block;color:#eee;font-size:11px;margin-top:8px}.help p{font-size:10px;color:#85839a;line-height:1.6}.help button{color:#b5a2ff;border:0;background:none;padding:0;font-size:10px}.profile{border-top:1px solid #252338;padding:15px 5px 0;display:flex;align-items:center;gap:10px;color:#aaa8bd}.main-area,main{margin-left:252px;min-height:100vh}.topbar{height:68px;border-bottom:1px solid #222136;display:flex;align-items:center;justify-content:space-between;padding:0 38px;background:#0b0b17cc}.crumb,.top-right{display:flex;align-items:center;gap:12px;font-size:11px}.crumb span,.crumb i{color:#77758d;font-style:normal}.top-right{gap:17px}.api{border:1px solid #28263b;border-radius:20px;padding:7px 10px;color:#aaa8bb;font-size:10px}.api i{display:inline-block;width:6px;height:6px;background:#888;border-radius:50%;margin-right:7px}.api i.good{background:#4fd5a0;box-shadow:0 0 9px #4fd5a066}.api i.bad{background:#ff727e}.bell{background:none;border:0;color:#aaa}.avatar{border-radius:50%;font-size:12px}.hamb{display:none}.content{max-width:1500px;margin:auto;padding:38px 40px 20px}.welcome{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:28px}.eyebrow{font-size:9px;letter-spacing:1.8px;color:#a28aff;font-weight:700}.welcome h1{font:600 30px 'Space Grotesk';letter-spacing:-1px;margin:10px 0 5px}.welcome p,.section-title p,.panel-head p{font-size:11px;color:#85839a;margin:0}.primary{border:1px solid #9a7bff;background:linear-gradient(120deg,#8d6aff,#6849d4);box-shadow:0 5px 22px #7854e633;color:white;border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600}.notice{display:flex;align-items:center;gap:9px;padding:11px 13px;border:1px solid #3a315d;background:#19152b;color:#c5b8ff;border-radius:8px;font-size:11px;margin:-12px 0 20px}.notice button{margin-left:auto;border:0;background:none;color:#b5a5ef;font-size:18px}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.stat,.panel{border:1px solid #25243a;background:linear-gradient(145deg,#141322,#10101c);border-radius:11px;padding:17px}.stat-head{display:flex;justify-content:space-between;align-items:center;color:#85839a;font-size:9px;letter-spacing:1px;font-weight:700}.stat-head svg{width:18px;color:#aa91ff}.stat strong{display:block;font:600 27px 'Space Grotesk';margin:14px 0 11px}.stat strong small{font:400 12px 'DM Sans';color:#77758d}.stat p{font-size:9px;color:#77758d;margin:8px 0 0}.meter{height:4px;background:#29263b;border-radius:5px;overflow:hidden}.meter i{display:block;height:100%;background:linear-gradient(90deg,#7454db,#a78aff);border-radius:5px}.section-title{display:flex;justify-content:space-between;align-items:center;margin:31px 0 13px}.section-title h2,.panel-head h2{font:600 15px 'Space Grotesk';margin:0 0 5px}.section-title button{color:#b5a1ff;background:none;border:0;font-size:10px}.server-card{border:1px solid #29263f;background:linear-gradient(110deg,#171528,#11111e);border-radius:11px;overflow:hidden}.server-top{display:flex;align-items:center;padding:17px 19px;gap:14px}.game-icon{width:43px;height:43px;display:grid;place-items:center;color:#b49aff;background:#8c6cff20;border:1px solid #57428a66;border-radius:10px}.server-name{flex:1}.server-name>div{display:flex;align-items:center;gap:10px}.server-name h3{font:600 14px 'Space Grotesk';margin:0}.running,.stopped{padding:4px 8px;border-radius:20px;font-size:9px;color:#55d7a4;background:#55d7a415}.stopped{color:#ff9a85;background:#ff9a8515}.server-name p{font-size:10px;color:#817f96;margin:5px 0 9px}.server-name small{display:flex;align-items:center;gap:5px;color:#89879e;font-size:9px}.server-name small span{display:flex;align-items:center;gap:5px;margin-left:12px}.dots{border:0;background:none;color:#777}.server-bottom{border-top:1px solid #28253a;background:#11101c;padding:13px 18px;display:flex;align-items:center;gap:24px}.resource{width:155px}.resource>div:first-child{display:flex;justify-content:space-between;margin-bottom:7px}.resource span{font-size:8px;color:#77758d;letter-spacing:1px}.resource b{font-size:9px;font-weight:500;color:#c5c1d8}.server-buttons{margin-left:auto;display:flex;gap:8px}.server-buttons button{display:flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid #343047;background:#1a1929;color:#c3bfd4;border-radius:7px;font-size:9px}.server-buttons .server-toggle{border-color:#5a458f;color:#c3adff;background:#5d43a21c}.lower{display:grid;grid-template-columns:1.55fr 1fr;gap:14px;margin-top:16px}.panel{min-width:0}.panel-head{display:flex;justify-content:space-between;align-items:flex-start}.panel-head>span{background:#1b192a;border:1px solid #302d44;color:#aaa7bd;border-radius:6px;padding:7px 9px;font-size:9px}.chart{display:flex;height:170px;margin-top:22px}.y-axis{display:flex;flex-direction:column;justify-content:space-between;color:#65637a;font-size:8px;padding:0 10px 18px 0}.plot{position:relative;flex:1}.gridlines{position:absolute;inset:0 0 18px;display:flex;flex-direction:column;justify-content:space-between}.gridlines i{border-top:1px dashed #2b293e}.plot svg{position:absolute;inset:0 0 18px;width:100%;height:calc(100% - 18px)}.x-axis{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-between;color:#65637a;font-size:8px}.legend{display:flex;align-items:center;gap:14px;margin:8px 0 0 36px;color:#9290a5;font-size:9px}.legend span:first-child{color:#a38aff}.legend span:nth-child(2){color:#5d9dff}.legend small{margin-left:auto;color:#65637a;font-size:8px}.event{display:flex;gap:10px;padding:13px 0;border-bottom:1px solid #262439}.event-icon{width:29px;height:29px;display:grid;place-items:center;border-radius:8px;background:#5dd5a418;color:#5dd5a4;flex-shrink:0}.event-icon.purple{background:#ad91ff18;color:#ad91ff}.event-icon.blue{background:#76aaff18;color:#76aaff}.event b{font-size:10px}.event p{font-size:9px;color:#89879d;margin:4px 0}.event small{font-size:8px;color:#65637a}footer{display:flex;justify-content:space-between;color:#5f5d73;font-size:8px;padding:25px 2px 5px}
@media(max-width:1100px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.content{padding:30px 25px}.lower{grid-template-columns:1fr}}
@media(max-width:700px){.sidebar{transform:translateX(-100%);transition:transform .22s;width:260px;box-shadow:20px 0 50px #0008}.sidebar.open{transform:translateX(0)}.close,.hamb{display:grid}.hamb{background:none;border:0;color:#aaa;padding:0}.main-area,main{margin-left:0}.topbar{padding:0 15px;height:60px}.crumb{gap:8px}.top-right{gap:8px}.api{font-size:0;padding:8px}.api i{margin:0}.content{padding:26px 15px}.welcome{align-items:flex-start;gap:12px;flex-direction:column}.welcome h1{font-size:26px}.stats{gap:9px}.stat{padding:13px}.stat strong{font-size:23px}.server-bottom{flex-wrap:wrap;gap:14px}.resource{width:calc(50% - 10px)}.server-buttons{width:100%;margin:0}.server-buttons button{flex:1;justify-content:center}.server-name small{flex-wrap:wrap}.lower{gap:10px}footer{gap:10px;flex-wrap:wrap}}
@media(max-width:390px){.stats{grid-template-columns:1fr}.crumb span,.crumb i{display:none}}
EOF

cat > backend/package.json <<'EOF'
{
  "name": "lumen-panel-api",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": { "dev": "nodemon src/server.js", "start": "node src/server.js" },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "helmet": "^8.0.0"
  },
  "devDependencies": { "nodemon": "^3.1.7" }
}
EOF

cat > backend/src/server.js <<'EOF'
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(helmet());
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    name: "Lumen Panel API",
    status: "online",
    version: "0.1.0",
    timestamp: new Date().toISOString()
  });
});

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Lumen Panel API listening on port ${port}`);
});
EOF

cat > backend/.env.example <<'EOF'
PORT=3000
FRONTEND_URL=http://localhost:5173
EOF

cat > .gitignore <<'EOF'
node_modules/
frontend/dist/
backend/.env
.env
.DS_Store
*.log
EOF

cat > README.md <<'EOF'
# Lumen Panel

An original Minecraft hosting control-panel interface with a custom Lumen design.

## Current build
- React + Vite dashboard
- Responsive purple/blue dark interface
- Express API health endpoint
- Demo server and resource values (not connected to a real host)

## Requirements
Node.js 20.19+ or 22.12+ and npm.

## Run in Codespaces
From the repository root:

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
npm run dev
```

Open forwarded port 5173 for the dashboard and port 3000 for the API health endpoint at /api/health.

## Planned architecture
- React/Vite frontend
- Node.js/Express API
- PostgreSQL for persistent data
- Redis for queues/cache
- Pterodactyl Wings on a separate Linux node

The dashboard currently uses illustrative data. Start/stop buttons are UI demonstrations only until secure node integration is implemented.

Never expose Docker, Wings credentials, node secrets, or host-level commands in browser code.
EOF

echo "Lumen Panel files created."
echo "Next: npm install && npm install --prefix frontend && npm install --prefix backend"
