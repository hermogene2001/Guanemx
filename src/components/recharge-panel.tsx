"use client";

import { useEffect, useState } from "react";

type Recharge = { id: string; amount: string; currency: string; status: string; createdAt: string; agent: { name: string; phone: string | null }; reference: string | null };

export default function RechargePanel() {
  const [items, setItems] = useState<Recharge[]>([]);
  const [amount, setAmount] = useState(3000);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/recharges", { cache: "no-store" });
    if (response.ok) setItems((await response.json() as { recharges: Recharge[] }).recharges);
  }
  useEffect(() => { void load(); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/recharges", {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ amount }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setError(data.error ?? "Recharge request failed."); return; }
      setAmount(3000); await load();
    } catch { setError("Unable to reach GuanemX. Try again."); }
    finally { setBusy(false); }
  }

  return <div className="finance-layout">
    <section className="finance-card"><span className="label">MANUAL RECHARGE</span><h2>Request a recharge</h2><p>Choose an amount. GuanemX assigns an available agent. Send money outside the application using the agent details shown after your request.</p>
      <form className="finance-form" onSubmit={submit}><label className="auth-field">Amount (RWF)<input type="number" min={3000} max={3000000} step={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy ? "Submitting…" : "Create recharge request"}</button></form>
      <p className="finance-disclaimer">Your wallet is not credited when you submit. It is credited only after the assigned agent confirms receipt.</p>
    </section>
    <section className="finance-card"><span className="label">RECHARGE ACTIVITY</span><h2>Your requests</h2>{items.length === 0 ? <p className="finance-empty">No recharge requests yet.</p> : <div className="finance-list">{items.map((item) => <article className="finance-row" key={item.id}><div><strong>RWF {Number(item.amount).toLocaleString()}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></div><div><span className={`finance-status ${item.status.toLowerCase()}`}>{item.status.toLowerCase()}</span><small>Agent: {item.agent.name}{item.agent.phone ? ` · ${item.agent.phone}` : ""}</small></div>{item.status === "PENDING" && <p className="finance-instruction">Send RWF {Number(item.amount).toLocaleString()} to {item.agent.name}{item.agent.phone ? ` at ${item.agent.phone}` : ""}. Wait for confirmation before using the balance.</p>}</article>)}</div>}</section>
  </div>;
}
