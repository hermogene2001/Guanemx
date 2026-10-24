"use client";

import { useEffect, useState } from "react";
import { formatMoney, formatRwf, formatUsd, usdToRwf } from "@/lib/money";

type Recharge = { id: string; amount: string; currency: string; status: string; createdAt: string; agent: { name: string; phone: string | null }; reference: string | null };

export default function RechargePanel({ rate, minimumAmount }: { rate: string; minimumAmount: string }) {
  const [items, setItems] = useState<Recharge[]>([]);
  const minimum = Number(minimumAmount);
  const [amount, setAmount] = useState(minimum);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hasRate = Number(rate) > 0;

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
      setAmount(minimum); await load();
    } catch { setError("Unable to reach GuanemX. Try again."); }
    finally { setBusy(false); }
  }

  return <div className="deposit-page">
    <div className="deposit-intro"><span className="deposit-intro-icon" aria-hidden="true">▣</span><div><h2>Deposit funds</h2><p>Choose your preferred payment method</p></div></div>

    <section className="deposit-method-card">
      <header className="deposit-method-heading"><span className="deposit-method-icon" aria-hidden="true">$</span><div><h3>REAL USD</h3><p>Fund your real US dollar balance</p></div><span className="deposit-popular">★ &nbsp;Available</span></header>
      <div className="deposit-method-row"><span className="deposit-flag" aria-hidden="true">$</span><div className="deposit-method-copy"><strong>Agent-assisted transfer</strong><small>Bank transfer, wallet, or mobile money</small></div><span className="deposit-fast">Manual</span><span className="deposit-currency">USD</span><span className="deposit-chevron" aria-hidden="true">›</span></div>
      <p className="deposit-method-note">An agent is assigned after you request a deposit. The agent will confirm the payment details and credit your balance after receipt.</p>
    </section>

    <div className="deposit-columns">
      <section className="deposit-form-card">
        <div className="deposit-section-title"><span className="deposit-small-icon" aria-hidden="true">＋</span><div><h3>Deposit amount</h3><p>Request a manual USD recharge</p></div></div>
        <form className="finance-form" onSubmit={submit}>
          <label className="auth-field">Amount (USD)<input type="number" min={minimum} max={3000000} step={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} required /><small>Minimum deposit: {formatUsd(minimum)}.</small>{hasRate && Number.isFinite(amount) && amount > 0 && <small>≈ {formatRwf(usdToRwf(amount, rate))} at the current rate.</small>}</label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="deposit-submit" disabled={busy}>{busy ? "Submitting…" : "Continue to deposit　›"}</button>
        </form>
        <p className="finance-disclaimer">Your wallet is credited only after the assigned agent confirms receipt.</p>
      </section>

      <section className="deposit-activity-card">
        <div className="deposit-section-title"><span className="deposit-small-icon" aria-hidden="true">↻</span><div><h3>Recent deposits</h3><p>Your recharge activity</p></div></div>
        {items.length === 0 ? <p className="finance-empty">No deposit requests yet.</p> : <div className="finance-list">{items.map((item) => <article className="finance-row" key={item.id}><div><strong>{formatMoney(item.amount, item.currency)}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></div><div><span className={`finance-status ${item.status.toLowerCase()}`}>{item.status.toLowerCase()}</span><small>Agent: {item.agent.name}{item.agent.phone ? ` · ${item.agent.phone}` : ""}</small></div>{item.status === "PENDING" && <p className="finance-instruction">Send {formatUsd(item.amount)}{hasRate ? ` (≈ ${formatRwf(usdToRwf(item.amount, rate))})` : ""} to {item.agent.name}{item.agent.phone ? ` at ${item.agent.phone}` : ""}. Wait for confirmation before using the balance.</p>}</article>)}</div>}
      </section>
    </div>
  </div>;
}
