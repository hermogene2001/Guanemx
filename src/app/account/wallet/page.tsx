import Link from "next/link";
import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import { getCurrentUser } from "@/lib/auth";
import { formatRwf } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount%2Fwallet");
  const [wallet, ledger] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: user.id } }),
    prisma.walletLedger.findMany({ where: { wallet: { userId: user.id } }, orderBy: { createdAt: "desc" }, take: 8, include: { transaction: { select: { type: true, status: true, description: true } } } }),
  ]);
  return <AccountFrame user={user} activeHref="/account/wallet">
    <header className="account-header"><div><span className="label">WALLET</span><h1>Your balances</h1><p>Balance changes are recorded in your account ledger.</p></div></header>
    <div className="balance-grid"><article className="balance-card"><span>Main Balance</span><strong>RWF {formatRwf(wallet?.availableBalance ?? 0)}</strong><small>Available for account operations</small></article><article className="balance-card"><span>Growth Balance</span><strong>RWF {formatRwf(wallet?.growthBalance ?? 0)}</strong><small>Available from matured growth plans</small></article><article className="balance-card"><span>Pending Balance</span><strong>RWF {formatRwf(wallet?.pendingBalance ?? 0)}</strong><small>Funds awaiting settlement</small></article></div>
    <div className="finance-actions"><Link className="button" href="/account/recharge">Recharge</Link><Link className="button button-quiet" href="/account/withdrawals">Withdraw</Link><Link className="button button-quiet" href="/account/payout-setup">Payout Setup</Link></div>
    <section className="finance-card ledger-card"><span className="label">RECENT WALLET ACTIVITY</span><h2>Ledger</h2>{ledger.length === 0 ? <p className="finance-empty">Wallet activity will appear here after a confirmed recharge or balance operation.</p> : <div className="finance-list">{ledger.map((entry) => <article className="finance-row" key={entry.id}><div><strong>{entry.transaction.type.replaceAll("_", " ")}</strong><small>{entry.transaction.description || entry.reference} · {new Date(entry.createdAt).toLocaleString()}</small></div><div><strong className={entry.amount.isNegative() ? "amount-negative" : "amount-positive"}>{entry.amount.isNegative() ? "−" : "+"} RWF {entry.amount.abs().toString()}</strong><small>{entry.balanceType === "MAIN" ? "Main Balance" : "Growth Balance"} · balance RWF {entry.balanceAfter.toString()}</small></div></article>)}</div>}</section>
  </AccountFrame>;
}
