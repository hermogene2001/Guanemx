"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

type Props = { mode: "login" | "register"; nextPath: string };

export default function AuthForm({ mode, nextPath }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const payload = mode === "register"
      ? { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""), invitationCode: String(form.get("invitationCode") ?? "") }
      : { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") };
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string; next?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to continue. Please try again.");
        return;
      }
      router.replace(nextPath === "/account" && result.next?.startsWith("/") ? result.next : nextPath);
      router.refresh();
    } catch {
      setError("Unable to reach GuanemX. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="auth-form" onSubmit={submit}>
    {mode === "register" && <label className="auth-field">Full name<input name="name" autoComplete="name" minLength={2} maxLength={80} required /></label>}
    {mode === "register" && <label className="auth-field">Invitation code <small>Optional</small><input name="invitationCode" maxLength={40} autoComplete="off" /></label>}
    <label className="auth-field">Email address<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
    <label className="auth-field">Password<input type="password" name="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 12 : 1} maxLength={72} required />{mode === "register" && <small>Use 12 to 72 characters.</small>}</label>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="button auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}</button>
  </form>;
}
