"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";

// ─── Types ────────────────────────────────────────────────────────────────────

type RechargeHistoryItem = {
  kind: "recharge";
  id: string;
  status: string;
  amount: string;
  currency: string;
  reviewReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  client: { name: string; email: string };
};

type WithdrawalHistoryItem = {
  kind: "withdrawal";
  id: string;
  status: string;
  amount: string;
  currency: string;
  fee: string;
  netPayout: string;
  sourceBalance: string;
  reference: string;
  reviewReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  client: { name: string; email: string };
  destination: {
    provider: string;
    category: string;
    accountHolder: string;
    accountNumber: string;
    accountNumberLast4: string;
  } | null;
};

type HistoryItem = RechargeHistoryItem | WithdrawalHistoryItem;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cls = ["CONFIRMED", "APPROVED", "COMPLETED"].includes(status.toUpperCase())
    ? "finance-status confirmed"
    : status.toUpperCase() === "REJECTED"
    ? "finance-status rejected"
    : "finance-status pending";
  return <span className={cls}>{status.toLowerCase()}</span>;
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function HistoryRow({ item }: { item: HistoryItem }) {
  const reviewedDate = item.reviewedAt
    ? new Date(item.reviewedAt).toLocaleString()
    : "—";

  return (
    <article className="finance-row agent-history-row">
      <div className="agent-history-main">
        <div className="agent-history-top">
          <span className="agent-history-kind">
            {item.kind === "recharge" ? "Recharge" : "Withdrawal"}
          </span>
          <StatusBadge status={item.status} />
        </div>
        <strong>
          {formatMoney(item.amount, item.currency)}
          {item.kind === "withdrawal" && (
            <small> gross · net {formatMoney(item.netPayout, item.currency)} · fee {formatMoney(item.fee, item.currency)}</small>
          )}
        </strong>
        <small>
          {item.client.name} · {item.client.email}
        </small>
        {item.kind === "withdrawal" && item.destination && (
          <small>
            {item.destination.provider} ({item.destination.category}) ·{" "}
            {item.destination.accountHolder} · ···{item.destination.accountNumberLast4}
          </small>
        )}
        {item.reviewReason && (
          <small className="agent-history-reason">Reason: {item.reviewReason}</small>
        )}
      </div>
      <time className="agent-history-time" dateTime={item.reviewedAt ?? item.createdAt}>
        {reviewedDate}
      </time>
    </article>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AgentHistoryPanel() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  async function load(cursor?: string) {
    const url = `/api/agent/history${cursor ? `?cursor=${cursor}` : ""}`;
    try {
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json() as { items?: HistoryItem[]; nextCursor?: string | null; error?: string };
      if (!response.ok) { setError(data.error ?? "Unable to load history."); return; }
      setItems((prev) => cursor ? [...prev, ...(data.items ?? [])] : (data.items ?? []));
      setNextCursor(data.nextCursor ?? null);
      setError("");
    } catch {
      setError("Unable to reach GuanemX. Try again.");
    }
  }

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, []);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    await load(nextCursor);
    setLoadingMore(false);
  }

  if (loading) {
    return (
      <div className="finance-card" style={{ marginTop: "24px" }}>
        <span className="label">REVIEW HISTORY</span>
        <h2>Recent decisions</h2>
        <div className="agent-skeleton-list" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="agent-skeleton-row">
              <div className="agent-skeleton-line wide" />
              <div className="agent-skeleton-line narrow" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="finance-card" style={{ marginTop: "24px" }}>
      <span className="label">REVIEW HISTORY</span>
      <h2>Recent decisions</h2>
      <p>All recharge and withdrawal requests you have reviewed, most recent first.</p>

      {error && <p className="auth-error" role="alert">{error}</p>}

      {items.length === 0 ? (
        <p className="finance-empty">No reviews recorded yet.</p>
      ) : (
        <div className="finance-list">
          {items.map((item) => (
            <HistoryRow key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </div>
      )}

      {nextCursor && (
        <button
          className="button button-quiet"
          style={{ marginTop: "16px", width: "100%", justifyContent: "center" }}
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
