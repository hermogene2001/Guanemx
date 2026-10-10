"use client";

import { useEffect, useState } from "react";

type Message = { id: string; body: string; createdAt: string; reported?: boolean; author: { id: string; name: string; role: string } };

export default function CommunityPanel({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { const response = await fetch("/api/community/messages", { cache: "no-store" }); if (response.ok) setMessages((await response.json() as { messages: Message[] }).messages); }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setBusy(true); setError("");
    try { const response = await fetch("/api/community/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: form.get("body") }) }); const result = await response.json() as { error?: string }; if (!response.ok) { setError(result.error ?? "Message could not be posted."); return; } formElement.reset(); await load(); }
    catch { setError("Unable to reach GuanemX. Try again."); } finally { setBusy(false); }
  }
  async function report(message: Message) {
    setBusy(true); setError("");
    try { const response = await fetch(`/api/community/messages/${message.id}/report`, { method: "POST" }); const result = await response.json() as { error?: string }; if (!response.ok) { setError(result.error ?? "Message could not be reported."); return; } await load(); }
    catch { setError("Unable to reach GuanemX. Try again."); } finally { setBusy(false); }
  }
  return <div className="community-layout"><section className="finance-card"><span className="label">GENERAL ROOM</span><h2>Community</h2><form className="finance-form" onSubmit={submit}><label className="auth-field">Write a message<textarea name="body" rows={3} maxLength={4000} required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy ? "Posting…" : "Post message"}</button></form><p className="finance-disclaimer">Be respectful. Messages are associated with your account.</p></section><section className="finance-card"><span className="label">DISCUSSION</span><h2>Recent messages</h2>{error && <p className="auth-error" role="alert">{error}</p>}<div className="community-messages">{messages.length === 0 ? <p className="finance-empty">No messages yet. Start the discussion.</p> : messages.map((message) => <article className="community-message" key={message.id}><div><strong>{message.author.name}</strong><small>{new Date(message.createdAt).toLocaleString()}</small></div><p>{message.body}</p>{message.author.id !== userId && <button className="button button-quiet" type="button" disabled={busy || message.reported} onClick={() => void report(message)}>{message.reported ? "Reported" : "Report message"}</button>}</article>)}</div></section></div>;
}
