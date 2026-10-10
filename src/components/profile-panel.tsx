"use client";

import { useState } from "react";

export default function ProfilePanel({ name, email, phone, referralCode }: { name: string; email: string; phone: string; referralCode: string }) {
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), phone: form.get("phone") }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setError(result.error ?? "Profile could not be updated."); return; }
      setNotice("Profile updated.");
    } catch { setError("Unable to reach GuanemX. Try again."); }
    finally { setBusy(false); }
  }
  return <div className="finance-layout">
    <section className="finance-card"><span className="label">PROFILE</span><h2>Personal information</h2><form className="finance-form" onSubmit={submit}><label className="auth-field">Full name<input name="name" defaultValue={name} minLength={2} maxLength={80} required /></label><label className="auth-field">Email address<input value={email} readOnly /></label><label className="auth-field">Phone number<input name="phone" defaultValue={phone} type="tel" autoComplete="tel" placeholder="+250..." /></label>{error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="finance-success" role="status">{notice}</p>}<button className="button" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button></form></section>
    <section className="finance-card"><span className="label">INVITATION</span><h2>Your referral code</h2><p>Share this code when someone creates an account. A recharge referral bonus is applied only when the bonus rate is configured by the operator.</p><div className="referral-code">{referralCode}</div></section>
  </div>;
}
