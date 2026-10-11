"use client";

import { useCallback, useEffect, useState } from "react";

type Settings = {
  usdToRwfRate: string;
  withdrawalFeePercent: string;
  referralBonusPercent: string;
  updatedAt: string | null;
  updatedById: string | null;
};

export default function PlatformSettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rate, setRate] = useState("");
  const [withdrawalFee, setWithdrawalFee] = useState("");
  const [referralBonus, setReferralBonus] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = useCallback((next: Settings) => {
    setSettings(next);
    setRate(next.usdToRwfRate);
    setWithdrawalFee(next.withdrawalFeePercent);
    setReferralBonus(next.referralBonusPercent);
  }, []);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/settings", { cache: "no-store" });
    const data = await response.json() as { settings?: Settings; error?: string };
    if (!response.ok || !data.settings) { setError(data.error ?? "Unable to load platform settings."); return; }
    apply(data.settings);
  }, [apply]);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usdToRwfRate: Number(rate), withdrawalFeePercent: Number(withdrawalFee), referralBonusPercent: Number(referralBonus) }),
      });
      const data = await response.json() as { settings?: Settings; error?: string };
      if (!response.ok || !data.settings) { setError(data.error ?? "Platform settings could not be saved."); return; }
      apply(data.settings);
      setNotice("Platform settings saved. New requests use these values.");
    } catch { setError("Unable to reach GuanemX. Try again."); }
    finally { setBusy(false); }
  }

  if (!settings) return <section className="finance-card"><span className="label">PLATFORM SETTINGS</span><h2>Currency and fees</h2>{error ? <p className="auth-error" role="alert">{error}</p> : <p className="finance-empty">Loading settings…</p>}</section>;

  return <section className="finance-card">
    <span className="label">PLATFORM SETTINGS</span>
    <h2>Currency and fees</h2>
    <p>GuanemX holds balances in US dollars. Set how many Rwandan francs equal one dollar for off-platform settlement, and the percentages applied to withdrawals and referral bonuses.</p>
    <form className="finance-form" onSubmit={submit}>
      <label className="auth-field">USD → RWF rate (RWF per $1)<input type="number" min="0.0001" step="0.0001" value={rate} onChange={(event) => setRate(event.target.value)} required /><small>Shown to clients and agents as the Rwandan-franc equivalent of a dollar amount.</small></label>
      <label className="auth-field">Withdrawal fee (%)<input type="number" min="0" max="100" step="0.01" value={withdrawalFee} onChange={(event) => setWithdrawalFee(event.target.value)} required /><small>Deducted from every new withdrawal request.</small></label>
      <label className="auth-field">Referral bonus (%)<input type="number" min="0" max="100" step="0.01" value={referralBonus} onChange={(event) => setReferralBonus(event.target.value)} required /><small>Percentage of a confirmed recharge credited to the inviter. Set to 0 to disable.</small></label>
      {error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="finance-success" role="status">{notice}</p>}
      <button className="button" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
    </form>
    <p className="finance-disclaimer">Fees apply to future requests only; already-recorded transactions keep the values captured when they were created.{settings.updatedAt ? ` Last updated ${new Date(settings.updatedAt).toLocaleString()}.` : ""}</p>
  </section>;
}
