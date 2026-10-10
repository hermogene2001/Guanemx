import Link from "next/link";
import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fadmin");
  if (user.role !== "ADMIN") redirect("/account");

  const [users, agents, robots, pendingRecharges, pendingWithdrawals, recentActivity] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { role: "AGENT", status: "ACTIVE" } }),
    prisma.robot.count(),
    prisma.rechargeRequest.count({ where: { status: "PENDING" } }),
    prisma.withdrawal.count({ where: { status: "PENDING" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { name: true, email: true } } } }),
  ]);

  return <AccountFrame user={user} activeHref="/admin">
    <header className="account-header"><div><span className="label">ADMINISTRATION</span><h1>Admin overview</h1><p>Monitor GuanemX operations and manage staff access.</p></div><Link className="button" href="/agent/requests">Review finance queue</Link></header>
    <section className="staff-metric-grid" aria-label="Platform overview">
      <article className="staff-metric"><span>Client accounts</span><strong>{users.toLocaleString()}</strong><small>Registered user accounts</small></article>
      <article className="staff-metric"><span>Active agents</span><strong>{agents.toLocaleString()}</strong><small>Can receive recharge assignments</small></article>
      <article className="staff-metric"><span>Robot listings</span><strong>{robots.toLocaleString()}</strong><small>Manage catalog and plans</small><Link href="/admin/robots">Open robot catalog →</Link></article>
      <article className="staff-metric"><span>Pending recharges</span><strong>{pendingRecharges.toLocaleString()}</strong><small>Awaiting receipt confirmation</small></article>
      <article className="staff-metric"><span>Pending withdrawals</span><strong>{pendingWithdrawals.toLocaleString()}</strong><small>Awaiting agent decision</small></article>
    </section>
    <div className="staff-dashboard-grid">
      <section className="finance-card"><span className="label">OPERATIONS</span><h2>Staff tools</h2><p>Finance decisions update wallet accounting. Approved withdrawal payouts still require an external manual payment.</p><div className="staff-shortcuts"><Link className="button" href="/agent/requests">Open review queue <span>→</span></Link><Link className="button button-quiet" href="/admin/agents">Manage agents <span>→</span></Link><Link className="button button-quiet" href="/admin/community">Community moderation</Link><Link className="button button-quiet" href="/admin/audit">Audit activity</Link></div></section>
      <section className="finance-card"><span className="label">AUDIT TRAIL</span><h2>Recent staff activity</h2>{recentActivity.length === 0 ? <p className="finance-empty">No administrative activity has been recorded yet.</p> : <div className="finance-list">{recentActivity.map((entry) => <article className="finance-row staff-audit-row" key={entry.id}><div><strong>{entry.action.replaceAll(".", " ")}</strong><small>{entry.actor?.name ?? "System"} · {entry.actor?.email ?? "Automated event"}</small><small>{entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ""}</small></div><time dateTime={entry.createdAt.toISOString()}>{entry.createdAt.toLocaleString()}</time></article>)}</div>}</section>
    </div>
  </AccountFrame>;
}
