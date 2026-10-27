"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney, formatRwf, formatUsd, usdToRwf } from "@/lib/money";
import RechargeChatPanel from "@/components/recharge-chat-panel";
import { QRCodeSVG } from "qrcode.react";

type CryptoWallet = { id: string; name: string; network: string; address: string };
type Recharge = { id: string; amount: string; currency: string; status: string; createdAt: string; reviewedAt: string | null; paymentInstructions: string | null; instructionsSentAt: string | null; instructionsSender: { name: string; role: string } | null; proofContentType: string | null; proofFileName: string | null; proofUploadedAt: string | null; agent: { name: string; phone: string | null }; reference: string | null; paymentMethod: string; cryptoName: string | null; cryptoNetwork: string | null; cryptoAddress: string | null };
type PaymentScreen = "methods" | "details" | "processing" | "success" | "cancelled";

const CRYPTO_OPTIONS = [
  { key: "USDT_TRC20", name: "Tether on TRON", network: "TRC20", icon: "₮" },
  { key: "USDT_BEP20", name: "Tether on BNB Smart Chain", network: "BEP20", icon: "₮" },
  { key: "TRX", name: "Tron", network: "TRX", icon: "T" },
  { key: "BTC", name: "Bitcoin", network: "BTC", icon: "₿" },
  { key: "ETH", name: "Ethereum", network: "ETH", icon: "◆" },
  { key: "BINANCE_PAY", name: "Binance Pay", network: "Binance Pay", icon: "₿" },
];

const ECASH_OPTIONS = [
  { key: "MTN_MOMO", name: "MTN Mobile Money (PWC)", network: "MTN Mobile Money", icon: "M" },
  { key: "AIRTEL_MONEY", name: "Airtel Money", network: "Airtel Money", icon: "A" },
  { key: "ECASH_CODE", name: "E-Cash code", network: "E-Cash", icon: "E" },
];

function rechargeMethodLabel(item: Recharge) {
  if (item.paymentMethod === "CRYPTO") return `${item.cryptoName ?? "Crypto"}${item.cryptoNetwork ? ` · ${item.cryptoNetwork}` : ""}`;
  if (item.paymentMethod === "ECASH") return item.cryptoName ?? "E-Cash";
  if (item.paymentMethod === "BANK_TRANSFER") return "Bank Transfer";
  if (item.paymentMethod === "CARD") return "Visa / Mastercard";
  if (item.paymentMethod === "MOBILE_MONEY") return "Mobile Money";
  return "Agent-assisted transfer";
}

export default function RechargePanel({ userId, rate, minimumAmount }: { userId: string; rate: string; minimumAmount: string }) {
  const [items, setItems] = useState<Recharge[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [paymentScreen, setPaymentScreen] = useState<PaymentScreen>("methods");
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"AGENT" | "CRYPTO" | "BANK_TRANSFER" | "MOBILE_MONEY" | "ECASH" | "CARD">("AGENT");
  const [cryptoWalletId, setCryptoWalletId] = useState("");
  const [selectedCryptoKey, setSelectedCryptoKey] = useState<string>("");
  const [selectedEcashKey, setSelectedEcashKey] = useState<string>("");
  const minimum = Number(minimumAmount);
  const [amount, setAmount] = useState(minimum);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState("");
  const [proofNotice, setProofNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const hasRate = Number(rate) > 0;
  const activeRequest = items.find((item) => item.id === activeRequestId);
  const isMtnSelected = paymentMethod === "ECASH" && selectedEcashKey === "MTN_MOMO";
  const selectedCrypto = CRYPTO_OPTIONS.find((option) => option.key === selectedCryptoKey);
  const selectedEcash = ECASH_OPTIONS.find((option) => option.key === selectedEcashKey);
  const paymentTitle = paymentMethod === "BANK_TRANSFER" ? "Bank transfer" : paymentMethod === "AGENT" ? "Agent-assisted transfer" : paymentMethod === "CRYPTO" ? selectedCrypto?.name ?? "Cryptocurrency" : paymentMethod === "ECASH" ? selectedEcash?.name ?? "E-Cash" : paymentMethod === "CARD" ? "Visa / Mastercard" : "Mobile Money";
  const activeIsMtn = activeRequest?.paymentMethod === "ECASH" && activeRequest.cryptoName?.includes("MTN Mobile Money");
  const screenPaymentTitle = activeRequest && (paymentScreen === "processing" || paymentScreen === "success" || paymentScreen === "cancelled") ? rechargeMethodLabel(activeRequest) : paymentTitle;
  const screenMethod = activeRequest && paymentScreen !== "details" ? activeRequest.paymentMethod : paymentMethod;
  const screenPaymentIcon = (isMtnSelected || activeIsMtn) ? "MTN" : screenMethod === "CRYPTO" ? selectedCrypto?.icon ?? "₿" : screenMethod === "CARD" ? "💳" : screenMethod === "BANK_TRANSFER" ? "🏦" : screenMethod === "ECASH" ? selectedEcash?.icon ?? "E" : "₵";

  async function copyValue(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => current === key ? "" : current), 1800);
    } catch {
      setError("Copy failed. You can select the text and copy it manually.");
    }
  }

  async function load() {
    const response = await fetch("/api/recharges", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json() as { recharges: Recharge[]; cryptoWallets: CryptoWallet[] };
      setItems(data.recharges);
      const pendingRequest = data.recharges.find((item) => item.status === "PENDING");
      setActiveRequestId((current) => current ?? pendingRequest?.id ?? null);
      if (pendingRequest) setPaymentScreen("processing");
      setWallets(data.cryptoWallets);
      setCryptoWalletId((current) => (current && data.cryptoWallets.some((wallet) => wallet.id === current)) ? current : data.cryptoWallets[0]?.id ?? "");
    }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (activeRequest?.status !== "PENDING") return;
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(timer);
  }, [activeRequest?.status, activeRequestId]);
  useEffect(() => {
    if (activeRequest?.status === "CONFIRMED" && paymentScreen === "processing") setPaymentScreen("success");
    if (activeRequest?.status === "CANCELLED" && paymentScreen === "processing") setPaymentScreen("cancelled");
  }, [activeRequest?.status, paymentScreen]);

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
      const data = await response.json() as { error?: string; id?: string };
      if (!response.ok) { setError(data.error ?? "Recharge request failed."); return; }
      if (data.id) {
        setActiveRequestId(data.id);
        setPaymentScreen("processing");
      }
      setAmount(minimum);
      await load();
    } catch {
      setError("Unable to reach GuanemX. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelActiveRequest() {
    if (!activeRequest || activeRequest.status !== "PENDING") return;
    if (!window.confirm("Cancel this recharge request? The agent will no longer process it.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/recharges/${activeRequest.id}/cancel`, { method: "POST" });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Recharge request could not be cancelled.");
        await load();
        return;
      }
      setItems((current) => current.map((item) => item.id === activeRequest.id ? { ...item, status: "CANCELLED" } : item));
      setPaymentScreen("cancelled");
    } catch {
      setError("Unable to reach GuanemX. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPaymentProof(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRequest || activeRequest.status !== "PENDING") return;
    const form = event.currentTarget;
    setProofBusy(true);
    setProofError("");
    setProofNotice("");
    try {
      const response = await fetch(`/api/recharges/${activeRequest.id}/proof`, { method: "POST", body: new FormData(form) });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setProofError(data.error ?? "Payment proof could not be uploaded."); return; }
      form.reset();
      setProofNotice("Payment proof uploaded. Your agent can now review it.");
      await load();
    } catch {
      setProofError("Unable to reach GuanemX. Try again.");
    } finally {
      setProofBusy(false);
    }
  }

  function choosePaymentMethod(method: typeof paymentMethod, providerKey = "") {
    setPaymentMethod(method);
    if (method === "ECASH") setSelectedEcashKey(providerKey);
    if (method === "CRYPTO") {
      setSelectedCryptoKey(providerKey);
      const option = CRYPTO_OPTIONS.find((item) => item.key === providerKey);
      const wallet = option && (wallets.find((item) => item.network.toUpperCase() === option.network.toUpperCase()) ?? wallets.find((item) => item.name.toUpperCase().includes(option.name.split(" ")[0].toUpperCase())));
      setCryptoWalletId(wallet?.id ?? "");
    }
    setError("");
    setPaymentScreen("details");
  }

  if (paymentScreen !== "methods") {
    return <div className="deposit-page mtn-wizard-page">
      {paymentScreen === "details" && <button type="button" className="mtn-back-button" onClick={() => { setPaymentScreen("methods"); setPaymentMethod("AGENT"); setSelectedEcashKey(""); setSelectedCryptoKey(""); }}>
        <span aria-hidden="true">←</span> Back to payment methods
      </button>}
      <section className="mtn-screen-card" aria-live="polite">
        <header className="mtn-screen-brand"><span className={(isMtnSelected || activeIsMtn) ? "mtn-brand-mark" : "payment-method-mark"}>{screenPaymentIcon}</span><div><h2>{screenPaymentTitle}</h2><p>{(isMtnSelected || activeIsMtn) ? "Pay with code (PWC)" : "Recharge instructions and request status"}</p></div></header>

        {paymentScreen === "details" && <>
          <div className="mtn-screen-title"><span>STEP 2 OF 4</span><h1>Enter your deposit amount</h1><p>Create a request, then follow the payment instructions from your assigned agent or admin.</p></div>
          <div className="mtn-how-card"><strong>{isMtnSelected ? "MTN Mobile Money steps" : paymentMethod === "CRYPTO" ? "Crypto payment steps" : `${paymentTitle} steps`}</strong>{isMtnSelected ? <ol><li>Enter your deposit amount and tap Pay Now.</li><li>Your agent or admin will post a PWC code on the next screen.</li><li>Dial <b>*182*8*1#</b> on your MTN phone, enter the code, and confirm the payment.</li></ol> : paymentMethod === "CRYPTO" ? <ol><li>Enter your USD deposit amount and create a request.</li><li>Wait for your agent to confirm the token amount and payment instructions.</li><li>Send on the specified network only after your agent confirms the amount.</li></ol> : <ol><li>Enter your deposit amount and create a request.</li><li>Your agent or admin will post the payment details on the next screen.</li><li>Follow the instructions, then wait for confirmation.</li></ol>}<small>{isMtnSelected ? "The PWC code is provided by your agent or admin; it is not generated automatically." : "Do not send money until the payment instructions appear on the processing screen."}</small></div>
          {paymentMethod === "CRYPTO" && wallets.find((wallet) => wallet.id === cryptoWalletId) && <div className="deposit-selected-wallet"><span>Wallet destination · {wallets.find((wallet) => wallet.id === cryptoWalletId)?.network}. Confirm the token amount with your agent before sending.</span><div className="crypto-address-card"><div className="crypto-qr-code"><QRCodeSVG value={wallets.find((wallet) => wallet.id === cryptoWalletId)!.address} size={176} level="M" includeMargin title="Scan to copy the crypto wallet address" /></div><div className="crypto-address-details"><code>{wallets.find((wallet) => wallet.id === cryptoWalletId)?.address}</code><button type="button" className="mtn-copy-button" onClick={() => void copyValue(wallets.find((wallet) => wallet.id === cryptoWalletId)!.address, `wallet-${cryptoWalletId}`)}>{copiedKey === `wallet-${cryptoWalletId}` ? "Copied" : "Copy address"}</button></div></div></div>}
          {paymentMethod === "CRYPTO" && !wallets.find((wallet) => wallet.id === cryptoWalletId) && <p className="auth-error" role="alert">No wallet is configured for this cryptocurrency yet.</p>}
          <form className="finance-form mtn-amount-form" onSubmit={submit}>
            <label className="auth-field">Deposit value (USD)<input type="number" min={minimum} max={3000000} step={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} required /><small>Minimum deposit: {formatUsd(minimum)}.</small>{hasRate && Number.isFinite(amount) && amount > 0 && <small>≈ {formatRwf(usdToRwf(amount, rate))} at the current rate.</small>}</label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="deposit-submit" disabled={busy || (paymentMethod === "CRYPTO" && !cryptoWalletId)}>{busy ? "Creating request…" : isMtnSelected ? "Pay Now  →" : "Create deposit request  →"}</button>
          </form>
        </>}

        {paymentScreen === "processing" && <div className="mtn-status-screen">
          {activeRequest?.status === "REJECTED" ? <>
            <span className="mtn-step-label">STEP 3 OF 4</span><div className="mtn-status-icon rejected" aria-hidden="true">!</div><h1>Payment needs attention</h1>
            <p>Your agent could not confirm this recharge. Contact {activeRequest.agent.name}{activeRequest.agent.phone ? ` at ${activeRequest.agent.phone}` : ""} for help.</p>
            <button className="deposit-submit" type="button" onClick={() => { setActiveRequestId(null); setPaymentScreen("details"); }}>Try another deposit</button>
          </> : <>
            <span className="mtn-step-label">STEP 3 OF 4</span><div className="mtn-status-icon processing" aria-hidden="true"><span /></div><h1>Processing your payment</h1>
            <p>Your request is being handled by {activeRequest?.agent.name ?? "your assigned agent"}.</p>
            {activeRequest && <dl className="mtn-payment-summary"><div><dt>Amount</dt><dd>{formatUsd(activeRequest.amount)}{hasRate && <small className="mtn-rwf-amount">≈ {formatRwf(usdToRwf(activeRequest.amount, rate))}</small>}</dd></div><div><dt>Method</dt><dd>{rechargeMethodLabel(activeRequest)}</dd></div><div><dt>Status</dt><dd className="pending-label">Waiting for confirmation</dd></div><div><dt>Assigned agent</dt><dd className="mtn-agent-contact"><strong>{activeRequest.agent.name}</strong>{activeRequest.agent.phone && <span><a href={`tel:${activeRequest.agent.phone}`}>{activeRequest.agent.phone}</a><button type="button" className="mtn-copy-button" onClick={() => void copyValue(activeRequest.agent.phone!, `phone-${activeRequest.id}`)}>{copiedKey === `phone-${activeRequest.id}` ? "Copied" : "Copy number"}</button></span>}</dd></div></dl>}
            {activeRequest?.paymentMethod === "CRYPTO" && activeRequest.cryptoAddress && <div className="mtn-client-instructions">
              <div><strong>Crypto destination</strong><small>{activeRequest.cryptoNetwork ? `Network: ${activeRequest.cryptoNetwork}` : "Confirm the network with your agent"}</small></div>
              <div className="crypto-address-card"><div className="crypto-qr-code"><QRCodeSVG value={activeRequest.cryptoAddress} size={176} level="M" includeMargin title="Scan to copy the crypto wallet address" /></div><div className="crypto-address-details"><code>{activeRequest.cryptoAddress}</code><button type="button" className="mtn-copy-button" onClick={() => void copyValue(activeRequest.cryptoAddress!, `address-${activeRequest.id}`)}>{copiedKey === `address-${activeRequest.id}` ? "Copied" : "Copy address"}</button></div></div>
              <small>Confirm the token amount with your agent before sending.</small>
            </div>}
            {activeRequest?.paymentInstructions ? <div className="mtn-client-instructions">
              <div className="mtn-copy-row"><div><strong>Payment instructions / code</strong><small>{activeRequest.instructionsSender ? `From ${activeRequest.instructionsSender.name} · ${activeRequest.instructionsSender.role.toLowerCase()}` : "From your payment team"}{activeRequest.instructionsSentAt ? ` · ${new Date(activeRequest.instructionsSentAt).toLocaleString()}` : ""}</small></div><button type="button" className="mtn-copy-button" onClick={() => void copyValue(activeRequest.paymentInstructions!, `instructions-${activeRequest.id}`)}>{copiedKey === `instructions-${activeRequest.id}` ? "Copied" : "Copy"}</button></div>
              <p>{activeRequest.paymentInstructions}</p>
              <small>Follow these instructions, then wait for your agent to verify the payment.</small>
            </div> : <div className="mtn-processing-note"><strong>Instructions will appear here</strong><p>{activeRequest?.paymentMethod === "CRYPTO" ? "Your assigned agent or an admin will confirm the crypto amount and payment steps here. Do not transfer before they confirm." : "Your assigned agent or an admin will post the payment details in this box. This page checks for updates automatically. Do not send money until the instructions appear."}</p></div>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="button button-quiet" type="button" onClick={() => void load()}>Refresh status</button>
            {activeRequest?.status === "PENDING" && <button className="mtn-cancel-button" type="button" disabled={busy} onClick={() => void cancelActiveRequest()}>{busy ? "Cancelling…" : "Cancel recharge request"}</button>}
            {activeRequest?.status === "PENDING" && <section className="payment-proof-upload">
              <div><strong>Upload payment proof</strong><small>After paying, attach a receipt or screenshot. JPG, PNG, WebP, or PDF · up to 5 MB.</small></div>
              {activeRequest.proofFileName && <div className="payment-proof-current"><span>Uploaded: {activeRequest.proofFileName}{activeRequest.proofUploadedAt ? ` · ${new Date(activeRequest.proofUploadedAt).toLocaleString()}` : ""}</span><a href={`/api/recharges/${activeRequest.id}/proof`} target="_blank" rel="noreferrer">View proof</a></div>}
              <form onSubmit={uploadPaymentProof}>
                <input type="file" name="proof" accept="image/jpeg,image/png,image/webp,application/pdf" required disabled={proofBusy} />
                {proofError && <p className="auth-error" role="alert">{proofError}</p>}
                {proofNotice && <p className="finance-success" role="status">{proofNotice}</p>}
                <button className="button button-quiet" type="submit" disabled={proofBusy}>{proofBusy ? "Uploading…" : activeRequest.proofFileName ? "Replace proof" : "Upload proof"}</button>
              </form>
            </section>}
            {activeRequest?.status === "PENDING" && <RechargeChatPanel requestId={activeRequest.id} currentUserId={userId} />}
          </>}
        </div>}

        {paymentScreen === "success" && activeRequest && <div className="mtn-status-screen">
          <span className="mtn-step-label">STEP 4 OF 4</span><div className="mtn-status-icon success" aria-hidden="true">✓</div><h1>Payment successful!</h1>
          <p>Your deposit has been confirmed and added to your balance.</p>
          <dl className="mtn-payment-summary"><div><dt>Amount</dt><dd>{formatUsd(activeRequest.amount)}{hasRate && <small className="mtn-rwf-amount">≈ {formatRwf(usdToRwf(activeRequest.amount, rate))}</small>}</dd></div><div><dt>Method</dt><dd>{rechargeMethodLabel(activeRequest)}</dd></div><div><dt>Status</dt><dd className="confirmed-label">Completed</dd></div><div><dt>Time</dt><dd>{new Date(activeRequest.reviewedAt ?? activeRequest.createdAt).toLocaleString()}</dd></div></dl>
          <Link className="deposit-submit mtn-account-link" href="/account/wallet">Back to Account</Link>
        </div>}

        {paymentScreen === "cancelled" && <div className="mtn-status-screen">
          <div className="mtn-status-icon cancelled" aria-hidden="true">×</div><h1>Recharge request cancelled</h1>
          <p>This request is no longer being processed, and no funds were added to your balance.</p>
          <button className="deposit-submit" type="button" onClick={() => { setActiveRequestId(null); setPaymentScreen("methods"); setPaymentMethod("AGENT"); setSelectedEcashKey(""); setSelectedCryptoKey(""); }}>Back to payment methods</button>
        </div>}
      </section>
    </div>;
  }

  return <div className="deposit-page">
    <div className="deposit-intro"><span className="deposit-intro-icon" aria-hidden="true">▣</span><div><h2>Deposit funds</h2><p>Step 1 of 4 · Choose your preferred payment method</p></div></div>

    <section className="mtn-channel-card" aria-label="MTN Mobile Money deposit channel">
      <div className="mtn-channel-head"><span className="mtn-brand-mark">MTN</span><div><h3>MTN Mobile Money</h3><p>Pay with code (PWC)</p></div><span className="mtn-channel-badge">RWANDA</span></div>
      <button type="button" className="mtn-channel-select" onClick={() => choosePaymentMethod("ECASH", "MTN_MOMO")}><span><strong>Choose MTN Mobile Money</strong><small>Select this method to continue to the deposit amount and payment instructions.</small></span><span aria-hidden="true">›</span></button>
    </section>

    <section className="deposit-method-card">
      <header className="deposit-method-heading"><span className="deposit-method-icon" aria-hidden="true">$</span><div><h3>REAL USD</h3><p>Deposit US dollars using a bank transfer or wallet.</p></div></header>
      <button type="button" className="deposit-method-row deposit-choice" onClick={() => choosePaymentMethod("BANK_TRANSFER")}><span className="deposit-flag" aria-hidden="true">🏦</span><span className="deposit-method-copy"><strong>Bank Transfer</strong><small>Transfer to bank details provided by agent</small></span><span className="deposit-chevron" aria-hidden="true">›</span></button>
      <button type="button" className="deposit-method-row deposit-choice" onClick={() => choosePaymentMethod("AGENT")} style={{ marginTop: "8px" }}><span className="deposit-flag" aria-hidden="true">$</span><span className="deposit-method-copy"><strong>Agent-assisted transfer</strong><small>Transfer details from your assigned agent</small></span><span className="deposit-fast">Manual</span><span className="deposit-chevron" aria-hidden="true">›</span></button>
      <p className="deposit-method-note">After requesting, an agent will be assigned with payment instructions. Your balance is credited only after the agent confirms receipt.</p>
    </section>

    <section className="deposit-method-card crypto-method-card">
      <header className="deposit-method-heading"><span className="deposit-method-icon" aria-hidden="true">₿</span><div><h3>CRYPTOCURRENCY</h3><p>Choose from Tether, Tron, Bitcoin, Ethereum, or Binance Pay</p></div></header>
      <div className="deposit-wallet-options">
        {CRYPTO_OPTIONS.map((opt) => (
          <button key={opt.key} type="button" className="deposit-wallet-option" onClick={() => choosePaymentMethod("CRYPTO", opt.key)}>
            <span className="deposit-wallet-symbol">{opt.icon}</span>
            <span className="deposit-wallet-name"><strong>{opt.name}</strong><small>{opt.network}</small></span>
            <span className="deposit-chevron" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
      {wallets.length === 0 && <p className="deposit-method-note">Crypto deposits are not available yet. Check back after the administrator adds wallet addresses.</p>}
    </section>

    <section className="deposit-method-card">
      <header className="deposit-method-heading"><span className="deposit-method-icon" aria-hidden="true">📱</span><div><h3>E-CASH</h3><p>Pay using mobile money or e-cash code</p></div></header>
      <div className="deposit-wallet-options">
        {ECASH_OPTIONS.map((opt) => (
          <button key={opt.key} type="button" className="deposit-wallet-option" onClick={() => choosePaymentMethod("ECASH", opt.key)}>
            <span className="deposit-wallet-symbol">{opt.icon}</span>
            <span className="deposit-wallet-name"><strong>{opt.name}</strong><small>{opt.network}</small></span>
            <span className="deposit-chevron" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
      <p className="deposit-method-note">Choose any option to continue through the same request, instruction, and confirmation steps.</p>
    </section>

    <section className="deposit-method-card">
      <header className="deposit-method-heading"><span className="deposit-method-icon" aria-hidden="true">💳</span><div><h3>CARDS</h3><p>Pay with a debit or credit card</p></div></header>
      <button type="button" className="deposit-method-row deposit-choice" onClick={() => choosePaymentMethod("CARD")}><span className="deposit-flag" aria-hidden="true">💳</span><span className="deposit-method-copy"><strong>Visa / Mastercard</strong><small>Card deposit via agent assistance</small></span><span className="deposit-chevron" aria-hidden="true">›</span></button>
      <p className="deposit-method-note">Card payments are processed with agent assistance. You&apos;ll receive instructions after creating your request.</p>
    </section>

    <div className="deposit-columns activity-only">
      <section className="deposit-activity-card">
        <div className="deposit-section-title"><span className="deposit-small-icon" aria-hidden="true">↻</span><div><h3>Recent deposits</h3><p>Your recharge activity</p></div></div>
        {items.length === 0 ? <p className="finance-empty">No deposit requests yet.</p> : <div className="finance-list">{items.map((item) => <article className="finance-row" key={item.id}>
          <div><strong>{formatMoney(item.amount, item.currency)}</strong>{item.currency === "USD" && hasRate && <small>≈ {formatRwf(usdToRwf(item.amount, rate))}</small>}<small>{new Date(item.createdAt).toLocaleString()}</small><small>{rechargeMethodLabel(item)}</small></div>
          <div><span className={`finance-status ${item.status.toLowerCase()}`}>{item.status.toLowerCase()}</span><small>Agent: {item.agent.name}{item.agent.phone ? ` · ${item.agent.phone}` : ""}</small></div>
          {item.status === "PENDING" && item.paymentInstructions && <p className="finance-instruction">Payment instructions: {item.paymentInstructions}</p>}
          {item.status === "PENDING" && !item.paymentInstructions && <p className="finance-instruction">Waiting for payment instructions from your agent or admin. Do not send funds yet.</p>}
          {item.status === "PENDING" && item.paymentMethod === "CRYPTO" && item.cryptoAddress && <p className="finance-instruction">Destination: <strong>{item.cryptoAddress}</strong> · {item.cryptoNetwork}. Confirm the token amount before sending.</p>}
        </article>)}</div>}
      </section>
    </div>
  </div>;
}
