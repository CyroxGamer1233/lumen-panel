import { useEffect, useState } from "react";
import AuthScreen from "./AuthScreen.jsx";
import { Activity, AlertCircle, CheckCircle2, Cpu, HardDrive, LayoutDashboard, LogOut, MemoryStick, Menu, Plug, RefreshCw, Server, Terminal, Wifi, Zap } from "lucide-react";

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return bytes + " B";
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return size.toFixed(1) + " " + units[index];
}

function formatDuration(value) {
  const seconds = Math.max(0, Number(value) || 0);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days + "d " + hours + "h " + minutes + "m";
}
function averageHistory(points, key) {
  const values = points.map(point => point[key] == null || point[key] === "" ? NaN : Number(point[key])).filter(Number.isFinite);
  return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : "—";
}

function peakHistory(points, key) {
  const values = points.map(point => point[key] == null || point[key] === "" ? NaN : Number(point[key])).filter(Number.isFinite);
  return values.length ? Math.max(...values).toFixed(1) : "—";
}

function MetricHistoryChart({ title, points, series, maxValue = 100, unit = "%" }) {
  const width = 600;
  const left = 42;
  const right = 590;
  const top = 14;
  const bottom = 150;
  const yFor = value => bottom - (Math.max(0, Math.min(maxValue, Number(value))) / maxValue) * (bottom - top);
  const xFor = index => points.length <= 1 ? (left + right) / 2 : left + (index / (points.length - 1)) * (right - left);
  const startLabel = points.length ? new Date(points[0].bucket_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const endLabel = points.length ? new Date(points[points.length - 1].bucket_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div className="clean-history-chart">
      <div className="clean-history-chart-heading"><strong>{title}</strong><span>{unit === "%" ? "0–100%" : `Scale 0–${maxValue}`}</span></div>
      <svg viewBox={`0 0 ${width} 174`} role="img" aria-label={`${title} historical graph`}>
        {[0, 25, 50, 75, 100].map(tick => {
          const value = maxValue * tick / 100;
          const y = yFor(value);
          return <g key={tick}><line x1={left} y1={y} x2={right} y2={y} className="clean-history-grid-line"/><text x="4" y={y + 3} className="clean-history-axis-label">{Math.round(value)}{unit}</text></g>;
        })}
        {series.map(item => {
          const coordinates = points.map((point, index) => {
            const rawValue = point[item.key];
            const value = rawValue == null || rawValue === "" ? NaN : Number(rawValue);
            return Number.isFinite(value) ? `${xFor(index)},${yFor(value)}` : null;
          }).filter(Boolean).join(" ");
          return (
            <g key={item.key}>
              <polyline points={coordinates} className={`clean-history-line ${item.className}`} />
              {points.map((point, index) => {
                const rawValue = point[item.key];
                const value = rawValue == null || rawValue === "" ? NaN : Number(rawValue);
                return Number.isFinite(value) ? <circle key={index} cx={xFor(index)} cy={yFor(value)} r="2.5" className={`clean-history-point ${item.className}`} /> : null;
              })}
            </g>
          );
        })}
      </svg>
      <div className="clean-history-time-labels"><span>{startLabel}</span><span>{endLabel}</span></div>
      <div className="clean-history-legend">{series.map(item => <span key={item.key}><i className={item.className}></i>{item.label}</span>)}</div>
    </div>
  );
}

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
  const [nodeEvents, setNodeEvents] = useState([]);
  const [nodeEventsLoading, setNodeEventsLoading] = useState(false);
  const [nodeEventsError, setNodeEventsError] = useState("");
  const [nodeAlerts, setNodeAlerts] = useState([]);
  const [nodeAlertsLoading, setNodeAlertsLoading] = useState(false);
  const [nodeAlertsError, setNodeAlertsError] = useState("");
  const [nodeMetricsHistory, setNodeMetricsHistory] = useState([]);
  const [nodeMetricsHistoryLoading, setNodeMetricsHistoryLoading] = useState(false);
  const [nodeMetricsHistoryError, setNodeMetricsHistoryError] = useState("");
  const [nodeMetricsRange, setNodeMetricsRange] = useState("24h");
  const [nodeMetricsHistoryNodeId, setNodeMetricsHistoryNodeId] = useState(null);
  const [nodesUpdatedAt, setNodesUpdatedAt] = useState(null);
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState(null);
  const [serversLoading, setServersLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [serverDraft, setServerDraft] = useState({ name: "", software: "Paper", version: "1.21.4", memoryMb: "2048", diskGb: "10", nodeId: "" });
  const [allocations, setAllocations] = useState([]);
  const [allocationDraft, setAllocationDraft] = useState({ nodeId: "", ip: "0.0.0.0", port: "25565" });
  const [allocationChoices, setAllocationChoices] = useState({});
  const [editingServerId, setEditingServerId] = useState(null);
  const [serverEditDraft, setServerEditDraft] = useState({});
  const [powerMessage, setPowerMessage] = useState("");
  const [powerLoading, setPowerLoading] = useState("");
  const [runtimeEvents, setRuntimeEvents] = useState([]);
  const [runtimeEventsLoading, setRuntimeEventsLoading] = useState(false);
  const [runtimeEventsError, setRuntimeEventsError] = useState("");
  const [pufferStatus, setPufferStatus] = useState(null);
  const [pufferLoading, setPufferLoading] = useState(false);
  const [pufferTesting, setPufferTesting] = useState(false);
  const [pufferMessage, setPufferMessage] = useState(null);

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
      setNodesUpdatedAt(new Date());
      return data.nodes || [];
    } catch (error) {
      setNodesError(error.message);
      return null;
    } finally {
      if (showLoader) setNodesLoading(false);
    }
  };

  useEffect(() => {
    if (active !== "Nodes" || user?.role !== "admin") return;
    loadNodes();
    const timer = window.setInterval(() => loadNodes(false), 30000);
    return () => window.clearInterval(timer);
  }, [active, user?.role]);

  const loadAllocations = async () => {
    try {
      const response = await fetch("/api/admin/allocations", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load allocations.");
      setAllocations(data.allocations || []);
    } catch (error) {
      setServerError(error.message);
    }
  };

  const createAllocation = async (event) => {
    event.preventDefault();
    setServerError("");
    try {
      const response = await fetch("/api/admin/allocations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ ...allocationDraft, nodeId: Number(allocationDraft.nodeId), port: Number(allocationDraft.port) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create allocation.");
      setAllocationDraft({ ...allocationDraft, port: String(Number(allocationDraft.port) + 1) });
      await loadAllocations();
    } catch (error) {
      setServerError(error.message);
    }
  };

  const assignAllocation = async (serverId) => {
    setServerError("");
    try {
      const response = await fetch(`/api/servers/${serverId}/allocation`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ allocationId: allocationChoices[serverId] || null })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not assign allocation.");
      await Promise.all([loadServers(), loadAllocations()]);
    } catch (error) {
      setServerError(error.message);
    }
  };

  const saveServerConfig = async (event, serverId) => {
    event.preventDefault();
    setServerError("");
    try {
      const draft = serverEditDraft;
      const response = await fetch(`/api/servers/${serverId}/config`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ ...draft, memoryMb: Number(draft.memoryMb), diskGb: Number(draft.diskGb) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update configuration.");
      setEditingServerId(null);
      await loadServers();
    } catch (error) {
      setServerError(error.message);
    }
  };

  const loadServers = async () => {
    setServersLoading(true);
    setServerError("");
    try {
      const response = await fetch("/api/servers", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load servers.");
      setServers(data.servers || []);
    } catch (error) {
      setServerError(error.message);
    } finally {
      setServersLoading(false);
    }
  };

  useEffect(() => {
    if (active !== "Servers" && active !== "Overview") return;
    loadServers();
    if (user?.role === "admin") { loadNodes(false); loadAllocations(); }
  }, [active, user?.role]);

  const loadRuntimeEvents = async (serverId = selectedServerId) => {
    if (!serverId) return;
    setRuntimeEvents([]);
    setRuntimeEventsLoading(true);
    setRuntimeEventsError("");
    try {
      const response = await fetch(`/api/servers/${serverId}/events`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load activity history.");
      setRuntimeEvents(data.events || []);
    } catch (error) {
      setRuntimeEventsError(error.message);
    } finally {
      setRuntimeEventsLoading(false);
    }
  };

  useEffect(() => {
    if (active !== "Server Details" || !selectedServerId) return;
    loadRuntimeEvents(selectedServerId);
  }, [active, selectedServerId]);

  const createServer = async (event) => {
    event.preventDefault();
    setServerError("");
    try {
      const response = await fetch("/api/servers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          ...serverDraft,
          memoryMb: Number(serverDraft.memoryMb),
          diskGb: Number(serverDraft.diskGb),
          nodeId: serverDraft.nodeId || null
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create server.");
      setServerDraft({ name: "", software: "Paper", version: "1.21.4", memoryMb: "2048", diskGb: "10", nodeId: "" });
      await loadServers();
    } catch (error) {
      setServerError(error.message);
    }
  };

  const requestPowerAction = async (action) => {
    setPowerMessage("");
    setPowerLoading(action);
    try {
      const response = await fetch(`/api/servers/${selectedServerId}/power`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ action })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Power controls are unavailable.");
      setPowerMessage("Action request accepted.");
    } catch (error) {
      setPowerMessage(error.message);
    } finally {
      setPowerLoading("");
    }
  };

  const loadNodeAlerts = async (nodeId = selectedNodeId) => {
    if (nodeId === null) return;
    setNodeAlertsLoading(true);
    setNodeAlertsError("");
    try {
      const response = await fetch(`/api/admin/nodes/${nodeId}/alerts`, { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load node alerts.");
      setNodeAlerts(data.alerts || []);
    } catch (error) {
      setNodeAlertsError(error.message);
      setNodeAlerts([]);
    } finally {
      setNodeAlertsLoading(false);
    }
  };

  const loadNodeMetricsHistory = async (nodeId = selectedNodeId, range = nodeMetricsRange) => {
    if (nodeId === null) return;
    setNodeMetricsHistoryLoading(true);
    setNodeMetricsHistoryError("");
    try {
      const response = await fetch(`/api/admin/nodes/${nodeId}/metrics-history?range=${encodeURIComponent(range)}`, { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load performance history.");
      setNodeMetricsHistory(data.points || []);
      setNodeMetricsHistoryNodeId(String(nodeId));
    } catch (error) {
      setNodeMetricsHistoryError(error.message);
      setNodeMetricsHistory([]);
      setNodeMetricsHistoryNodeId(String(nodeId));
    } finally {
      setNodeMetricsHistoryLoading(false);
    }
  };

  const loadNodeEvents = async (nodeId = selectedNodeId) => {
    if (!nodeId) return;
    setNodeEvents([]);
    setNodeEventsLoading(true);
    setNodeEventsError("");
    try {
      const response = await fetch(`/api/admin/nodes/${nodeId}/events`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load node activity.");
      setNodeEvents(data.events || []);
    } catch (error) {
      setNodeEventsError(error.message);
    } finally {
      setNodeEventsLoading(false);
    }
  };

  useEffect(() => {
    if (active !== "Nodes" || user?.role !== "admin" || selectedNodeId === null) return;
    loadNodeEvents(selectedNodeId);
    loadNodeAlerts(selectedNodeId);
    loadNodeMetricsHistory(selectedNodeId, nodeMetricsRange);
    const timer = window.setInterval(() => loadNodeMetricsHistory(selectedNodeId, nodeMetricsRange), 30000);
    return () => window.clearInterval(timer);
  }, [active, user?.role, selectedNodeId, nodeMetricsRange]);

  const refreshNodeDetails = async () => {
    setNodeRefreshing(true);
    await Promise.all([loadNodes(false), loadNodeMetricsHistory(selectedNodeId, nodeMetricsRange)]);
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

  const loadPufferStatus = async () => {
    setPufferLoading(true);
    setPufferMessage(null);
    try {
      const response = await fetch("/api/admin/integrations/pufferpanel", { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load integration status.");
      setPufferStatus(data.integration || null);
    } catch (error) {
      setPufferMessage({ type: "error", text: error.message });
    } finally {
      setPufferLoading(false);
    }
  };

  const testPufferConnection = async () => {
    setPufferTesting(true);
    setPufferMessage(null);
    try {
      const response = await fetch("/api/admin/integrations/pufferpanel/test", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": csrfToken }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Connection test failed.");
      setPufferMessage({ type: "success", text: "OAuth connection successful. Credentials were accepted." });
    } catch (error) {
      setPufferMessage({ type: "error", text: error.message });
    } finally {
      setPufferTesting(false);
      await loadPufferStatus();
    }
  };

  useEffect(() => {
    if (active === "PufferPanel" && user?.role === "admin") loadPufferStatus();
  }, [active, user?.role]);

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
        <button className={"nav-item " + (active === "Servers" ? "active" : "")} onClick={() => goTo("Servers")}><Server size={17}/><span>Servers</span><em>{servers.length}</em></button>
        {user?.role === "admin" && <button className={"nav-item " + (active === "Nodes" ? "active" : "")} onClick={() => goTo("Nodes")}><Wifi size={17}/><span>Nodes</span></button>}
        {user?.role === "admin" && <button className={"nav-item " + (active === "PufferPanel" ? "active" : "")} onClick={() => goTo("PufferPanel")}><Plug size={17}/><span>PufferPanel</span></button>}
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
          {active === "PufferPanel" && user?.role === "admin" ? (
            <section className="puffer-page">
              <div className="clean-page-heading">
                <div><h1>PufferPanel</h1><p>Connect your server engine to the Lumen control panel.</p></div>
                <button className="clean-node-open-button" type="button" onClick={loadPufferStatus} disabled={pufferLoading}>
                  <RefreshCw size={14} className={pufferLoading ? "puffer-spin" : ""}/> Refresh
                </button>
              </div>

              <section className="server-card puffer-connection-card">
                <div className="puffer-card-top">
                  <div className="puffer-brand-icon"><Plug size={20}/></div>
                  <div className="puffer-card-title"><h2>Connection status</h2><p>Secure server-side OAuth integration</p></div>
                  <span className={"puffer-status-pill " + (pufferStatus?.configured ? "configured" : "not-configured")}>
                    <span/> {pufferStatus?.configured ? "Configured" : "Not configured"}
                  </span>
                </div>
                <div className="puffer-details-grid">
                  <div><small>INSTANCE</small><strong>{pufferStatus?.hostname || "Not set"}</strong></div>
                  <div><small>AUTHENTICATION</small><strong>OAuth 2.0 · Client credentials</strong></div>
                  <div><small>INTEGRATION MODE</small><strong>Connection test only</strong></div>
                </div>
                {pufferStatus?.missing?.length > 0 && <div className="puffer-notice"><AlertCircle size={16}/><span>Missing server settings: {pufferStatus.missing.join(", ")}</span></div>}
                {pufferStatus?.error && <div className="puffer-notice"><AlertCircle size={16}/><span>{pufferStatus.error}</span></div>}
                {pufferMessage && <div className={"puffer-result " + pufferMessage.type}>{pufferMessage.type === "success" ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}<span>{pufferMessage.text}</span></div>}
                <div className="puffer-actions">
                  <button className="primary-button" type="button" onClick={testPufferConnection} disabled={!pufferStatus?.configured || pufferTesting || pufferLoading}>
                    {pufferTesting ? <><RefreshCw size={15} className="puffer-spin"/> Testing…</> : "Test connection"}
                  </button>
                </div>
              </section>

              <section className="server-card puffer-security-card">
                <div className="clean-section-heading"><h2>Security</h2><span>Protected</span></div>
                <ul>
                  <li>OAuth client credentials stay on the backend.</li>
                  <li>Access tokens are discarded after the connection test.</li>
                  <li>Only administrators can view status or run a test.</li>
                  <li>No server provisioning or power actions are enabled yet.</li>
                </ul>
              </section>
              <p className="puffer-footnote">Add PUFFERPANEL_URL, PUFFERPANEL_CLIENT_ID and PUFFERPANEL_CLIENT_SECRET to the backend environment. Never put these values in frontend code or chat.</p>
            </section>
          ) : active === "Nodes" && user?.role === "admin" ? (
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
                        <div><strong>{node.name}</strong><p>{node.agent_version ? `Agent ${node.agent_version}` : "Agent not detected"} · {node.last_seen_at ? new Date(node.last_seen_at).toLocaleString() : "Never connected"}</p><p className="clean-node-health-summary">Agent health: {node.effective_health_status || "unknown"}{Number(node.agent_consecutive_failures) > 0 ? ` · ${node.agent_consecutive_failures} failed checks` : ""}</p></div>
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
                    <div className="clean-node-refresh-meta"><span>Auto-refresh · 30s</span><small>{nodesUpdatedAt ? `Updated ${nodesUpdatedAt.toLocaleTimeString()}` : "Waiting for update"}</small></div>
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
                      <div><span>HEARTBEAT AGE</span><strong>{node.heartbeat_age_seconds == null ? "—" : node.heartbeat_age_seconds + "s ago"}</strong></div>
                      <div><span>AGENT HEALTH</span><strong className={"clean-health-value " + (node.effective_health_status || "unknown")}>{node.effective_health_status || "unknown"}</strong></div>
                      <div><span>CONSECUTIVE FAILURES</span><strong>{node.agent_consecutive_failures ?? 0}</strong></div>
                      <div><span>LAST HEALTH REPORT</span><strong>{node.agent_health_reported_at ? new Date(node.agent_health_reported_at).toLocaleString() : "No report yet"}</strong></div>
                      <div><span>HEALTH REPORT AGE</span><strong>{node.health_report_age_seconds == null ? "—" : node.health_report_age_seconds + "s ago"}</strong></div>
                      <div><span>LAST DIAGNOSTIC</span><strong>{node.agent_health_message || "No diagnostic message"}</strong></div>
                      <div><span>CREATED</span><strong>{node.created_at ? new Date(node.created_at).toLocaleString() : "—"}</strong></div>
                    </div>
                    <section className="clean-node-metrics">
                      <div className="clean-server-panel-heading">
                        <div><Cpu size={16}/><h2>Host resource telemetry</h2></div>
                        <span className={node.metrics_age_seconds == null || node.metrics_age_seconds > 90 ? "clean-metrics-stale" : "clean-metrics-live"}>
                          {node.metrics_age_seconds == null ? "No data" : node.metrics_age_seconds > 90 ? "Stale" : "Live"}
                        </span>
                      </div>
                      <p className="clean-form-note">Host-level readings reported by the node agent. These are not per-Minecraft-server metrics.</p>
                      <div className="clean-node-metrics-grid">
                        <div><span>CPU USAGE</span><strong>{node.cpu_usage_percent == null ? "Collecting…" : Number(node.cpu_usage_percent).toFixed(1) + "%"}</strong></div>
                        <div><span>MEMORY USED</span><strong>{node.memory_used_bytes == null || node.memory_total_bytes == null ? "—" : formatBytes(node.memory_used_bytes) + " / " + formatBytes(node.memory_total_bytes)}</strong></div>
                        <div><span>SYSTEM UPTIME</span><strong>{node.uptime_seconds == null ? "—" : formatDuration(node.uptime_seconds)}</strong></div>
                        <div><span>AGENT MEMORY</span><strong>{node.process_rss_bytes == null ? "—" : formatBytes(node.process_rss_bytes)}</strong></div>
                        <div><span>1-MIN LOAD AVERAGE</span><strong>{node.load_1m == null ? "—" : Number(node.load_1m).toFixed(2)}</strong></div>
                        <div><span>LAST METRICS REPORT</span><strong>{node.metrics_reported_at ? new Date(node.metrics_reported_at).toLocaleString() : "No report yet"}</strong></div>
                      </div>
                    </section>
                    <section className="clean-node-history">
                      <div className="clean-server-panel-heading clean-history-heading">
                        <div><Activity size={16}/><h2>Performance history</h2></div>
                        <div className="clean-history-actions">
                          {[["1h", "1H"], ["6h", "6H"], ["24h", "24H"], ["7d", "7D"]].map(([value, label]) => <button type="button" key={value} className={nodeMetricsRange === value ? "active" : ""} onClick={() => setNodeMetricsRange(value)}>{label}</button>)}
                          <button type="button" className="clean-refresh-button" onClick={() => loadNodeMetricsHistory(node.id, nodeMetricsRange)} disabled={nodeMetricsHistoryLoading}>{nodeMetricsHistoryLoading ? "Loading…" : "↻"}</button>
                        </div>
                      </div>
                      <p className="clean-form-note">Historical host readings. Samples are collected every 30 seconds and retained for 7 days.</p>
                      {nodeMetricsHistoryError && <p className="clean-node-error">{nodeMetricsHistoryError}</p>}
                      {nodeMetricsHistoryLoading && nodeMetricsHistoryNodeId !== String(node.id) ? <div className="clean-activity-empty">Loading performance history…</div> : nodeMetricsHistory.length === 0 || nodeMetricsHistoryNodeId !== String(node.id) ? <div className="clean-activity-empty">No historical samples yet. New reports will appear here; older readings are not backfilled.</div> : (
                        <>
                          <div className="clean-history-summary">
                            <div><span>AVG CPU</span><strong>{averageHistory(nodeMetricsHistory, "cpu_avg")}{averageHistory(nodeMetricsHistory, "cpu_avg") === "—" ? "" : "%"}</strong></div>
                            <div><span>PEAK CPU</span><strong>{peakHistory(nodeMetricsHistory, "cpu_max")}{peakHistory(nodeMetricsHistory, "cpu_max") === "—" ? "" : "%"}</strong></div>
                            <div><span>AVG MEMORY</span><strong>{averageHistory(nodeMetricsHistory, "memory_avg")}{averageHistory(nodeMetricsHistory, "memory_avg") === "—" ? "" : "%"}</strong></div>
                          </div>
                          <MetricHistoryChart title="CPU & memory usage" points={nodeMetricsHistory} series={[{ key: "cpu_avg", label: "CPU", className: "cpu" }, { key: "memory_avg", label: "Memory", className: "memory" }]} />
                          <MetricHistoryChart title="System load average" points={nodeMetricsHistory} series={[{ key: "load_avg", label: "1-minute load", className: "load" }]} maxValue={Math.max(1, Math.ceil(Math.max(...nodeMetricsHistory.map(point => Number(point.load_avg) || 0)) * 1.2))} unit="" />
                        </>
                      )}
                    </section>
                    <section className="clean-node-alerts">
                      <div className="clean-server-panel-heading">
                        <div><Activity size={16}/><h2>Alerts & diagnostics</h2></div>
                        <button type="button" className="clean-refresh-button" onClick={() => loadNodeAlerts(node.id)} disabled={nodeAlertsLoading}>{nodeAlertsLoading ? "Loading…" : "↻ Refresh"}</button>
                      </div>
                      <p className="clean-form-note">Warnings trigger at 90% CPU or memory; critical alerts trigger at 95%. Alerts resolve automatically after readings fall below the threshold.</p>
                      {nodeAlertsError && <p className="clean-node-error">{nodeAlertsError}</p>}
                      {nodeAlertsLoading && nodeAlerts.length === 0 ? <div className="clean-activity-empty">Loading alerts…</div> : nodeAlerts.length === 0 ? <div className="clean-activity-empty">No resource alerts recorded.</div> : (
                        <div className="clean-node-alert-list">
                          {nodeAlerts.map(alert => (
                            <article className="clean-node-alert-item" key={alert.id}>
                              <div><strong>{alert.alert_type === "cpu_high" ? "High CPU usage" : "High memory usage"}</strong><p>{alert.message}</p><small>{new Date(alert.last_seen_at).toLocaleString()}</small></div>
                              <span className={"clean-alert-state " + alert.status + " " + alert.severity}>{alert.status === "active" ? alert.severity : "resolved"}</span>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                    <div className="clean-node-detail-footer">
                      <p>{node.status === "disabled" ? "This node has been disabled." : node.status !== "online" ? "No recent heartbeat received. Check that the agent and panel are reachable." : node.effective_health_status === "degraded" ? "The agent reported recent connection or heartbeat errors." : node.effective_health_status === "stale" ? "The last health report is stale. Wait for a fresh heartbeat or check the agent." : node.effective_health_status === "healthy" ? "The agent recently reported healthy communication with Lumen Panel." : "The node is online, but no health report has been received yet."}</p>
                      {node.enabled && <button type="button" className="clean-disable-button" onClick={() => disableNode(node.id)}>Disable node</button>}
                    </div>
                  </section>
                  <section className="server-card clean-activity-panel clean-node-activity-panel">
                    <div className="clean-server-panel-heading">
                      <div><Activity size={16}/><h2>Node agent activity</h2></div>
                      <button type="button" className="clean-refresh-button" onClick={() => loadNodeEvents(node.id)} disabled={nodeEventsLoading}>{nodeEventsLoading ? "Loading…" : "↻ Refresh"}</button>
                    </div>
                    <p className="clean-form-note">Latest 50 authenticated agent startup and heartbeat acknowledgements. These are agent diagnostics, not Minecraft runtime events.</p>
                    {nodeEventsError && <p className="clean-node-error">{nodeEventsError}</p>}
                    {nodeEventsLoading && nodeEvents.length === 0 ? <div className="clean-activity-empty">Loading node activity…</div> : nodeEvents.length === 0 ? <div className="clean-activity-empty">No agent events recorded yet. Start the node agent to report its connection.</div> : (
                      <div className="clean-activity-list">
                        {nodeEvents.map(event => (
                          <article className="clean-activity-item" key={event.id}>
                            <span className="clean-activity-dot" aria-hidden="true"></span>
                            <div className="clean-activity-copy">
                              <strong>{event.event_type === "agent_started" ? "Agent started" : "Heartbeat accepted"}</strong>
                              <p>{event.message || "Node agent event received."}</p>
                              <small>{new Date(event.created_at).toLocaleString()}</small>
                            </div>
                            <span className="clean-activity-kind">AGENT</span>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </>;
              })()}

            </>
          ) : active === "Overview" ? (
            <>
              <div className="clean-page-heading"><div><h1>Overview</h1><p>Your game servers at a glance.</p></div></div>
              <section className="stats-grid clean-stats">
                <div className="stat-card"><div className="clean-stat-icon"><Server size={17}/></div><div className="clean-stat-label">SERVERS</div><div className="stat-value">{servers.length} <small>/ 5</small></div></div>
                <div className="stat-card"><div className="clean-stat-icon"><Cpu size={17}/></div><div className="clean-stat-label">CPU</div><div className="stat-value">—</div></div>
                <div className="stat-card"><div className="clean-stat-icon"><MemoryStick size={17}/></div><div className="clean-stat-label">MEMORY</div><div className="stat-value">—</div></div>
                <div className="stat-card"><div className="clean-stat-icon"><HardDrive size={17}/></div><div className="clean-stat-label">STORAGE</div><div className="stat-value">—</div></div>
              </section>
              <div className="clean-section-heading"><h2>Your servers</h2><span>{servers.length} total</span></div>
              {servers.length === 0 ? <div className="clean-empty-node">No server configurations yet. Open Servers to create one.</div> : servers.slice(0, 3).map(server => (
                <section className="server-card clean-server-card" key={server.id}>
                  <div className="server-main">
                    <div className="game-icon"><Server size={22}/></div>
                    <div className="server-info"><div className="server-title-row"><h3>{server.name}</h3><span className="server-status stopped"><span/>{server.status === "pending" ? "Pending setup" : server.status}</span></div><p>{server.game} · {server.software} · {server.version}</p><div className="server-meta"><span><Wifi size={14}/> {server.node_name || "No node assigned"}</span><span>{server.memory_mb} MB RAM · {server.disk_gb} GB</span></div></div>
                    <button className="clean-open-button" onClick={() => { setSelectedServerId(server.id); goTo("Server Details"); }}>Manage <span>→</span></button>
                  </div>
                </section>
              ))}
            </>
          ) : active === "Server Details" ? (
            (() => {
              const server = servers.find(item => String(item.id) === String(selectedServerId));
              if (!server) return <>
                <div className="clean-page-heading"><div><h1>Server not found</h1><p>It may have been removed or is not available to this account.</p></div></div>
                <button className="clean-back-button" onClick={() => goTo("Servers")}>← Back to servers</button>
              </>;
              const serverStatus = server.status === "pending" ? "Pending setup" : server.status;
              const runtimeStatus = server.runtime_status || "not_reported";
              const runtimeStatusLabel = {
                not_reported: "Not reported", unavailable: "Unavailable", installing: "Installing",
                starting: "Starting", running: "Reported running", stopping: "Stopping",
                stopped: "Reported stopped", error: "Runtime error"
              }[runtimeStatus] || "Unknown";
              return <>
                <div className="clean-server-detail-heading">
                  <button type="button" className="clean-back-button" onClick={() => goTo("Servers")}>← Back to servers</button>
                  <span className="clean-server-id">SERVER #{server.id}</span>
                </div>
                <section className="server-card clean-server-hero">
                  <div className="clean-server-hero-main">
                    <div className="game-icon"><Server size={23}/></div>
                    <div className="clean-server-hero-copy">
                      <h1>{server.name}</h1>
                      <p>{server.game || "Minecraft Java"} · {server.software} · {server.version}</p>
                    </div>
                    <span className="clean-node-status offline">{runtimeStatusLabel}</span>
                  </div>
                  <div className="clean-server-detail-grid">
                    <div><span>NODE</span><strong>{server.node_name || "Not assigned"}</strong></div>
                    <div><span>ALLOCATION</span><strong>{server.allocation_ip ? server.allocation_ip + ":" + server.allocation_port : "Not assigned"}</strong></div>
                    <div><span>MEMORY LIMIT</span><strong>{Number(server.memory_mb).toLocaleString()} MB</strong></div>
                    <div><span>STORAGE QUOTA</span><strong>{server.disk_gb} GB</strong></div>
                    <div><span>CONFIGURATION</span><strong>{serverStatus}</strong></div>
                  </div>
                  <p className="clean-server-runtime-note">Runtime status is reported by the assigned node and is informational only. {server.runtime_reported_at ? "Last report: " + new Date(server.runtime_reported_at).toLocaleString() + ". " : "No runtime status report has been received. "}{server.runtime_message ? "Node message: " + server.runtime_message : ""}</p>
                </section>
                <section className="server-card clean-power-panel">
                  <div className="clean-server-panel-heading"><div><Zap size={16}/><h2>Power controls</h2></div><span>RUNTIME OFFLINE</span></div>
                  <div className="clean-power-actions">
                    {["start", "restart", "stop"].map(action => <button type="button" key={action} className="clean-power-button" onClick={() => requestPowerAction(action)} disabled={Boolean(powerLoading)}>{powerLoading === action ? "Checking…" : action[0].toUpperCase() + action.slice(1)}</button>)}
                  </div>
                  <p className="clean-form-note">Controls are a connection check only. No Minecraft process will be started, stopped, or restarted until a secure runtime is installed.</p>
                  {powerMessage && <p className="clean-power-message" role="status">{powerMessage}</p>}
                </section>
                <section className="server-card clean-activity-panel">
                  <div className="clean-server-panel-heading">
                    <div><Activity size={16}/><h2>Activity history</h2></div>
                    <button type="button" className="clean-refresh-button" onClick={() => loadRuntimeEvents()} disabled={runtimeEventsLoading}>{runtimeEventsLoading ? "Loading…" : "↻ Refresh"}</button>
                  </div>
                  <p className="clean-form-note">Latest 50 recorded runtime reports and power requests. Power requests shown as blocked were not executed.</p>
                  {runtimeEventsError && <p className="clean-node-error">{runtimeEventsError}</p>}
                  {runtimeEventsLoading && runtimeEvents.length === 0 ? <div className="clean-activity-empty">Loading activity…</div> : runtimeEvents.length === 0 ? <div className="clean-activity-empty">No activity recorded yet.</div> : (
                    <div className="clean-activity-list">
                      {runtimeEvents.map(event => (
                        <article className="clean-activity-item" key={event.id}>
                          <span className="clean-activity-dot" aria-hidden="true"></span>
                          <div className="clean-activity-copy">
                            <strong>{event.event_type === "runtime_status" ? `Runtime status · ${event.status}` : `Power request · ${event.status}`}</strong>
                            <p>{event.message || (event.event_type === "runtime_status" ? "Node reported a lifecycle status." : "Power request recorded.")}</p>
                            <small>{new Date(event.created_at).toLocaleString()}{event.node_name ? ` · ${event.node_name}` : ""}{event.actor_name ? ` · ${event.actor_name}` : ""}</small>
                          </div>
                          <span className="clean-activity-kind">{event.event_type === "runtime_status" ? "NODE" : "PANEL"}</span>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                <div className="clean-server-detail-columns">
                  <section className="server-card clean-server-console">
                    <div className="clean-server-panel-heading"><div><Terminal size={16}/><h2>Console</h2></div><span>NOT CONNECTED</span></div>
                    <div className="clean-console-placeholder">
                      <Terminal size={25}/>
                      <strong>Console unavailable</strong>
                      <p>Live console output will appear here after secure server runtime integration.</p>
                    </div>
                  </section>
                  <section className="server-card clean-server-players">
                    <div className="clean-server-panel-heading"><div><Activity size={16}/><h2>Players</h2></div><span>LIVE DATA PENDING</span></div>
                    <div className="clean-player-empty">
                      <strong>No player data yet</strong>
                      <p>Online players and player slots will be shown when the Minecraft server is connected.</p>
                    </div>
                  </section>
                </div>
                <section className="server-card clean-server-resources">
                  <div className="clean-server-panel-heading"><div><Cpu size={16}/><h2>Resource limits</h2></div><span>CONFIGURED VALUES</span></div>
                  <div className="clean-resource-grid">
                    <div><span><MemoryStick size={14}/> MEMORY ALLOCATION</span><strong>{Number(server.memory_mb).toLocaleString()} MB</strong><small>Configured limit · usage not connected</small></div>
                    <div><span><HardDrive size={14}/> STORAGE QUOTA</span><strong>{server.disk_gb} GB</strong><small>Configured limit · usage not connected</small></div>
                  </div>
                </section>
              </>;
            })()
          ) : active === "Servers" ? (
            <>
              <div className="clean-page-heading"><div><h1>Servers</h1><p>Your Minecraft server inventory.</p></div><span className="clean-server-count">{servers.length} total</span></div>
              {user?.role === "admin" && <section className="server-card clean-create-server">
                <div className="clean-section-heading"><h2>Create server</h2><span>Configuration only</span></div>
                <form onSubmit={createServer} className="clean-server-form">
                  <label>Server name<input value={serverDraft.name} onChange={event => setServerDraft({ ...serverDraft, name: event.target.value })} minLength={2} maxLength={60} placeholder="e.g. Lumen SMP" required /></label>
                  <label>Software<select value={serverDraft.software} onChange={event => setServerDraft({ ...serverDraft, software: event.target.value })}><option>Paper</option><option>Vanilla</option><option>Fabric</option></select></label>
                  <label>Minecraft version<input value={serverDraft.version} onChange={event => setServerDraft({ ...serverDraft, version: event.target.value })} maxLength={20} placeholder="1.21.4" required /></label>
                  <label>Memory (MB)<input type="number" min="512" max="16384" step="256" value={serverDraft.memoryMb} onChange={event => setServerDraft({ ...serverDraft, memoryMb: event.target.value })} required /></label>
                  <label>Storage (GB)<input type="number" min="1" max="200" value={serverDraft.diskGb} onChange={event => setServerDraft({ ...serverDraft, diskGb: event.target.value })} required /></label>
                  <label>Node<select value={serverDraft.nodeId} onChange={event => setServerDraft({ ...serverDraft, nodeId: event.target.value })}><option value="">Unassigned</option>{nodes.filter(node => node.enabled).map(node => <option key={node.id} value={node.id}>{node.name} · {node.status}</option>)}</select></label>
                  <button className="clean-open-button" type="submit">Create server</button>
                </form>
                <p className="clean-form-note">This saves a server configuration only. It does not download or start Minecraft.</p>
              </section>}
              {serverError && <p className="clean-node-error">{serverError}</p>}
              {user?.role === "admin" && <section className="server-card clean-create-server clean-allocation-panel">
                <div className="clean-section-heading"><h2>Port allocations</h2><span>{allocations.length} total</span></div>
                <form onSubmit={createAllocation} className="clean-allocation-form">
                  <label>Node<select value={allocationDraft.nodeId} onChange={event => setAllocationDraft({ ...allocationDraft, nodeId: event.target.value })} required><option value="">Select node</option>{nodes.filter(node => node.enabled).map(node => <option key={node.id} value={node.id}>{node.name}</option>)}</select></label>
                  <label>Bind IP<input value={allocationDraft.ip} onChange={event => setAllocationDraft({ ...allocationDraft, ip: event.target.value })} placeholder="0.0.0.0" required /></label>
                  <label>Port<input type="number" min="1024" max="65535" value={allocationDraft.port} onChange={event => setAllocationDraft({ ...allocationDraft, port: event.target.value })} required /></label>
                  <button className="clean-open-button" type="submit">Add allocation</button>
                </form>
                <p className="clean-form-note">Add only IP addresses and ports that are configured and available on the selected host. 0.0.0.0 means bind to all IPv4 interfaces.</p>
                {allocations.length > 0 && <div className="clean-allocation-list">{allocations.map(item => <div key={item.id}><span>{item.node_name}</span><strong>{item.ip}:{item.port}</strong><small>{item.server_name ? `Used by ${item.server_name}` : "Available"}</small></div>)}</div>}
              </section>}
              <div className="clean-section-heading"><h2>All servers</h2><button className="clean-refresh-button" onClick={loadServers} disabled={serversLoading}>{serversLoading ? "Loading…" : "↻ Refresh"}</button></div>
              {serversLoading ? <div className="clean-empty-node">Loading servers…</div> : servers.length === 0 ? <div className="clean-empty-node">No servers yet.</div> : <div className="clean-server-list">
                {servers.map(server => <section className="server-card clean-managed-server clean-managed-server-expanded" key={server.id}>
                  <div className="game-icon"><Server size={21}/></div>
                  <div className="clean-managed-server-main"><strong>{server.name}</strong><p>Minecraft Java · {server.software} · {server.version}</p><small>{server.node_name || "No node assigned"} · {server.memory_mb} MB RAM · {server.disk_gb} GB storage</small><small>{server.allocation_ip ? `Allocation ${server.allocation_ip}:${server.allocation_port}` : "No port allocation"}</small></div>
                  <span className="clean-node-status offline">{server.status === "pending" ? "PENDING" : server.status}</span>
                  <button type="button" className="clean-node-open-button" onClick={() => { setSelectedServerId(server.id); goTo("Server Details"); }}>Details →</button>
                  {user?.role === "admin" && <div className="clean-server-admin-actions">
                    <div className="clean-assign-row"><select value={allocationChoices[server.id] ?? (server.allocation_id ? String(server.allocation_id) : "")} onChange={event => setAllocationChoices({ ...allocationChoices, [server.id]: event.target.value })}><option value="">No allocation</option>{allocations.filter(item => String(item.node_id) === String(server.node_id) && (!item.server_id || String(item.server_id) === String(server.id))).map(item => <option key={item.id} value={item.id}>{item.ip}:{item.port} {item.server_id ? "(assigned)" : ""}</option>)}</select><button type="button" className="clean-node-open-button" onClick={() => assignAllocation(server.id)}>Save port</button></div>
                    {editingServerId === server.id ? <form className="clean-edit-config" onSubmit={event => saveServerConfig(event, server.id)}>
                      <input aria-label="Server name" value={serverEditDraft.name} onChange={event => setServerEditDraft({ ...serverEditDraft, name: event.target.value })} required />
                      <select aria-label="Software" value={serverEditDraft.software} onChange={event => setServerEditDraft({ ...serverEditDraft, software: event.target.value })}><option>Paper</option><option>Vanilla</option><option>Fabric</option></select>
                      <input aria-label="Minecraft version" value={serverEditDraft.version} onChange={event => setServerEditDraft({ ...serverEditDraft, version: event.target.value })} required />
                      <input aria-label="Memory MB" type="number" min="512" max="16384" value={serverEditDraft.memoryMb} onChange={event => setServerEditDraft({ ...serverEditDraft, memoryMb: event.target.value })} required />
                      <input aria-label="Storage GB" type="number" min="1" max="200" value={serverEditDraft.diskGb} onChange={event => setServerEditDraft({ ...serverEditDraft, diskGb: event.target.value })} required />
                      <button className="clean-open-button" type="submit">Save config</button>
                      <button type="button" className="clean-node-open-button" onClick={() => setEditingServerId(null)}>Cancel</button>
                    </form> : <button type="button" className="clean-node-open-button" onClick={() => { setEditingServerId(server.id); setServerEditDraft({ name: server.name, software: server.software, version: server.version, memoryMb: String(server.memory_mb), diskGb: String(server.disk_gb) }); }}>Edit config</button>}
                  </div>}
                </section>)}
              </div>}
            </>
          ) : (
            <>
              <div className="clean-page-heading"><div><h1>Server</h1><p>Select a server from the Servers page to manage its configuration.</p></div></div>
              <div className="clean-empty-node">Server controls will be enabled after secure node provisioning is implemented.</div>
            </>
          )}
          <footer className="clean-footer">Lumen Panel <span>·</span> Development preview</footer>
        </div>
      </main>
    </div>
  );
}
