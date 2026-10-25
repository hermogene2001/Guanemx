"use client";

import { useEffect, useState } from "react";

type CryptoWallet = { id: string; name: string; network: string; address: string; enabled: boolean };
const blank = { name: "", network: "", address: "", enabled: true };

export default function CryptoWalletSettingsPanel() {
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/crypto-wallets", { cache: "no-store" });
    const data = await response.json() as { wallets?: CryptoWallet[]; error?: string };
    if (!response.ok || !data.wallets) { setError(data.error ?? "Unable to load crypto wallets."); return; }
    setWallets(data.wallets);
  }
  useEffect(() => { void load(); }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(editing ? `/api/admin/crypto-wallets/${editing}` : "/api/admin/crypto-wallets", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(form),
      });
      const data = await response.json() as { wallet?: CryptoWallet; error?: string };
      if (!response.ok || !data.wallet) { setError(data.error ?? "Wallet could not be saved."); return; }
      setForm(blank); setEditing(null); setNotice("Crypto wallet saved."); await load();
    } catch { setError("Unable to reach GuanemX. Try again."); }
    finally { setBusy(false); }
  }

  async function remove(wallet: CryptoWallet) {
    if (!window.confirm(`Remove ${wallet.name} on ${wallet.network}? Existing deposit requests keep their saved address.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/crypto-wallets/${wallet.id}`, { method: "DELETE", credentials: "same-origin" });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setError(data.error ?? "Wallet could not be removed."); return; }
      setNotice("Crypto wallet removed."); await load();
    } catch { setError("Unable to reach GuanemX. Try again."); }
    finally { setBusy(false); }
  }

  return <section className="finance-card crypto-wallet-admin">
    <span className="label">CRYPTO DEPOSITS</span><h2>Wallet destinations</h2>
    <p>Add the wallet addresses clients can choose when making a crypto deposit. Only enabled wallets appear on the deposit page. Existing requests keep the address selected when they were created.</p>
    <form className="finance-form" onSubmit={save}>
      <label className="auth-field">Currency<input maxLength={40} placeholder="Tether (USDT)" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
      <label className="auth-field">Network<input maxLength={60} placeholder="TRON (TRC20)" value={form.network} onChange={(event) => setForm({ ...form, network: event.target.value })} required /></label>
      <label className="auth-field">Wallet address<input maxLength={200} autoComplete="off" placeholder="Paste the receiving wallet address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} required /></label>
      {editing && <label className="crypto-wallet-enabled"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Show this wallet to clients</label>}
      {error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="finance-success" role="status">{notice}</p>}
      <div className="acts"><button className="button" disabled={busy}>{busy ? "Saving…" : editing ? "Update wallet" : "Add wallet"}</button>{editing && <button className="button button-quiet" type="button" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</button>}</div>
    </form>
    <div className="finance-list crypto-wallet-list">{wallets.length === 0 ? <p className="finance-empty">No crypto wallets configured yet.</p> : wallets.map((wallet) => <article className="crypto-wallet-row" key={wallet.id}><div><strong>{wallet.name} · {wallet.network}</strong><code>{wallet.address}</code><small>{wallet.enabled ? "Visible to clients" : "Disabled"}</small></div><div className="acts"><button className="button button-quiet" type="button" disabled={busy} onClick={() => { setEditing(wallet.id); setForm({ name: wallet.name, network: wallet.network, address: wallet.address, enabled: wallet.enabled }); }}>Edit</button><button className="button button-quiet" type="button" disabled={busy} onClick={() => void remove(wallet)}>Remove</button></div></article>)}</div>
  </section>;
}
