"use client";

import { useEffect, useState } from "react";

type Recharge = { id: string; amount: string; currency: string; createdAt: string; client: { name: string; email: string; phone: string | null } };
type Withdrawal = { id: string; amount: string; currency: string; fee: string; netPayout: string; sourceBalance: string; reference: string; createdAt: string; client: { name: string; email: string; phone: string | null }; destination: { category: string; provider: string; accountHolder: string; accountNumber: string; accountNumberLast4: string } | null };

export default function AgentReviewPanel() {
  const [recharges, setRecharges] = useState<Recharge[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  async function load() {
    const [rechargeResponse, withdrawalResponse] = await Promise.all([fetch("/api/agent/recharges", { cache: "no-store" }), fetch("/api/agent/withdrawals", { cache: "no-store" })]);
    const rechargeData = await rechargeResponse.json() as { requests?: Recharge[]; error?: string };
    const withdrawalData = await withdrawalResponse.json() as { withdrawals?: Withdrawal[]; error?: string };
    if (!rechargeResponse.ok || !withdrawalResponse.ok) { setError(rechargeData.error ?? withdrawalData.error ?? "Unable to load review queue."); return; }
    setError(""); setRecharges(rechargeData.requests ?? []); setWithdrawals(withdrawalData.withdrawals ?? []);
  }
  useEffect(() => { void load(); }, []);
  async function review(kind: "recharge" | "withdrawal", id: string, action: "confirm" | "approve" | "reject") {
    setBusyId(id); setError("");
    try {
      const endpoint = kind === "recharge" ? `/api/agent/recharges/${id}/review` : `/api/agent/withdrawals/${id}/review`;
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...(action === "reject" ? { reason: "Rejected after agent review." } : {}) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setError(data.error ?? "Review could not be saved."); return; }
      await load();
    } catch { setError("Unable to reach GuanemX. Try again."); }
    finally { setBusyId(""); }
  }
  return <div className="finance-layout agent-queue">
    {error && <p className="auth-error" role="alert">{error}</p>}
    <section className="finance-card"><span className="label">RECHARGE QUEUE</span><h2>Pending recharges</h2>{recharges.length === 0 ? <p className="finance-empty">No pending recharge requests assigned to you.</p> : <div className="finance-list">{recharges.map((item) => <article className="finance-row agent-review-row" key={item.id}><div><strong>RWF {Number(item.amount).toLocaleString()}</strong><small>{item.client.name} · {item.client.email}{item.client.phone ? ` · ${item.client.phone}` : ""}</small><small>{new Date(item.createdAt).toLocaleString()}</small></div><div className="agent-review-actions"><button className="button" disabled={busyId === item.id} onClick={() => void review("recharge", item.id, "confirm")}>Confirm payment</button><button className="button button-quiet" disabled={busyId === item.id} onClick={() => void review("recharge", item.id, "reject")}>Reject</button></div></article>)}</div>}</section>
    <section className="finance-card"><span className="label">WITHDRAWAL QUEUE</span><h2>Pending withdrawals</h2>{withdrawals.length === 0 ? <p className="finance-empty">No pending withdrawal requests assigned to you.</p> : <div className="finance-list">{withdrawals.map((item) => <article className="finance-row agent-review-row" key={item.id}><div><strong>RWF {Number(item.amount).toLocaleString()} gross</strong><small>{item.client.name} · {item.client.email}</small><small>From {item.sourceBalance === "MAIN" ? "Main Balance" : "Growth Balance"} · Net RWF {Number(item.netPayout).toLocaleString()} · fee RWF {Number(item.fee).toLocaleString()}</small><small>{item.destination ? `${item.destination.provider} (${item.destination.category}) · ${item.destination.accountHolder} · ${item.destination.accountNumber}` : "No payout destination"}</small><small>Reference {item.reference}</small></div><div className="agent-review-actions"><button className="button" disabled={busyId === item.id || !item.destination} onClick={() => void review("withdrawal", item.id, "approve")}>Approve for manual payout</button><button className="button button-quiet" disabled={busyId === item.id} onClick={() => void review("withdrawal", item.id, "reject")}>Reject and return funds</button></div></article>)}</div>}</section>
  </div>;
}
