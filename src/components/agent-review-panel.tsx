"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney, formatRwf, formatUsd, usdToRwf } from "@/lib/money";

// ─── Types ────────────────────────────────────────────────────────────────────

type Client = { name: string; email: string; phone?: string | null };

type Recharge = {
  id: string;
  amount: string;
  currency: string;
  createdAt: string;
  client: Client;
};

type Destination = {
  category: string;
  provider: string;
  accountHolder: string;
  accountNumber: string;
  accountNumberLast4: string;
} | null;

type Withdrawal = {
  id: string;
  amount: string;
  currency: string;
  fee: string;
  netPayout: string;
  sourceBalance: string;
  reference: string;
  createdAt: string;
  client: Client;
  destination: Destination;
};

type ActiveAction = {
  kind: "recharge" | "withdrawal";
  id: string;
  action: "confirm" | "approve" | "reject";
  label: string;
  clientName: string;
  amount: string;
  isDestructive: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  active,
  busy,
  rate,
  onConfirm,
  onCancel,
}: {
  active: ActiveAction;
  busy: boolean;
  rate: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setReason("");
  }, [active.id, active.action]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") onCancel();
  }

  return (
    <div
      className="agent-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onKeyDown={handleKey}
    >
      <div className="agent-modal">
        <p className="label">{active.kind === "recharge" ? "RECHARGE REQUEST" : "WITHDRAWAL REQUEST"}</p>
        <h2 id="modal-title">{active.label}</h2>
        <p className="agent-modal-meta">
          <strong>{active.clientName}</strong> · {formatUsd(active.amount)}
        </p>

        {active.isDestructive && (
          <label className="auth-field" style={{ marginTop: "16px" }}>
            Reason <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
            <textarea
              ref={inputRef}
              className="agent-modal-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Describe why this request is being rejected…"
            />
          </label>
        )}

        {!active.isDestructive && (
          <div className="agent-modal-info">
            {active.kind === "recharge" ? (
              <p>Confirm only after verifying that the off-platform payment was received. This will credit {formatUsd(active.amount)}{Number(rate) > 0 ? ` (≈ ${formatRwf(usdToRwf(active.amount, rate))})` : ""} to the client&apos;s main balance.</p>
            ) : (
              <p>Approval records the payout for manual processing. The gross amount was already deducted from the client&apos;s balance at request time.</p>
            )}
          </div>
        )}

        <div className="agent-modal-actions">
          <button
            className={active.isDestructive ? "button button-danger" : "button"}
            disabled={busy}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? "Saving…" : active.label}
          </button>
          <button className="button button-quiet" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Recharge Card ────────────────────────────────────────────────────────────

function RechargeCard({
  item,
  busyId,
  onAction,
}: {
  item: Recharge;
  busyId: string;
  onAction: (action: ActiveAction) => void;
}) {
  const isBusy = busyId === item.id;
  return (
    <article className="agent-request-card" aria-label={`Recharge from ${item.client.name}`}>
      <div className="agent-request-main">
        <div className="agent-request-amount">
          <strong>{formatMoney(item.amount, item.currency)}</strong>
          <span className="finance-status pending">pending</span>
        </div>
        <div className="agent-request-client">
          <span>{item.client.name}</span>
          <small>{item.client.email}</small>
          {item.client.phone && <small>{item.client.phone}</small>}
        </div>
        <time className="agent-request-time" dateTime={item.createdAt}>
          {relativeDate(item.createdAt)} · {new Date(item.createdAt).toLocaleString()}
        </time>
      </div>
      <div className="agent-request-actions">
        <button
          className="button"
          disabled={isBusy}
          onClick={() =>
            onAction({
              kind: "recharge",
              id: item.id,
              action: "confirm",
              label: "Confirm payment received",
              clientName: item.client.name,
              amount: item.amount,
              isDestructive: false,
            })
          }
        >
          Confirm payment
        </button>
        <button
          className="button button-quiet"
          disabled={isBusy}
          onClick={() =>
            onAction({
              kind: "recharge",
              id: item.id,
              action: "reject",
              label: "Reject recharge",
              clientName: item.client.name,
              amount: item.amount,
              isDestructive: true,
            })
          }
        >
          Reject
        </button>
      </div>
    </article>
  );
}

// ─── Withdrawal Card ──────────────────────────────────────────────────────────

function WithdrawalCard({
  item,
  busyId,
  onAction,
}: {
  item: Withdrawal;
  busyId: string;
  onAction: (action: ActiveAction) => void;
}) {
  const isBusy = busyId === item.id;
  const hasDestination = Boolean(item.destination);
  return (
    <article className="agent-request-card" aria-label={`Withdrawal from ${item.client.name}`}>
      <div className="agent-request-main">
        <div className="agent-request-amount">
          <strong>{formatMoney(item.amount, item.currency)} gross</strong>
          <span className="finance-status pending">pending</span>
        </div>
        <div className="agent-request-breakdown">
          <span>Net payout: <b>{formatMoney(item.netPayout, item.currency)}</b></span>
          <span>Fee: {formatMoney(item.fee, item.currency)}</span>
          <span>From: {item.sourceBalance === "MAIN" ? "Main Balance" : "Growth Balance"}</span>
        </div>
        <div className="agent-request-client">
          <span>{item.client.name}</span>
          <small>{item.client.email}</small>
        </div>
        {item.destination ? (
          <div className="agent-destination-card">
            <span className="agent-destination-label">{item.destination.provider} · {item.destination.category}</span>
            <span>{item.destination.accountHolder}</span>
            <span className="agent-destination-account">{item.destination.accountNumber} <small>(last 4: {item.destination.accountNumberLast4})</small></span>
          </div>
        ) : (
          <p className="agent-no-destination">⚠ No payout destination — cannot approve</p>
        )}
        <span className="agent-request-ref">Ref: {item.reference}</span>
        <time className="agent-request-time" dateTime={item.createdAt}>
          {relativeDate(item.createdAt)} · {new Date(item.createdAt).toLocaleString()}
        </time>
      </div>
      <div className="agent-request-actions">
        <button
          className="button"
          disabled={isBusy || !hasDestination}
          title={!hasDestination ? "No payout destination set" : undefined}
          onClick={() =>
            onAction({
              kind: "withdrawal",
              id: item.id,
              action: "approve",
              label: "Approve for manual payout",
              clientName: item.client.name,
              amount: item.amount,
              isDestructive: false,
            })
          }
        >
          Approve payout
        </button>
        <button
          className="button button-quiet"
          disabled={isBusy}
          onClick={() =>
            onAction({
              kind: "withdrawal",
              id: item.id,
              action: "reject",
              label: "Reject and return funds",
              clientName: item.client.name,
              amount: item.amount,
              isDestructive: true,
            })
          }
        >
          Reject &amp; return
        </button>
      </div>
    </article>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="agent-skeleton-list" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div key={i} className="agent-skeleton-row">
          <div className="agent-skeleton-line wide" />
          <div className="agent-skeleton-line narrow" />
          <div className="agent-skeleton-line medium" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function AgentReviewPanel({ rate }: { rate: string }) {
  const [tab, setTab] = useState<"recharges" | "withdrawals">("recharges");
  const [recharges, setRecharges] = useState<Recharge[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyId, setBusyId] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [rRes, wRes] = await Promise.all([
        fetch("/api/agent/recharges", { cache: "no-store" }),
        fetch("/api/agent/withdrawals", { cache: "no-store" }),
      ]);
      const [rData, wData] = await Promise.all([
        rRes.json() as Promise<{ requests?: Recharge[]; error?: string }>,
        wRes.json() as Promise<{ withdrawals?: Withdrawal[]; error?: string }>,
      ]);
      if (!rRes.ok || !wRes.ok) {
        setError(rData.error ?? wData.error ?? "Unable to load review queue.");
        return;
      }
      setError("");
      setRecharges(rData.requests ?? []);
      setWithdrawals(wData.withdrawals ?? []);
    } catch {
      setError("Unable to reach GuanemX. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleConfirm(reason: string) {
    if (!activeAction) return;
    const { kind, id, action } = activeAction;
    setBusyId(id);
    try {
      const endpoint =
        kind === "recharge"
          ? `/api/agent/recharges/${id}/review`
          : `/api/agent/withdrawals/${id}/review`;
      const body = { action, ...(reason ? { reason } : {}) };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { error?: string; status?: string; creditedAmount?: string; netPayout?: string };
      if (!response.ok) {
        setError(data.error ?? "Review could not be saved.");
        setActiveAction(null);
        return;
      }
      // Build success message
      if (kind === "recharge" && data.status === "CONFIRMED") {
        setToast(`Recharge confirmed — ${formatUsd(data.creditedAmount ?? "0")} credited.`);
      } else if (kind === "recharge" && data.status === "REJECTED") {
        setToast("Recharge rejected.");
      } else if (kind === "withdrawal" && data.status === "APPROVED") {
        setToast(`Withdrawal approved — ${formatUsd(data.netPayout ?? "0")} queued for manual payout.`);
      } else if (kind === "withdrawal" && data.status === "REJECTED") {
        setToast("Withdrawal rejected — funds returned to client.");
      }
      setActiveAction(null);
      await load();
    } catch {
      setError("Unable to reach GuanemX. Try again.");
      setActiveAction(null);
    } finally {
      setBusyId("");
    }
  }

  const pendingRecharges = recharges.length;
  const pendingWithdrawals = withdrawals.length;

  return (
    <>
      {/* Modal */}
      {activeAction && (
        <ConfirmModal
          active={activeAction}
          busy={Boolean(busyId)}
          rate={rate}
          onConfirm={handleConfirm}
          onCancel={() => setActiveAction(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="agent-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      <div className="agent-review-layout">
        {/* Tab bar */}
        <div className="agent-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "recharges"}
            className={tab === "recharges" ? "agent-tab active" : "agent-tab"}
            onClick={() => setTab("recharges")}
          >
            Recharges
            {pendingRecharges > 0 && (
              <span className="agent-tab-badge">{pendingRecharges}</span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={tab === "withdrawals"}
            className={tab === "withdrawals" ? "agent-tab active" : "agent-tab"}
            onClick={() => setTab("withdrawals")}
          >
            Withdrawals
            {pendingWithdrawals > 0 && (
              <span className="agent-tab-badge">{pendingWithdrawals}</span>
            )}
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        {/* Tab panels */}
        <div role="tabpanel">
          {loading ? (
            <Skeleton />
          ) : tab === "recharges" ? (
            recharges.length === 0 ? (
              <div className="agent-empty-state">
                <span className="agent-empty-icon">✓</span>
                <p>No pending recharge requests assigned to you.</p>
              </div>
            ) : (
              <div className="agent-request-list">
                {recharges.map((item) => (
                  <RechargeCard
                    key={item.id}
                    item={item}
                    busyId={busyId}
                    onAction={setActiveAction}
                  />
                ))}
              </div>
            )
          ) : withdrawals.length === 0 ? (
            <div className="agent-empty-state">
              <span className="agent-empty-icon">✓</span>
              <p>No pending withdrawal requests assigned to you.</p>
            </div>
          ) : (
            <div className="agent-request-list">
              {withdrawals.map((item) => (
                <WithdrawalCard
                  key={item.id}
                  item={item}
                  busyId={busyId}
                  onAction={setActiveAction}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
