"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Destination = { id: string; category: string; provider: string; accountHolder: string; accountNumberLast4: string; isDefault: boolean };
type Withdrawal = { id: string; status: string; amount: string; fee: string; netPayout: string; sourceBalance: string; createdAt: string; reference: string; destination: { provider: string; accountNumberLast4: string } | null };

export default function WithdrawalPanel({ mainBalance, growthBalance }: { mainBalance: string; growthBalance: string }) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState(1000);
  const [sourceBalance, setSourceBalance] = useState("MAIN");
  const [destinationId, setDestinationId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const estimated = useMemo(() => ({ fee: (amount * 0.1).toFixed(2), net: (amount * 0.9).toFixed(2) }), [amount]);

  async function load() {
    const [destResponse, withdrawResponse] = await Promise.all([fetch("/api/payout-destinations", { cache: "no-store" }), fetch("/api/withdrawals", { cache: "no-store" })]);
    if (destResponse.ok) {
      const rows = (await destResponse.json() as { destinations: Destination[] }).destinations;
      setDestinations(rows);
      setDestinationId((current) => current || rows.find((item) => item.isDefault)?.id || rows[0]?.id || "");
    }
    if (withdrawResponse.ok) setWithdrawals((await withdrawResponse.json() as { withdrawals: Withdrawal[] }).withdrawals);
  }
  useEffect(() => { void load(); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/withdrawals", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ amount, sourceBalance, payoutDestinationId: destinationId }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setError(data.error ?? "Withdrawal request failed."); return; }
      setNotice(`Request submitted. RWF ${amount.toLocaleString()} gross was deducted. Estimated payout: RWF ${estimated.net}, fee: RWF ${estimated.fee}.`);
      await load();
    } catch { setError("Unable to reach GuanemX. Try again."); }
    finally { setBusy(false); }
  }

  return <div className="finance-layout">
    <section className="finance-card"><span className="label">WITHDRAW FUNDS</span><h2>Request a withdrawal</h2><p>Choose the balance to withdraw from and a saved payout destination.</p>
      <form className="finance-form" onSubmit={submit}>
        <label className="auth-field">Amount (RWF)<input type="number" min={1000} max={3000000} step={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} required /></label>
        <label className="auth-field">Withdraw from<select value={sourceBalance} onChange={(event) => setSourceBalance(event.target.value)}><option value="MAIN">Main Balance · RWF {Number(mainBalance).toLocaleString()}</option><option value="GROWTH">Growth Balance · RWF {Number(growthBalance).toLocaleString()}</option></select></label>
        <label className="auth-field">Payout destination<select value={destinationId} onChange={(event) => setDestinationId(event.target.value)} required disabled={destinations.length === 0}><option value="">Choose saved destination</option>{destinations.map((item) => <option value={item.id} key={item.id}>{item.provider} · •••• {item.accountNumberLast4}</option>)}</select></label>
        <div className="withdrawal-estimate"><span>Gross deduction <strong>RWF {Number.isFinite(amount) ? amount.toLocaleString() : "0"}</strong></span><span>10% fee <strong>RWF {estimated.fee}</strong></span><span>Estimated payout <strong>RWF {estimated.net}</strong></span></div>
        {error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="finance-success" role="status">{notice}</p>}
        <button className="button" disabled={busy || !destinations.length}>{busy ? "Submitting…" : "Submit withdrawal request"}</button>
        {destinations.length === 0 && <p className="finance-disclaimer">Save payout details in <Link href="/account/payout-setup">Payout Setup</Link> before requesting a withdrawal.</p>}
      </form>
      <p className="finance-disclaimer">One request is allowed per Kigali calendar day. The gross amount is deducted while pending. If rejected, it is returned to the selected balance. Approval records the net payout and fee; payment is handled manually outside GuanemX.</p>
    </section>
    <section className="finance-card"><span className="label">WITHDRAWAL ACTIVITY</span><h2>Your requests</h2>{withdrawals.length === 0 ? <p className="finance-empty">No withdrawal requests yet.</p> : <div className="finance-list">{withdrawals.map((item) => <article className="finance-row" key={item.id}><div><strong>RWF {Number(item.amount).toLocaleString()} gross</strong><small>{new Date(item.createdAt).toLocaleString()} · {item.sourceBalance === "MAIN" ? "Main Balance" : "Growth Balance"}</small></div><div><span className={`finance-status ${item.status.toLowerCase()}`}>{item.status.toLowerCase()}</span><small>Net RWF {Number(item.netPayout).toLocaleString()} · Fee RWF {Number(item.fee).toLocaleString()}</small></div></article>)}</div>}</section>
  </div>;
}
