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
  const [nodes, setNodes] = useState([]);
  const [nodeName, setNodeName] = useState("");
  const [nodeToken, setNodeToken] = useState("");
  const [nodesLoading, setNodesLoading] = useState(false);
  const [nodesError, setNodesError] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [nodeRefreshing, setNodeRefreshing] = useState(false);

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

  const loadNodes = async (showLoader = true) => {
    if (showLoader) setNodesLoading(true);
    setNodesError("");
    try {
      const response = await fetch("/api/admin/nodes", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load nodes.");
      setNodes(data.nodes || []);
      return data.nodes || [];
    } catch (error) {
      setNodesError(error.message);
      return null;
    } finally {
      if (showLoader) setNodesLoading(false);
    }
  };

  useEffect(() => {
    if (active === "Nodes" && user?.role === "admin") loadNodes();
  }, [active, user?.role]);

  const refreshNodeDetails = async () => {
    setNodeRefreshing(true);
    await loadNodes(false);
    setNodeRefreshing(false);
  };

  const createNode = async (event) => {
    event.preventDefault();
    setNodesError("");
    setNodeToken("");
    try {
      const response = await fetch("/api/admin/nodes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ name: nodeName })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create node.");
      setNodeToken(data.token);
      setNodeName("");
      await loadNodes(false);
    } catch (error) {
      setNodesError(error.message);
    }
  };

  const disableNode = async (id) => {
    setNodesError("");
    try {
      const response = await fetch(`/api/admin/nodes/${id}/disable`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": csrfToken }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not disable node.");
      setNodes(current => current.map(node => node.id === id ? { ...node, enabled: false, status: "disabled" } : node));
    } catch (error) {
      setNodesError(error.message);
    }
  };

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
        {user?.role === "admin" && <button className={"nav-item " + (active === "Nodes" ? "active" : "")} onClick={() => goTo("Nodes")}><Wifi size={17}/><span>Nodes</span></button>}
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
          {active === "Nodes" && user?.role === "admin" ? (
            <>
              {selectedNodeId === null ? <>
                <div className="clean-page-heading"><div><h1>Nodes</h1><p>Manage your Linux host connections.</p></div></div>
                <section className="server-card clean-node-create">
                  <form onSubmit={createNode}>
                    <label htmlFor="node-name">New node</label>
                    <div className="clean-node-form-row">
                      <input id="node-name" value={nodeName} onChange={event => setNodeName(event.target.value)} minLength={2} maxLength={60} placeholder="e.g. Lucknow Node 1" required />
                      <button className="clean-open-button" type="submit">Create node</button>
                    </div>
                  </form>
                  {nodeToken && <div className="clean-token-box"><strong>Node token — copy it now</strong><code>{nodeToken}</code><p>This token is shown once. Store it securely on your Linux node.</p><button type="button" className="clean-copy-button" onClick={() => navigator.clipboard?.writeText(nodeToken)}>Copy token</button></div>}
                  {nodesError && <p className="clean-node-error">{nodesError}</p>}
                </section>
                <div className="clean-section-heading"><h2>Registered nodes</h2><span>{nodes.length} total</span></div>
                {nodesLoading ? <div className="clean-empty-node">Loading nodes…</div> : nodes.length === 0 ? <div className="clean-empty-node">No nodes registered yet.</div> : (
                  <div className="clean-node-list">
                    {nodes.map(node => (
                      <section className="server-card clean-node-card" key={node.id}>
                        <div><strong>{node.name}</strong><p>{node.agent_version ? `Agent ${node.agent_version}` : "Agent not detected"} · {node.last_seen_at ? new Date(node.last_seen_at).toLocaleString() : "Never connected"}</p></div>
                        <span className={"clean-node-status " + node.status}>{node.status}</span>
                        <button type="button" className="clean-node-open-button" onClick={() => setSelectedNodeId(node.id)}>Details →</button>
                        {node.enabled && <button type="button" className="clean-disable-button" onClick={() => disableNode(node.id)}>Disable</button>}
                      </section>
                    ))}
                  </div>
                )}
              </> : (() => {
                const node = nodes.find(item => String(item.id) === String(selectedNodeId));
                if (!node) return <div className="clean-empty-node"><p>Node not found.</p><button className="clean-back-button" onClick={() => setSelectedNodeId(null)}>Back to nodes</button></div>;
                return <>
                  <div className="clean-node-detail-heading">
                    <button type="button" className="clean-back-button" onClick={() => setSelectedNodeId(null)}>← Back to nodes</button>
                    <button type="button" className="clean-refresh-button" onClick={refreshNodeDetails} disabled={nodeRefreshing}>{nodeRefreshing ? "Refreshing…" : "↻ Refresh"}</button>
                  </div>
                  <section className="server-card clean-node-detail-card">
                    <div className="clean-node-detail-main">
                      <div className="game-icon"><Wifi size={22}/></div>
                      <div><h1>{node.name}</h1><p>Node connection details</p></div>
                      <span className={"clean-node-status " + node.status}>{node.status}</span>
                    </div>
                    <div className="clean-node-detail-grid">
                      <div><span>NODE ID</span><strong>#{node.id}</strong></div>
                      <div><span>AGENT VERSION</span><strong>{node.agent_version || "Not detected"}</strong></div>
                      <div><span>LAST HEARTBEAT</span><strong>{node.last_seen_at ? new Date(node.last_seen_at).toLocaleString() : "Never connected"}</strong></div>
                      <div><span>CREATED</span><strong>{node.created_at ? new Date(node.created_at).toLocaleString() : "—"}</strong></div>
                    </div>
                    <div className="clean-node-detail-footer">
                      <p>{node.status === "online" ? "The agent is sending heartbeats to Lumen Panel." : node.status === "disabled" ? "This node has been disabled." : "No recent heartbeat received. Check that the agent is running."}</p>
                      {node.enabled && <button type="button" className="clean-disable-button" onClick={() => disableNode(node.id)}>Disable node</button>}
                    </div>
                  </section>
                </>;
              })()}

            </>
          ) : active === "Overview" ? (
            <>
              <div className="clean-page-heading"><div><h1>Overview</h1><p>Your game servers at a glance.</p></div></div>
              <section className="stats-grid clean-stats">
                <div className="stat-card"><div className="clean-stat-icon"><Server size={17}/></div><div className="clean-stat-label">SERVERS</div><div className="stat-value">1 <small>/ 5</small></div></div>
                <div className="stat-card"><div className="clean-stat-icon"><Cpu size={17}/></div><div className="clean-stat-label">CPU</div><div className="stat-value">—</div></div>
                <div className="stat-card"><div className="clean-stat-icon"><MemoryStick size={17}/></div><div className="clean-stat-label">MEMORY</div><div className="stat-value">—</div></div>
                <div className="stat-card"><div className="clean-stat-icon"><HardDrive size={17}/></div><div className="clean-stat-label">STORAGE</div><div className="stat-value">—</div></div>
              </section>
              <div className="clean-section-heading"><h2>Your servers</h2><span>1 server</span></div>
              <section className="server-card clean-server-card">
                <div className="server-main">
                  <div className="game-icon"><Server size={22}/></div>
                  <div className="server-info"><div className="server-title-row"><h3>Lumen SMP</h3><span className="server-status stopped"><span/>Not connected</span></div><p>Minecraft Java · Paper</p><div className="server-meta"><span><Wifi size={14}/> No node assigned</span><span>0 / 10 players</span></div></div>
                  <button className="clean-open-button" onClick={() => goTo("Servers")}>Manage <span>→</span></button>
                </div>
              </section>
            </>
          ) : (
            <>
              <div className="clean-page-heading"><div><h1>Lumen SMP</h1><p>Minecraft Java · Paper · 1.21.x</p></div><span className="server-status stopped"><span/>No node assigned</span></div>
              <section className="server-card clean-detail-card">
                <div className="clean-detail-top"><div className="game-icon"><Server size={22}/></div><div><h2>Server console</h2><p>Connect a Linux node to enable server controls.</p></div></div>
                <div className="clean-console"><div className="clean-console-bar"><span/><span/><span/><b>CONSOLE</b></div><div className="clean-console-body"><Terminal size={22}/><strong>No node connected</strong><p>Console output will appear here when a node is connected.</p></div></div>
              </section>
              <section className="clean-resource-grid">
                <div className="stat-card"><div className="clean-stat-icon"><Cpu size={17}/></div><div className="clean-stat-label">CPU USAGE</div><div className="stat-value">—</div></div>
                <div className="stat-card"><div className="clean-stat-icon"><MemoryStick size={17}/></div><div className="clean-stat-label">MEMORY</div><div className="stat-value">—</div></div>
                <div className="stat-card"><div className="clean-stat-icon"><Activity size={17}/></div><div className="clean-stat-label">PLAYERS</div><div className="stat-value">—</div></div>
              </section>
            </>
          )}
          <footer className="clean-footer">Lumen Panel <span>·</span> Development preview</footer>
        </div>
      </main>
    </div>
  );
}
