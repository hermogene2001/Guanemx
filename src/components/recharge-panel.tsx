"use client";

import { useEffect, useState } from "react";
import { formatMoney, formatRwf, formatUsd, usdToRwf } from "@/lib/money";

type CryptoWallet = { id: string; name: string; network: string; address: string };
type Recharge = { id: string; amount: string; currency: string; status: string; createdAt: string; agent: { name: string; phone: string | null }; reference: string | null; paymentMethod: string; cryptoName: string | null; cryptoNetwork: string | null; cryptoAddress: string | null };

const CRYPTO_OPTIONS = [
  { key: "USDT_TRC20", name: "Tether on TRON", network: "TRC20", icon: "₮" },
  { key: "USDT_BEP20", name: "Tether on BNB Smart Chain", network: "BEP20", icon: "₮" },
  { key: "TRX", name: "Tron", network: "TRX", icon: "T" },
  { key: "BTC", name: "Bitcoin", network: "BTC", icon: "₿" },
  { key: "ETH", name: "Ethereum", network: "ETH", icon: "◆" },
  { key: "BINANCE_PAY", name: "Binance Pay", network: "Binance Pay", icon: "₿" },
];

const ECASH_OPTIONS = [
  { key: "MTN_MOMO", name: "MTN Mobile Money", network: "MTN Mobile Money", icon: "M" },
  { key: "AIRTEL_MONEY", name: "Airtel Money", network: "Airtel Money", icon: "A" },
  { key: "ECASH_CODE", name: "E-Cash code", network: "E-Cash", icon: "E" },
];

export default function RechargePanel({ rate, minimumAmount }: { rate: string; minimumAmount: string }) {
  const [items, setItems] = useState<Recharge[]>([]);
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"AGENT" | "CRYPTO" | "BANK_TRANSFER" | "MOBILE_MONEY" | "ECASH" | "CARD">("AGENT");
  const [cryptoWalletId, setCryptoWalletId] = useState("");
  const [selectedCryptoKey, setSelectedCryptoKey] = useState<string>("");
  const [selectedEcashKey, setSelectedEcashKey] = useState<string>("");
  const minimum = Number(minimumAmount);
  const [amount, setAmount] = useState(minimum);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hasRate = Number(rate) > 0;

  async function load() {
    const response = await fetch("/api/recharges", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json() as { recharges: Recharge[]; cryptoWallets: CryptoWallet[] };
      setItems(data.recharges);
      setWallets(data.cryptoWallets);
      setCryptoWalletId((current) => (current && data.cryptoWallets.some((wallet) => wallet.id === current)) ? current : data.cryptoWallets[0]?.id ?? "");
    }
  }
  useEffect(() => { void load(); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = { amount, paymentMethod };
      if (paymentMethod === "CRYPTO") {
        body.cryptoWalletId = cryptoWalletId;
        if (selectedCryptoKey) {
          const opt = CRYPTO_OPTIONS.find((o) => o.key === selectedCryptoKey);
          if (opt) { body.methodProvider = opt.name; body.methodNetwork = opt.network; }
        }
      } else if (paymentMethod === "ECASH") {
        const opt = ECASH_OPTIONS.find((o) => o.key === selectedEcashKey);
        if (opt) { body.methodProvider = opt.name; body.methodNetwork = opt.network; }
      } else if (paymentMethod === "MOBILE_MONEY") {
        body.methodProvider = "Mobile Money";
      } else if (paymentMethod === "BANK_TRANSFER") {
        body.methodProvider = "Bank Transfer";
      } else if (paymentMethod === "CARD") {
        body.methodProvider = "Card Payment";
      }
      const response = await fetch("/api/recharges", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setError(data.error ?? "Recharge request failed."); return; }
      setAmount(minimum);
      await load();
    } catch {
      setError("Unable to reach GuanemX. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="deposit-page">
    <div className="deposit-intro"><span className="deposit-intro-icon" aria-hidden="true">▣</span><div><h2>Deposit funds</h2><p>Choose your preferred payment method</p></div></div>

    <section className="deposit-method-card">
      <header className="deposit-method-heading"><span className="deposit-method-icon" aria-hidden="true">$</span><div><h3>REAL USD</h3><p>Deposit US dollars using a bank transfer or wallet.</p></div></header>
      <button type="button" className={`deposit-method-row deposit-choice ${paymentMethod === "BANK_TRANSFER" ? "selected" : ""}`} onClick={() => setPaymentMethod("BANK_TRANSFER")} aria-pressed={paymentMethod === "BANK_TRANSFER"}><span className="deposit-flag" aria-hidden="true">🏦</span><span className="deposit-method-copy"><strong>Bank Transfer</strong><small>Transfer to bank details provided by agent</small></span><span className="deposit-chevron" aria-hidden="true">›</span></button>
      <button type="button" className={`deposit-method-row deposit-choice ${paymentMethod === "AGENT" ? "selected" : ""}`} onClick={() => setPaymentMethod("AGENT")} aria-pressed={paymentMethod === "AGENT"} style={{ marginTop: "8px" }}><span className="deposit-flag" aria-hidden="true">$</span><span className="deposit-method-copy"><strong>Agent-assisted transfer</strong><small>Transfer details from your assigned agent</small></span><span className="deposit-fast">Manual</span><span className="deposit-chevron" aria-hidden="true">›</span></button>
      <p className="deposit-method-note">After requesting, an agent will be assigned with payment instructions. Your balance is credited only after the agent confirms receipt.</p>
    </section>

    <section className="deposit-method-card crypto-method-card">
      <header className="deposit-method-heading"><span className="deposit-method-icon" aria-hidden="true">₿</span><div><h3>CRYPTOCURRENCY</h3><p>Choose from Tether, Tron, Bitcoin, Ethereum, or Binance Pay</p></div></header>
      <div className="deposit-wallet-options">
        {CRYPTO_OPTIONS.map((opt) => (
          <button key={opt.key} type="button" className={`deposit-wallet-option ${paymentMethod === "CRYPTO" && selectedCryptoKey === opt.key ? "selected" : ""}`} onClick={() => { setPaymentMethod("CRYPTO"); setSelectedCryptoKey(opt.key); const w = wallets.find(x => (x.name.toUpperCase().includes(opt.name.split(" ")[0].toUpperCase()) || x.network.toUpperCase() === opt.network.toUpperCase()) && x.enabled); if (w) setCryptoWalletId(w.id); }} aria-pressed={paymentMethod === "CRYPTO" && selectedCryptoKey === opt.key}>
            <span className="deposit-wallet-symbol">{opt.icon}</span>
            <span className="deposit-wallet-name"><strong>{opt.name}</strong><small>{opt.network}</small></span>
            <span className="deposit-chevron" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
      {wallets.length === 0 && <p className="deposit-method-note">Crypto deposits are not available yet. Check back after the administrator adds wallet addresses.</p>}
      {paymentMethod === "CRYPTO" && wallets.find((wallet) => wallet.id === cryptoWalletId) && <div className="deposit-selected-wallet"><span>After creating your request, contact your assigned agent to confirm the crypto amount for your USD deposit.</span><code>{wallets.find((wallet) => wallet.id === cryptoWalletId)?.address}</code></div>}
    </section>

    <section className="deposit-method-card">
      <header className="deposit-method-heading"><span className="deposit-method-icon" aria-hidden="true">📱</span><div><h3>E-CASH</h3><p>Pay using mobile money or e-cash code</p></div></header>
      <div className="deposit-wallet-options">
        {ECASH_OPTIONS.map((opt) => (
          <button key={opt.key} type="button" className={`deposit-wallet-option ${paymentMethod === "ECASH" && selectedEcashKey === opt.key ? "selected" : ""}`} onClick={() => { setPaymentMethod("ECASH"); setSelectedEcashKey(opt.key); }} aria-pressed={paymentMethod === "ECASH" && selectedEcashKey === opt.key}>
            <span className="deposit-wallet-symbol">{opt.icon}</span>
            <span className="deposit-wallet-name"><strong>{opt.name}</strong><small>{opt.network}</small></span>
            <span className="deposit-chevron" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
      <button type="button" className={`deposit-method-row deposit-choice ${paymentMethod === "MOBILE_MONEY" ? "selected" : ""}`} onClick={() => setPaymentMethod("MOBILE_MONEY")} aria-pressed={paymentMethod === "MOBILE_MONEY"} style={{ marginTop: "10px" }}><span className="deposit-flag" aria-hidden="true">📲</span><span className="deposit-method-copy"><strong>MTN / Airtel Mobile Money</strong><small>General mobile money transfer via agent</small></span><span className="deposit-chevron" aria-hidden="true">›</span></button>
      <p className="deposit-method-note">An agent will provide payment instructions for your selected method after requesting a deposit.</p>
    </section>

    <section className="deposit-method-card">
      <header className="deposit-method-heading"><span className="deposit-method-icon" aria-hidden="true">💳</span><div><h3>CARDS</h3><p>Pay with a debit or credit card</p></div></header>
      <button type="button" className={`deposit-method-row deposit-choice ${paymentMethod === "CARD" ? "selected" : ""}`} onClick={() => setPaymentMethod("CARD")} aria-pressed={paymentMethod === "CARD"}><span className="deposit-flag" aria-hidden="true">💳</span><span className="deposit-method-copy"><strong>Visa / Mastercard</strong><small>Card deposit via agent assistance</small></span><span className="deposit-chevron" aria-hidden="true">›</span></button>
      <p className="deposit-method-note">Card payments are processed with agent assistance. You&apos;ll receive instructions after creating your request.</p>
    </section>

    <div className="deposit-columns">
      <section className="deposit-form-card">
        <div className="deposit-section-title"><span className="deposit-small-icon" aria-hidden="true">＋</span><div><h3>Deposit amount</h3><p>Request a USD recharge via your selected method</p></div></div>
        <form className="finance-form" onSubmit={submit}>
          <label className="auth-field">Deposit value (USD)<input type="number" min={minimum} max={3000000} step={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} required /><small>Minimum deposit: {formatUsd(minimum)}. For crypto, your agent confirms the token amount before you send.</small>{hasRate && Number.isFinite(amount) && amount > 0 && <small>≈ {formatRwf(usdToRwf(amount, rate))} at the current rate.</small>}</label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="deposit-submit" disabled={busy || (paymentMethod === "CRYPTO" && !cryptoWalletId)}>{busy ? "Submitting…" : "Create deposit request ›"}</button>
        </form>
        <p className="finance-disclaimer">Your wallet is credited only after the assigned agent confirms receipt.</p>
      </section>

      <section className="deposit-activity-card">
        <div className="deposit-section-title"><span className="deposit-small-icon" aria-hidden="true">↻</span><div><h3>Recent deposits</h3><p>Your recharge activity</p></div></div>
        {items.length === 0 ? <p className="finance-empty">No deposit requests yet.</p> : <div className="finance-list">{items.map((item) => <article className="finance-row" key={item.id}><div><strong>{formatMoney(item.amount, item.currency)}</strong><small>{new Date(item.createdAt).toLocaleString()}</small><small>{item.paymentMethod === "CRYPTO" ? `${item.cryptoName || ""} · ${item.cryptoNetwork || ""}` : item.paymentMethod === "ECASH" ? `${item.cryptoName || "E-Cash"} · ${item.cryptoNetwork || ""}` : item.paymentMethod === "MOBILE_MONEY" ? "Mobile Money" : item.paymentMethod === "CARD" ? "Card (Visa/Mastercard)" : item.paymentMethod === "BANK_TRANSFER" ? "Bank Transfer" : "Agent-assisted transfer"}</small></div><div><span className={`finance-status ${item.status.toLowerCase()}`}>{item.status.toLowerCase()}</span><small>Agent: {item.agent.name}{item.agent.phone ? ` · ${item.agent.phone}` : ""}</small></div>{item.paymentMethod === "CRYPTO" && item.cryptoAddress && <p className="finance-instruction">Confirm the crypto amount with {item.agent.name}{item.agent.phone ? ` at ${item.agent.phone}` : ""}, then send on {item.cryptoNetwork} to <strong>{item.cryptoAddress}</strong>. Your USD balance is credited after the agent confirms receipt.</p>}{item.status === "PENDING" && item.paymentMethod !== "CRYPTO" && <p className="finance-instruction">Send {formatUsd(item.amount)}{hasRate ? ` (≈ ${formatRwf(usdToRwf(item.amount, rate))})` : ""} via {item.paymentMethod === "BANK_TRANSFER" ? "Bank Transfer" : item.paymentMethod === "MOBILE_MONEY" ? "Mobile Money" : item.paymentMethod === "ECASH" ? (item.cryptoName || "E-Cash") : item.paymentMethod === "CARD" ? "Card" : "the agent"} to {item.agent.name}{item.agent.phone ? ` at ${item.agent.phone}` : ""}. Wait for confirmation before using the balance.</p>}</article>)}</div>}
      </section>
    </div>
  </div>;
}
