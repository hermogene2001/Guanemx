"use client";

import { useEffect, useState } from "react";

type Agent = { id: string; name: string; email: string; phone: string | null; status: string };

export default function AgentManagementPanel() {
  const [agents, setAgents] = useState<Agent[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { const response = await fetch("/api/admin/agents", { cache: "no-store" }); const data = await response.json() as { agents?: Agent[]; error?: string }; if (response.ok) setAgents(data.agents ?? []); else setError(data.error ?? "Unable to load agents."); }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setBusy(true); setError(""); setNotice("");
    try { const response = await fetch("/api/admin/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), phone: form.get("phone"), enabled: true }) }); const data = await response.json() as { error?: string }; if (!response.ok) { setError(data.error ?? "Unable to enable agent."); return; } setNotice("Agent access enabled."); formElement.reset(); await load(); }
    catch { setError("Unable to reach GuanemX. Try again."); } finally { setBusy(false); }
  }
  async function disable(agent: Agent) {
    setBusy(true); setError("");
    try { const response = await fetch("/api/admin/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: agent.email, enabled: false }) }); const data = await response.json() as { error?: string }; if (!response.ok) { setError(data.error ?? "Unable to remove agent access."); return; } await load(); }
    catch { setError("Unable to reach GuanemX. Try again."); } finally { setBusy(false); }
  }
  return <div className="finance-layout"><section className="finance-card"><span className="label">AGENT ACCESS</span><h2>Enable a registered user</h2><p>Agents can confirm recharges and approve or reject withdrawals assigned to them. Add a phone number so the user can receive recharge assignments.</p><form className="finance-form" onSubmit={submit}><label className="auth-field">Account email<input name="email" type="email" required /></label><label className="auth-field">Agent phone number<input name="phone" type="tel" placeholder="+250..." required /></label>{error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="finance-success" role="status">{notice}</p>}<button className="button" disabled={busy}>{busy ? "Saving…" : "Enable agent"}</button></form></section><section className="finance-card"><span className="label">ACTIVE AGENTS</span><h2>Agent accounts</h2>{agents.length === 0 ? <p className="finance-empty">No agents configured.</p> : <div className="finance-list">{agents.map((agent) => <article className="finance-row" key={agent.id}><div><strong>{agent.name}</strong><small>{agent.email} · {agent.phone || "No phone"} · {agent.status.toLowerCase()}</small></div><button className="button button-quiet" disabled={busy} onClick={() => void disable(agent)} type="button">Remove access</button></article>)}</div>}</section></div>;
}
