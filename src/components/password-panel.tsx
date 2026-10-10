"use client";

import { useState } from "react";

export default function PasswordPanel() {
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/account/security/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setError(result.error ?? "Password could not be updated."); return; }
      formElement.reset(); setNotice("Password updated. Other active sessions were signed out.");
    } catch { setError("Unable to reach GuanemX. Try again."); }
    finally { setBusy(false); }
  }
  return <section className="finance-card security-card"><span className="label">PASSWORD</span><h2>Change your password</h2><p>Use at least 12 characters. Changing your password ends other active sessions.</p><form className="finance-form" onSubmit={submit}><label className="auth-field">Current password<input type="password" name="currentPassword" autoComplete="current-password" required /></label><label className="auth-field">New password<input type="password" name="newPassword" minLength={12} maxLength={72} autoComplete="new-password" required /><small>Use 12 to 72 characters.</small></label>{error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="finance-success" role="status">{notice}</p>}<button className="button" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></form></section>;
}
