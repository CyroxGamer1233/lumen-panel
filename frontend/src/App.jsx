import { useEffect, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowUpRight, Bell, Box, ChevronDown,
  CircleHelp, Cloud, Command, Cpu, Database, FileText, Gauge, HardDrive,
  LayoutDashboard, LifeBuoy, Menu, MoreHorizontal, Play, Plus, Power,
  RefreshCw, Search, Server, Settings, ShieldCheck, Terminal, Users,
  Wifi, Zap
} from "lucide-react";

const navGroups = [
  { title: "WORKSPACE", items: [
    ["Overview", LayoutDashboard], ["Servers", Server], ["Databases", Database], ["Backups", HardDrive]
  ]},
  { title: "MANAGEMENT", items: [
    ["Users", Users], ["Nodes", Box], ["Activity", Activity], ["Settings", Settings]
  ]}
];

function App() {
  const [active, setActive] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking");
  const [serverState, setServerState] = useState("Running");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/health")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => setApiStatus("online"))
      .catch(() => setApiStatus("offline"));
  }, []);

  const choose = (name) => {
    setActive(name);
    setMenuOpen(false);
    if (name !== "Overview") setNotice(name + " section is coming in the next build.");
    else setNotice("");
  };

  const toggleServer = () => {
    setServerState(s => s === "Running" ? "Stopped" : "Starting");
    setNotice("Demo control only — connect a Wings node to control a real server.");
    if (serverState !== "Running") setTimeout(() => setServerState("Running"), 1400);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Zap size={21} fill="currentColor" /></div>
          <div><div className="brand-name">LUMEN<span>.</span></div><div className="brand-sub">CONTROL CENTER</div></div>
          <button className="icon-button mobile-close" onClick={() => setMenuOpen(false)}>×</button>
        </div>
        <button className="workspace-switch">
          <div className="workspace-avatar">L</div>
          <div className="workspace-copy"><b>Lumen Workspace</b><small>Personal workspace</small></div>
          <ChevronDown size={15} />
        </button>
        <div className="nav-search"><Search size={15}/><span>Quick search</span><kbd>⌘ K</kbd></div>
        {navGroups.map(group => <div className="nav-group" key={group.title}>
          <div className="nav-heading">{group.title}</div>
          {group.items.map(([name, Icon]) => <button key={name} onClick={() => choose(name)} className={`nav-item ${active === name ? "active" : ""}`}>
            <Icon size={17}/><span>{name}</span>{name === "Servers" && <em>1</em>}
          </button>)}
        </div>)}
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><LifeBuoy size={17}/></div><b>Need a hand?</b><p>Explore the docs and learn your way around Lumen.</p><button onClick={() => setNotice("Documentation will be added soon.")}>Open documentation <ArrowUpRight size={13}/></button></div>
          <div className="profile-row"><div className="profile-avatar">S</div><div className="profile-copy"><b>Workspace Owner</b><small>Administrator</small></div><MoreHorizontal size={18}/></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="top-left"><button className="icon-button menu-toggle" onClick={() => setMenuOpen(!menuOpen)}><Menu size={19}/></button><span className="crumb-muted">Workspace</span><span className="crumb-sep">/</span><b>{active}</b></div>
          <div className="top-actions"><div className="system-pill"><span className={`status-dot ${apiStatus === "online" ? "green" : apiStatus === "offline" ? "red" : ""}`}></span> API {apiStatus}</div><button className="icon-button"><Bell size={18}/><i></i></button><div className="top-avatar">S</div></div>
        </header>

        <div className="page-content">
          <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"></span> YOUR CONTROL CENTER</div><h1>{active === "Overview" ? "Good afternoon." : active + "."}</h1><p className="subtitle">Here’s what’s happening with your infrastructure today.</p></div><button className="primary-button" onClick={() => setNotice("Server provisioning will be enabled after node integration.")}><Plus size={17}/> Create server</button></div>
          {notice && <div className="notice"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}

          <section className="stats-grid">
            <div className="stat-card"><div className="stat-top"><span>ACTIVE SERVERS</span><span className="stat-icon purple"><Server size={17}/></span></div><div className="stat-value">01 <small> / 05</small></div><div className="stat-foot"><span className="tiny-dot"></span> 1 server configured</div></div>
            <div className="stat-card"><div className="stat-top"><span>CPU USAGE</span><span className="stat-icon blue"><Cpu size={17}/></span></div><div className="stat-value">12.4<small>%</small></div><div className="mini-meter"><i style={{width:"12.4%"}}></i></div><div className="stat-foot">Across connected nodes · Demo data</div></div>
            <div className="stat-card"><div className="stat-top"><span>MEMORY</span><span className="stat-icon violet"><Gauge size={17}/></span></div><div className="stat-value">2.1 <small>GB</small></div><div className="mini-meter"><i style={{width:"42%"}}></i></div><div className="stat-foot">Of 5 GB allocated · Demo data</div></div>
            <div className="stat-card"><div className="stat-top"><span>STORAGE</span><span className="stat-icon cyan"><HardDrive size={17}/></span></div><div className="stat-value">8.6 <small>GB</small></div><div className="mini-meter"><i style={{width:"28%"}}></i></div><div className="stat-foot">Of 30 GB allocated · Demo data</div></div>
          </section>

          <div className="section-heading"><div><h2>Your servers</h2><p>Manage and monitor your game instances.</p></div><button className="text-button" onClick={() => choose("Servers")}>View all <ArrowUpRight size={15}/></button></div>
          <section className="server-card">
            <div className="server-main">
              <div className="game-icon"><Box size={24}/></div>
              <div className="server-info"><div className="server-title-row"><h3>Lumen SMP</h3><span className={`server-status ${serverState === "Running" ? "running" : "stopped"}`}><span></span>{serverState}</span></div><p>minecraft-java · Paper · Survival</p><div className="server-meta"><span><Wifi size={14}/> Not connected to a node</span><span><Users size={14}/> 0 / 10 players</span></div></div>
              <button className="more-button"><MoreHorizontal size={20}/></button>
            </div>
            <div className="server-bottom"><div className="server-metrics"><div><span>CPU</span><b>12%</b></div><div className="metric-track"><i style={{width:"12%"}}/></div></div><div className="server-metrics"><div><span>MEMORY</span><b>1.2 / 3 GB</b></div><div className="metric-track"><i style={{width:"40%"}}/></div></div><div className="server-actions"><button className="server-action" onClick={() => setNotice("Console is a UI preview until a node is connected.")}><Terminal size={15}/> Console</button><button className="server-action play" onClick={toggleServer}>{serverState === "Running" ? <Power size={15}/> : <Play size={15}/>} {serverState === "Running" ? "Stop" : "Start"}</button></div></div>
          </section>

          <div className="lower-grid">
            <section className="panel-card"><div className="panel-title"><div><h2>Resource activity</h2><p>Node performance over time</p></div><button className="period-select">Last 24 hours <ChevronDown size={14}/></button></div><div className="chart-wrap"><div className="chart-y"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div className="chart"><div className="chart-grid"><i/><i/><i/><i/><i/></div><svg viewBox="0 0 600 170" preserveAspectRatio="none" aria-label="Illustrative resource usage chart"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8b70ff" stopOpacity=".28"/><stop offset="100%" stopColor="#8b70ff" stopOpacity="0"/></linearGradient></defs><path d="M0 125 C35 118 38 90 75 102 S125 120 150 86 S200 96 225 75 S270 91 300 65 S345 83 375 70 S425 94 450 60 S500 76 525 48 S570 63 600 38 L600 170 L0 170Z" fill="url(#area)"/><path d="M0 125 C35 118 38 90 75 102 S125 120 150 86 S200 96 225 75 S270 91 300 65 S345 83 375 70 S425 94 450 60 S500 76 525 48 S570 63 600 38" fill="none" stroke="#9a83ff" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/></svg><div className="chart-x"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Now</span></div></div></div><div className="chart-legend"><span><i className="legend-purple"/> CPU usage</span><span><i className="legend-blue"/> Memory usage</span><small>Illustrative preview data</small></div></section>
            <section className="panel-card activity-card"><div className="panel-title"><div><h2>Recent activity</h2><p>Latest workspace events</p></div><button className="icon-button"><MoreHorizontal size={18}/></button></div><div className="activity-list"><div className="activity-item"><div className="activity-icon green-bg"><Power size={15}/></div><div><b>Server status preview</b><p>Lumen SMP marked as {serverState.toLowerCase()}</p><small>Just now · Local demo</small></div></div><div className="activity-item"><div className="activity-icon purple-bg"><Command size={15}/></div><div><b>Workspace initialized</b><p>Lumen Panel project created</p><small>Today · Setup</small></div></div><div className="activity-item"><div className="activity-icon blue-bg"><Cloud size={15}/></div><div><b>API health check</b><p>{apiStatus === "online" ? "Backend connection successful" : "Waiting for backend connection"}</p><small>Today · System</small></div></div></div><button className="activity-link" onClick={() => choose("Activity")}>View activity log <ArrowUpRight size={14}/></button></section>
          </div>
          <footer className="footer"><span>© 2026 Lumen Panel</span><span><span className="footer-dot"></span> Built for your servers</span><span>Version 0.1.0 · Preview</span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;
