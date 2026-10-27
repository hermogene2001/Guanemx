"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Message = { id: string; body: string; createdAt: string; reported?: boolean; author: { id: string; name: string; role: string } };

export default function CommunityPanel({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");
  const loading = useRef(false);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const response = await fetch("/api/community/messages", { cache: "no-store" });
      if (!response.ok) throw new Error("Messages could not be refreshed.");
      const data = await response.json() as { messages: Message[] };
      setMessages(data.messages);
      setError("");
    } catch {
      setError("Unable to refresh community messages.");
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let reconnectDelay = 1000;
    let stopped = false;

    function connect() {
      if (stopped) return;
      setConnection("connecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/community/live`);
      socket.addEventListener("open", () => {
        reconnectDelay = 1000;
        setConnection("live");
      });
      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as { type?: string; message?: Message };
          if (payload.type !== "message" || !payload.message) return;
          setMessages((current) => current.some((message) => message.id === payload.message?.id)
            ? current
            : [...current, payload.message!].slice(-100));
        } catch {
          // Ignore malformed frames and leave the connection open.
        }
      });
      socket.addEventListener("close", scheduleReconnect, { once: true });
      socket.addEventListener("error", () => socket?.close(), { once: true });
    }

    function scheduleReconnect() {
      if (stopped) return;
      setConnection("offline");
      reconnectTimer = window.setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    }

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/community/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: form.get("body") }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Message could not be posted.");
        return;
      }
      formElement.reset();
      await load();
    } catch {
      setError("Unable to reach GuanemX. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function report(message: Message) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/community/messages/${message.id}/report`, { method: "POST" });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Message could not be reported.");
        return;
      }
      await load();
    } catch {
      setError("Unable to reach GuanemX. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="community-layout">
      <section className="finance-card">
        <span className="label">GENERAL ROOM</span>
        <h2>Community</h2>
        <form className="finance-form" onSubmit={submit}>
          <label className="auth-field">Write a message<textarea name="body" rows={3} maxLength={4000} required /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button" disabled={busy}>{busy ? "Posting…" : "Post message"}</button>
        </form>
        <p className="finance-disclaimer">Be respectful. Messages are associated with your account.</p>
      </section>
      <section className="finance-card">
        <span className="label">DISCUSSION</span>
        <h2>Recent messages</h2>
        <p className={`community-live-note ${connection}`} role="status">{connection === "live" ? "Live updates connected." : connection === "connecting" ? "Connecting to live updates…" : "Connection interrupted. Reconnecting…"}</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="community-messages" aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 ? <p className="finance-empty">No messages yet. Start the discussion.</p> : messages.map((message) => (
            <article className="community-message" key={message.id}>
              <div><strong>{message.author.name}</strong><small>{new Date(message.createdAt).toLocaleString()}</small></div>
              <p>{message.body}</p>
              {message.author.id !== userId && <button className="button button-quiet" type="button" disabled={busy || message.reported} onClick={() => void report(message)}>{message.reported ? "Reported" : "Report message"}</button>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
