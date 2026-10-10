"use client";

import { useEffect, useState } from "react";

type ModerationMessage = { id: string; body: string; createdAt: string; reportedAt: string | null; deletedAt: string | null; author: { name: string; email: string } };

export default function CommunityModerationPanel() {
  const [messages, setMessages] = useState<ModerationMessage[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  async function load() {
    const response = await fetch("/api/admin/community", { cache: "no-store" });
    if (response.ok) setMessages((await response.json() as { messages: ModerationMessage[] }).messages);
  }
  useEffect(() => { void load(); }, []);
  async function act(message: ModerationMessage, action: "remove" | "restore" | "dismiss") {
    setBusyId(message.id); setError("");
    try {
      const response = await fetch("/api/admin/community", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: message.id, action }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setError(result.error ?? "Moderation action failed."); return; }
      await load();
    } catch { setError("Unable to reach GuanemX. Try again."); } finally { setBusyId(""); }
  }
  return <section className="finance-card ledger-card"><span className="label">COMMUNITY SAFETY</span><h2>Reported and removed messages</h2>{error && <p className="auth-error" role="alert">{error}</p>}{messages.length === 0 ? <p className="finance-empty">No messages need moderation.</p> : <div className="finance-list">{messages.map((message) => <article className="finance-row" key={message.id}><div><strong>{message.author.name} · {message.author.email}</strong><small>{new Date(message.createdAt).toLocaleString()} · {message.deletedAt ? "Removed" : message.reportedAt ? `Reported ${new Date(message.reportedAt).toLocaleString()}` : "Visible"}</small><p>{message.body}</p></div><div className="agent-review-actions">{message.deletedAt ? <button className="button" disabled={busyId === message.id} onClick={() => void act(message, "restore")}>Restore</button> : <button className="button button-quiet" disabled={busyId === message.id} onClick={() => void act(message, "remove")}>Remove</button>}{message.reportedAt && <button className="button button-quiet" disabled={busyId === message.id} onClick={() => void act(message, "dismiss")}>Dismiss report</button>}</div></article>)}</div>}</section>;
}
