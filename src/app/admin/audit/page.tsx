import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fadmin%2Faudit");
  if (user.role !== "ADMIN") redirect("/account");
  const entries = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { name: true, email: true } } } });
  return <AccountFrame user={user} activeHref="/admin"><header className="account-header"><div><span className="label">ADMINISTRATION</span><h1>Audit activity</h1><p>Recent recorded account, financial, and moderation actions.</p></div></header><section className="finance-card ledger-card"><span className="label">LATEST 200 EVENTS</span>{entries.length === 0 ? <p className="finance-empty">No audit events are available.</p> : <div className="finance-list">{entries.map((entry) => <article className="finance-row staff-audit-row" key={entry.id}><div><strong>{entry.action.replaceAll(".", " ")}</strong><small>{entry.actor?.name ?? "System"} · {entry.actor?.email ?? "Automated event"}</small><small>{entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ""}</small>{entry.metadata && <small>{JSON.stringify(entry.metadata)}</small>}</div><time dateTime={entry.createdAt.toISOString()}>{entry.createdAt.toLocaleString()}</time></article>)}</div>}</section></AccountFrame>;
}
