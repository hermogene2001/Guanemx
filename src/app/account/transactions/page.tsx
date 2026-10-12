import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { settleDueEarnings } from "@/lib/robot-earnings";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount%2Ftransactions");
  await settleDueEarnings(user.id);
  const transactions = await prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return <AccountFrame user={user} activeHref="/account/transactions"><header className="account-header"><div><span className="label">ACCOUNT ACTIVITY</span><h1>Transactions</h1><p>Recharge, subscriptions, earnings, withdrawals, fees, and transfers.</p></div></header><p className="finance-disclaimer">Approved withdrawals show a gross debit plus net payout and fee breakdown records. The breakdown records do not cause another balance deduction.</p><section className="finance-card ledger-card"><div className="finance-list">{transactions.length === 0 ? <p className="finance-empty">Transactions will appear here after a recharge or withdrawal is confirmed.</p> : transactions.map((item) => <article className="finance-row" key={item.id}><div><strong>{item.type.replaceAll("_", " ")}</strong><small>{item.description || item.reference} · {new Date(item.createdAt).toLocaleString()}</small></div><div><strong>{item.type === "WITHDRAWAL" || item.type === "FEE" || item.type === "SUBSCRIPTION" ? "−" : "+"} {formatMoney(item.amount, item.currency)}</strong><small>{item.status.toLowerCase()} · {item.reference}</small></div></article>)}</div></section></AccountFrame>;
}
