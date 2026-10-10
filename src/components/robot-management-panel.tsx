"use client";

import { useEffect, useState } from "react";

type Plan = { id: string; name: string; description: string | null; durationDays: number; price: string; currency: string; status: "ACTIVE" | "INACTIVE" };
type Robot = { id: string; name: string; slug: string; description: string; strategyDescription: string; market: string; riskLevel: string; robotType: string; tier: "BEGINNER" | "PRO" | "ADVANCED" | "VIP"; status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED"; performanceKind: "SIMULATED" | "HISTORICAL" | "REAL" | null; performanceSummary: string | null; plans: Plan[]; subscriptionCount: number };

const statusOptions = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;

export default function RobotManagementPanel() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [editing, setEditing] = useState<Robot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/admin/robots", { cache: "no-store" });
      const data = await response.json() as { robots?: Robot[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load robots.");
      setRobots(data.robots ?? []);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load robots.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function saveRobot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = {
      name: form.get("name"), slug: form.get("slug"), description: form.get("description"),
      strategyDescription: form.get("strategyDescription"), market: form.get("market"),
      riskLevel: form.get("riskLevel"), robotType: form.get("robotType"), tier: form.get("tier"),
      performanceKind: form.get("performanceKind") || null,
      performanceSummary: form.get("performanceSummary") || "",
    };
    setBusy(true); setError(""); setNotice("");
    try {
      const createPlan = { name: form.get("planName"), description: form.get("planDescription") || "", durationDays: form.get("durationDays"), price: form.get("price"), status: form.get("planStatus") || "ACTIVE" };
      const response = await fetch(editing ? `/api/admin/robots/${editing.id}` : "/api/admin/robots", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { action: "update", ...data } : { ...data, status: form.get("status"), plan: createPlan }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not save robot.");
      setNotice(editing ? "Robot details updated." : "Robot and its first subscription plan created.");
      setEditing(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save robot.");
    } finally {
      setBusy(false);
    }
  }

  async function update(action: Record<string, unknown>, id: string, successMessage: string): Promise<boolean> {
    setBusyId(id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/robots/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not update robot.");
      setNotice(successMessage);
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update robot.");
      return false;
    } finally {
      setBusyId("");
    }
  }

  async function addPlan(event: React.FormEvent<HTMLFormElement>, robot: Robot) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const succeeded = await update({ action: "addPlan", plan: { name: form.get("name"), description: form.get("description") || "", durationDays: form.get("durationDays"), price: form.get("price"), status: "ACTIVE" } }, robot.id, `Plan added to ${robot.name}.`);
    if (succeeded) element.reset();
  }

  return <div className="robot-admin">
    <section className="finance-card robot-editor-card"><span className="label">{editing ? "EDIT LISTING" : "NEW LISTING"}</span><h2>{editing ? `Edit ${editing.name}` : "Create a robot"}</h2><p>Enter the strategy and risk information clients will see. New listings start as drafts unless you choose to publish them.</p>
      <form className="robot-admin-form" key={editing?.id ?? "new-robot"} onSubmit={saveRobot}>
        <div className="robot-form-grid"><label className="auth-field">Robot name<input name="name" defaultValue={editing?.name ?? ""} minLength={2} maxLength={120} required /></label><label className="auth-field">URL slug<input name="slug" defaultValue={editing?.slug ?? ""} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="example-strategy" required /><small>Lowercase letters, numbers, and hyphens.</small></label>
          <label className="auth-field">Market<input name="market" defaultValue={editing?.market ?? ""} placeholder="Forex, Crypto, ..." required /></label><label className="auth-field">Robot type<input name="robotType" defaultValue={editing?.robotType ?? ""} placeholder="Trend following" required /></label>
          <label className="auth-field">Risk level<select name="riskLevel" defaultValue={editing?.riskLevel ?? "MEDIUM"}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
          <label className="auth-field">Marketplace tier<select name="tier" defaultValue={editing?.tier ?? "BEGINNER"}><option value="BEGINNER">Beginner</option><option value="PRO">Pro</option><option value="ADVANCED">Advanced</option><option value="VIP">VIP</option></select></label>
          <label className="auth-field">Performance data type<select name="performanceKind" defaultValue={editing?.performanceKind ?? ""}><option value="">Not provided</option><option value="SIMULATED">Simulated</option><option value="HISTORICAL">Historical</option><option value="REAL">Real</option></select></label>
          <label className="auth-field robot-form-wide">Short description<textarea name="description" defaultValue={editing?.description ?? ""} rows={3} minLength={10} maxLength={5000} required /></label>
          <label className="auth-field robot-form-wide">Strategy details<textarea name="strategyDescription" defaultValue={editing?.strategyDescription ?? ""} rows={4} minLength={10} maxLength={5000} required /></label>
          <label className="auth-field robot-form-wide">Performance summary<textarea name="performanceSummary" defaultValue={editing?.performanceSummary ?? ""} rows={3} maxLength={3000} /></label>
          {!editing && <><div className="robot-form-section robot-form-wide"><span className="label">FIRST SUBSCRIPTION PLAN</span></div>
            <label className="auth-field">Plan name<input name="planName" defaultValue="Standard" minLength={2} maxLength={100} required /></label><label className="auth-field">Plan price (RWF)<input name="price" type="number" min="0.01" step="0.01" required /></label>
            <label className="auth-field">Cycle length (days)<input name="durationDays" type="number" min="1" max="3650" step="1" required /></label><label className="auth-field">Initial listing status<select name="status" defaultValue="DRAFT"><option value="DRAFT">Draft</option><option value="ACTIVE">Publish</option><option value="PAUSED">Paused</option></select></label>
            <label className="auth-field robot-form-wide">Plan description<input name="planDescription" maxLength={2000} /></label>
          </>}
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="finance-success" role="status">{notice}</p>}
        <div className="robot-form-actions"><button className="button" disabled={busy}>{busy ? "Saving…" : editing ? "Save robot details" : "Create robot"}</button>{editing && <button className="button button-quiet" type="button" onClick={() => { setEditing(null); setError(""); }}>Cancel edit</button>}</div>
      </form>
    </section>

    <section className="finance-card robot-inventory"><span className="label">CATALOG</span><h2>Robot listings</h2>{loading ? <p className="finance-empty">Loading catalog…</p> : robots.length === 0 ? <p className="finance-empty">No robots yet. Create one above to add the first marketplace listing.</p> : <div className="robot-admin-list">{robots.map((robot) => <article className="robot-admin-item" key={robot.id}>
      <div className="robot-admin-head"><div><span className={`finance-status ${robot.status.toLowerCase()}`}>{robot.status.toLowerCase()}</span><h3>{robot.name}</h3><small>{robot.tier} · {robot.slug} · {robot.market} · {robot.riskLevel.toLowerCase()} risk · {robot.subscriptionCount} subscriptions</small></div><div className="robot-row-actions"><button className="button button-quiet" type="button" onClick={() => { setEditing(robot); setNotice(""); setError(""); }}>Edit details</button><label className="robot-status-control">Status<select aria-label={`Status for ${robot.name}`} value={robot.status} disabled={busyId === robot.id} onChange={(event) => void update({ action: "status", status: event.target.value }, robot.id, `${robot.name} is now ${event.target.value.toLowerCase()}.`)}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></label></div></div>
      <p className="robot-admin-description">{robot.description}</p>
      <div className="robot-plan-list">{robot.plans.map((plan) => <div className="robot-plan-row" key={plan.id}><div><strong>{plan.name}</strong><small>{plan.currency} {Number(plan.price).toLocaleString()} · {plan.durationDays} days{plan.description ? ` · ${plan.description}` : ""}</small></div><label className="robot-status-control">Plan<select aria-label={`${plan.name} status`} disabled={busyId === robot.id} value={plan.status} onChange={(event) => void update({ action: "planStatus", planId: plan.id, status: event.target.value }, robot.id, `${plan.name} plan updated.`)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div>)}</div>
      <form className="robot-add-plan" onSubmit={(event) => void addPlan(event, robot)}><strong>Add a plan</strong><input name="name" placeholder="Plan name" minLength={2} maxLength={100} required aria-label="New plan name" /><input name="price" type="number" min="0.01" step="0.01" placeholder="Price RWF" required aria-label="New plan price in RWF" /><input name="durationDays" type="number" min="1" max="3650" placeholder="Days" required aria-label="New plan duration in days" /><input name="description" placeholder="Plan description (optional)" maxLength={2000} aria-label="New plan description" /><button className="button button-quiet" disabled={busyId === robot.id}>Add plan</button></form>
    </article>)}</div>}</section>
  </div>;
}
