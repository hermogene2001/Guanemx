import Link from "next/link";
import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type PageProps = {
  searchParams: Promise<{ q?: string; cursor?: string }>;
};

export default async function AdminTransactionsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fadmin%2Ftransactions");
  if (user.role !== "ADMIN") redirect("/account");

  const { q, cursor } = await searchParams;
  const query = q?.trim().slice(0, 120) ?? "";
  const where = query ? {
    OR: [
      { reference: { contains: query, mode: "insensitive" as const } },
      { description: { contains: query, mode: "insensitive" as const } },
      { user: { is: { name: { contains: query, mode: "insensitive" as const } } } },
      { user: { is: { email: { contains: query, mode: "insensitive" as const } } } },
    ],
  } : undefined;

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { user: { select: { name: true, email: true } } },
  });
  const hasMore = transactions.length > PAGE_SIZE;
  const page = transactions.slice(0, PAGE_SIZE);
  const nextCursor = hasMore ? page[page.length - 1]?.id : undefined;

  return <AccountFrame user={user} activeHref="/admin/transactions">
    <header className="account-header"><div><span className="label">ADMINISTRATION</span><h1>System transaction history</h1><p>Review transactions across all user accounts, newest first.</p></div></header>
    <section className="finance-card ledger-card">
      <form className="admin-transaction-search" action="/admin/transactions" method="get">
        <label className="auth-field">Search by account, reference, or description<input type="search" name="q" defaultValue={query} maxLength={120} placeholder="Name, email, reference…" /></label>
        <button className="button button-quiet" type="submit">Search</button>
        {query && <Link className="button button-quiet" href="/admin/transactions">Clear</Link>}
      </form>
      {page.length === 0 ? <p className="finance-empty">{query ? "No matching transactions found." : "No transactions have been recorded."}</p> : <div className="user-table-scroll">
        <table className="admin-transaction-table">
          <thead><tr><th scope="col">Date</th><th scope="col">Account</th><th scope="col">Type / status</th><th scope="col">Amount</th><th scope="col">Reference</th><th scope="col">Description</th></tr></thead>
          <tbody>{page.map((transaction) => <tr key={transaction.id}>
            <td><time dateTime={transaction.createdAt.toISOString()}>{transaction.createdAt.toLocaleString()}</time></td>
            <td><strong>{transaction.user.name}</strong><small>{transaction.user.email}</small></td>
            <td><strong>{transaction.type.replaceAll("_", " ")}</strong><small>{transaction.status.toLowerCase()}</small></td>
            <td className={["WITHDRAWAL", "FEE", "SUBSCRIPTION"].includes(transaction.type) ? "amount-negative" : "amount-positive"}>
              {["WITHDRAWAL", "FEE", "SUBSCRIPTION"].includes(transaction.type) ? "−" : "+"} {formatMoney(transaction.amount, transaction.currency)}
            </td>
            <td><code>{transaction.reference}</code></td>
            <td>{transaction.description || "—"}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <p className="finance-empty">Showing {page.length} transaction{page.length === 1 ? "" : "s"} on this page, out of all system transactions.</p>
      {nextCursor && <Link className="button button-quiet admin-transactions-more" href={{ pathname: "/admin/transactions", query: { ...(query ? { q: query } : {}), cursor: nextCursor } }}>Load older transactions</Link>}
    </section>
  </AccountFrame>;
}
