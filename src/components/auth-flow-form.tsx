"use client";

import Link from "next/link";
import { useState } from "react";

type Mode = "verify" | "reset" | "forgot";

export default function AuthFlowForm({ mode, token = "", sent = false }: { mode: Mode; token?: string; sent?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const endpoint = mode === "verify" ? "/api/auth/verify-email" : mode === "reset" ? "/api/auth/reset-password" : "/api/auth/forgot-password";
    const body = mode === "verify" ? { token } : mode === "reset"
      ? { token, password: String(form.get("password") ?? "") }
      : { email: String(form.get("email") ?? "") };
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "This request could not be completed.");
        return;
      }
      setNotice(mode === "verify" ? "Your email is verified. You can now sign in." : mode === "reset" ? "Your password has been updated. You can sign in with the new password." : "If that email belongs to an account, a password reset link will be sent.");
    } catch {
      setError("Unable to reach GuanemX. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent && mode === "verify") return <div className="auth-flow-message"><p>Check your email for a verification link. If you use the local development mail driver, the link is printed in the server terminal.</p><Link href="/login">Continue to sign in</Link></div>;
  if (mode === "verify" && !token) return <div className="auth-flow-message"><p>This verification link is missing or invalid.</p><Link href="/login">Go to sign in</Link></div>;
  if ((mode === "reset") && !token) return <div className="auth-flow-message"><p>This password reset link is missing or invalid.</p><Link href="/forgot-password">Request another link</Link></div>;

  return <form className="auth-form" onSubmit={submit}>
    {mode === "forgot" && <label className="auth-field">Email address<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>}
    {mode === "reset" && <label className="auth-field">New password<input type="password" name="password" autoComplete="new-password" minLength={12} maxLength={72} required /><small>Use 12 to 72 characters.</small></label>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {notice && <p className="finance-success" role="status">{notice} <Link href="/login">Sign in</Link></p>}
    {!notice && <button className="button auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "verify" ? "Verify email" : mode === "reset" ? "Save new password" : "Send reset link"}</button>}
    {mode === "forgot" && <div className="auth-switch"><Link href="/login">Back to sign in</Link></div>}
  </form>;
}
