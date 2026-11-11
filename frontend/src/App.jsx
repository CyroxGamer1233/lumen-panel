import { useEffect, useState } from "react";
import AuthScreen from "./AuthScreen.jsx";
import { Activity, Cpu, HardDrive, LayoutDashboard, LogOut, MemoryStick, Menu, Server, Terminal, Wifi, Zap } from "lucide-react";

export default function App() {
  const [active, setActive] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking");
  const [authStatus, setAuthStatus] = useState("checking");
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(async response => {
        if (!response.ok) throw new Error("Signed out");
        const data = await response.json();
        setUser(data.user);
        setAuthStatus("signed-in");
        const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include" });
        if (csrfResponse.ok) setCsrfToken((await csrfResponse.json()).csrfToken);
      })
      .catch(() => setAuthStatus("signed-out"));

    fetch("/api/health")
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(() => setApiStatus("online"))
      .catch(() => setApiStatus("offline"));
  }, []);

  const handleAuthenticated = (nextUser, nextCsrfToken) => {
    setUser(nextUser);
    setCsrfToken(nextCsrfToken || "");
    setAuthStatus("signed-in");
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": csrfToken }
      });
    } finally {
      setUser(null);
      setCsrfToken("");
      setAuthStatus("signed-out");
    }
  };

  if (authStatus === "checking") {
    return <div className="auth-shell"><div className="auth-brand"><div className="auth-brand-icon"><Zap size={22}/></div><strong>LUMEN<span>.</span></strong></div></div>;
  }
  if (authStatus !== "signed-in") return <AuthScreen onAuthenticated={handleAuthenticated} />;

  const goTo = (page) => {
    setActive(page);
    setMenuOpen(false);
  };

  return (
    <div className="app-shell lumen-clean">
      <aside className={"sidebar " + (menuOpen ? "sidebar-open" : "")}>
        <div className="brand">
          <div className="brand-mark"><Zap size={19} fill="currentColor"/></div>
          <div className="brand-name">LUMEN<span>.</span></div>
          <button className="icon-button mobile-close" onClick={() => setMenuOpen(false)}>×</button>
        </div>
        <div className="clean-nav-label">WORKSPACE</div>
        <button className={"nav-item " + (active === "Overview" ? "active" : "")} onClick={() => goTo("Overview")}><LayoutDashboard size={17}/><span>Overview</span></button>
        <button className={"nav-item " + (active === "Servers" ? "active" : "")} onClick={() => goTo("Servers")}><Server size={17}/><span>Servers</span><em>1</em></button>
        <div className="sidebar-bottom clean-profile">
          <div className="profile-avatar">{user?.name?.[0]?.toUpperCase() || "L"}</div>
          <div className="profile-copy"><b>{user?.name || "Lumen user"}</b><small>{user?.role === "admin" ? "Admin" : "Member"}</small></div>
          <button className="icon-button" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={16}/></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar clean-topbar">
          <div className="top-left">
            <button className="icon-button menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu"><Menu size={19}/></button>
            <b>{active}</b>
          </div>
          <div className="top-actions"><div className="system-pill"><span className={"status-dot " + (apiStatus === "online" ? "green" : apiStatus === "offline" ? "red" : "")}></span> API {apiStatus}</div></div>
        </header>

        <div className="page-content clean-content">
          {active === "Overview" ? (
            <>
              <div className="clean-page-heading"><div><h1>Overview</h1><p>Your game servers at a glance.</p></div></div>
              <section className="stats-grid clean-stats">
                <div className="stat-card"><div className="clean-stat-icon"><Server size={17}/></div><div className="clean-stat-label">SERVERS</div><div className="stat-value">1 <small>/ 5</small></div></div>
                <div className="stat-card"><div className="clean-stat-icon"><Cpu size={17}/></div><div className="clean-stat-label">CPU</div><div className="stat-value">12.4<small>%</small></div><div className="mini-meter"><i style={{width:"12.4%"}}/></div></div>
                <div className="stat-card"><div className="clean-stat-icon"><MemoryStick size={17}/></div><div className="clean-stat-label">MEMORY</div><div className="stat-value">2.1 <small>GB</small></div><div className="mini-meter"><i style={{width:"42%"}}/></div></div>
                <div className="stat-card"><div className="clean-stat-icon"><HardDrive size={17}/></div><div className="clean-stat-label">STORAGE</div><div className="stat-value">8.6 <small>GB</small></div><div className="mini-meter"><i style={{width:"28%"}}/></div></div>
              </section>
              <div className="clean-section-heading"><h2>Your servers</h2><span>1 server</span></div>
              <section className="server-card clean-server-card">
                <div className="server-main">
                  <div className="game-icon"><Server size={22}/></div>
                  <div className="server-info"><div className="server-title-row"><h3>Lumen SMP</h3><span className="server-status stopped"><span/>Not connected</span></div><p>Minecraft Java · Paper</p><div className="server-meta"><span><Wifi size={14}/> Node not connected</span><span>0 / 10 players</span></div></div>
                  <button className="clean-open-button" onClick={() => goTo("Servers")}>Manage <span>→</span></button>
                </div>
              </section>
            </>
          ) : (
            <>
              <div className="clean-page-heading"><div><h1>Lumen SMP</h1><p>Minecraft Java · Paper · 1.21.x</p></div><span className="server-status stopped"><span/>Node offline</span></div>
              <section className="server-card clean-detail-card">
                <div className="clean-detail-top"><div className="game-icon"><Server size={22}/></div><div><h2>Server console</h2><p>Connect a Linux node to enable server controls.</p></div></div>
                <div className="clean-console"><div className="clean-console-bar"><span/><span/><span/><b>CONSOLE</b></div><div className="clean-console-body"><Terminal size={22}/><strong>No node connected</strong><p>Console output will appear here when a node is connected.</p></div></div>
              </section>
              <section className="clean-resource-grid">
                <div className="stat-card"><div className="clean-stat-icon"><Cpu size={17}/></div><div className="clean-stat-label">CPU USAGE</div><div className="stat-value">12<small>%</small></div></div>
                <div className="stat-card"><div className="clean-stat-icon"><MemoryStick size={17}/></div><div className="clean-stat-label">MEMORY</div><div className="stat-value">1.2 <small>/ 3 GB</small></div></div>
                <div className="stat-card"><div className="clean-stat-icon"><Activity size={17}/></div><div className="clean-stat-label">PLAYERS</div><div className="stat-value">0 <small>/ 10</small></div></div>
              </section>
            </>
          )}
          <footer className="clean-footer">Lumen Panel <span>·</span> Development preview</footer>
        </div>
      </main>
    </div>
  );
}
