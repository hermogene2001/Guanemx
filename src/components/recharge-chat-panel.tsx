"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string; role: string };
};

export default function RechargeChatPanel({ requestId, currentUserId, title = "Chat with your assigned agent" }: { requestId: string; currentUserId: string; title?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [chatClosed, setChatClosed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const source = new EventSource(`/api/recharges/${requestId}/messages/stream`);
    source.onopen = () => { setConnected(true); setError(""); };
    source.onerror = () => setConnected(false);
    source.addEventListener("snapshot", (event) => {
      const data = JSON.parse((event as MessageEvent<string>).data) as { messages: ChatMessage[] };
      setMessages(data.messages);
      setLoading(false);
    });
    source.addEventListener("message", (event) => {
      const data = JSON.parse((event as MessageEvent<string>).data) as { message: ChatMessage };
      setMessages((current) => current.some((message) => message.id === data.message.id) ? current : [...current, data.message]);
    });
    source.addEventListener("closed", () => { setChatClosed(true); source.close(); });
    source.addEventListener("stream-error", (event) => {
      const data = JSON.parse((event as MessageEvent<string>).data) as { error: string };
      setError(data.error);
    });
    return () => source.close();
  }, [requestId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/recharges/${requestId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await response.json() as { error?: string; message?: ChatMessage };
      if (!response.ok) { setError(data.error ?? "Message could not be sent."); return; }
      setBody("");
      if (data.message) setMessages((current) => current.some((message) => message.id === data.message!.id) ? current : [...current, data.message!]);
    } catch {
      setError("Unable to send message. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="recharge-chat" aria-label={title}>
    <header><div><strong>{title}</strong><small>Messages are shared only with the client and their assigned agent/admin.</small></div><span className={connected ? "connected" : "reconnecting"}>{chatClosed ? "CLOSED" : connected ? "LIVE" : "RECONNECTING"}</span></header>
    <div className="recharge-chat-messages" aria-live="polite" aria-relevant="additions text">
      {loading && messages.length === 0 ? <p className="recharge-chat-empty">Loading chat…</p> : messages.length === 0 ? <p className="recharge-chat-empty">No messages yet. Ask a question or send a message to get started.</p> : messages.map((message) => {
        const mine = message.sender.id === currentUserId;
        return <article key={message.id} className={`recharge-chat-message ${mine ? "mine" : "theirs"}`}>
          <div><strong>{mine ? "You" : message.sender.name}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
          <p>{message.body}</p>
        </article>;
      })}
      <div ref={bottomRef} />
    </div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {chatClosed && <p className="recharge-chat-closed">This chat closed when the recharge request was completed or cancelled.</p>}
    <form className="recharge-chat-form" onSubmit={sendMessage}>
      <label className="sr-only" htmlFor={`recharge-chat-${requestId}`}>Write a message</label>
      <textarea id={`recharge-chat-${requestId}`} value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={2} placeholder={chatClosed ? "Chat closed" : "Write a message…"} disabled={chatClosed} required />
      <button className="button" type="submit" disabled={busy || chatClosed || !body.trim()}>{busy ? "Sending…" : "Send"}</button>
    </form>
  </section>;
}
