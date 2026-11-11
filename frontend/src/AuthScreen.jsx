import { useState } from "react";
import { Zap, Eye, EyeOff } from "lucide-react";
import "./auth.css";

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include" });
      if (!csrfResponse.ok) throw new Error("Could not start a secure session. Refresh and try again.");
      const { csrfToken } = await csrfResponse.json();
      const response = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ name, email, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Authentication failed.");
      onAuthenticated(data.user, data.csrfToken);
    } catch (err) {
      setError(err.message || "Could not connect to Lumen API.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon"><Zap size={22} fill="currentColor" /></div>
          <div><strong>LUMEN<span>.</span></strong><small>CONTROL CENTER</small></div>
        </div>
        <div className="auth-heading">
          
          <h1>{mode === "login" ? "Welcome back." : "Create your account."}</h1>
          
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === "register" && <label>Your name<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={60} required placeholder="Enter your name" /></label>}
          <label>Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required placeholder="you@example.com" /></label>
          <label>Password<span className="auth-password"><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} minLength={mode === "register" ? 12 : 1} maxLength={128} required placeholder={mode === "register" ? "At least 12 characters" : "Enter your password"} /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in to Lumen" : "Create account"} <span>→</span></button>
        </form>
        <div className="auth-switch">
          {mode === "login" ? "New to Lumen?" : "Already have an account?"}
          <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}> {mode === "login" ? "Create an account" : "Sign in"}</button>
        </div>
        
      </section>
      
    </main>
  );
}
