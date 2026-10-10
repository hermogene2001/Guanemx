"use client";

import { useEffect, useState } from "react";

type Destination = { id: string; category: string; provider: string; accountHolder: string; accountNumberLast4: string; isDefault: boolean };

export default function PayoutSetupPanel() {
  const [items, setItems] = useState<Destination[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const response = await fetch("/api/payout-destinations", { cache: "no-store" });
    if (response.ok) setItems((await response.json() as { destinations: Destination[] }).destinations);
  }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/payout-destinations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        category: form.get("category"), provider: form.get("provider"), accountHolder: form.get("accountHolder"), accountNumber: form.get("accountNumber"),
      }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setError(result.error ?? "Unable to save payout details."); return; }
      formElement.reset(); await load();
    } catch { setError("Unable to reach GuanemX. Try again."); }
    finally { setBusy(false); }
  }
  return <div className="finance-layout">
    <section className="finance-card"><span className="label">PAYOUT SETUP</span><h2>Save a payout destination</h2><p>Save your own bank or mobile-money account. Account numbers are encrypted before they are stored.</p>
      <form className="finance-form" onSubmit={submit}><label className="auth-field">Account type<select name="category" required defaultValue="MOBILE_MONEY"><option value="MOBILE_MONEY">Mobile money</option><option value="BANK">Bank account</option></select></label><label className="auth-field">Provider name<input name="provider" maxLength={80} placeholder="Enter your bank or mobile-money provider" required /></label><label className="auth-field">Account-holder name<input name="accountHolder" minLength={2} maxLength={120} autoComplete="name" required /></label><label className="auth-field">Account number<input name="accountNumber" minLength={4} maxLength={34} autoComplete="off" inputMode="text" pattern="[a-zA-Z0-9 -]+" required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy ? "Saving…" : "Save payout details"}</button></form>
    </section>
    <section className="finance-card"><span className="label">SAVED DESTINATIONS</span><h2>Your payout accounts</h2>{items.length === 0 ? <p className="finance-empty">Save a destination before requesting a withdrawal.</p> : <div className="finance-list">{items.map((item) => <article className="finance-row" key={item.id}><div><strong>{item.provider}</strong><small>{item.category === "BANK" ? "Bank account" : "Mobile money"} · {item.accountHolder}</small></div><div><span className="finance-status completed">•••• {item.accountNumberLast4}</span>{item.isDefault && <small>Default destination</small>}</div></article>)}</div>}</section>
  </div>;
}
